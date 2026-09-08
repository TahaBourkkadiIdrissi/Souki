"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeftRight,
  Bike,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Route,
  Trash2,
  Zap,
  X,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import {
  ApiError,
  annulerAdminAnomalie,
  getAdminDispatchTournees,
  reassignAdminDispatchCommande,
  replanifierAdminAnomalie,
  runDailyAdminDispatch,
  type AdminDispatchAnomalie,
  type AdminDispatchCommande,
  type AdminDispatchTournee,
} from "@/lib/api"
import { cn } from "@/lib/utils"

type ReassignTarget = {
  commande: AdminDispatchCommande
  sourceTourneeId: number
} | null

type FournisseurTourneesGroup = {
  key: string
  livreur: AdminDispatchTournee["livreur"]
  tournees: AdminDispatchTournee[]
  totalCommandes: number
  livreurNames: string[]
  pickup: AdminDispatchTournee["pickup"]
}

type DisplayedTournee = AdminDispatchTournee & {
  tourneeIds: number[]
  livreurNames: string[]
}

function todayAsIsoDate() {
  const parts = new Intl.DateTimeFormat("fr-MA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === "year")?.value || ""
  const month = parts.find((part) => part.type === "month")?.value || ""
  const day = parts.find((part) => part.type === "day")?.value || ""
  return `${year}-${month}-${day}`
}

function isSameIsoDate(value: string | null | undefined, isoDate: string) {
  return value?.split("T")[0] === isoDate
}

function formatDispatchDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return "aujourd'hui"
  }

  const formattedDate = new Intl.DateTimeFormat("fr-MA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(year, month - 1, day, 12))

  return formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)
}

function formatSimpleDate(value?: string | null) {
  if (!value) {
    return "Date non renseignee"
  }

  const [year, month, day] = value.split("T")[0].split("-").map(Number)
  if (!year || !month || !day) {
    return "Date non renseignee"
  }

  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day, 12))
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }
  return `${value.toFixed(2)} DH`
}

function getStatusClassName(status: string) {
  const normalizedStatus = status.toUpperCase()
  if (normalizedStatus === "A_LIVRER") {
    return "bg-[#EAF8EC] text-[#1E8A3C] border-[#BFE6C4]"
  }
  if (normalizedStatus === "EN_ROUTE") {
    return "bg-[#EEF7FF] text-[#1A5F96] border-[#B9D7F2]"
  }
  if (normalizedStatus === "LIVRE") {
    return "bg-[#F0FAF1] text-[#176B2E] border-[#CDE8D0]"
  }
  if (["ABSENT", "REFUS", "ANNULEE"].includes(normalizedStatus)) {
    return "bg-[#FFF1F1] text-[#B42318] border-[#F1C6C6]"
  }
  if (normalizedStatus === "RETOUR_DEPOT") {
    return "bg-[#FFF1F1] text-[#B42318] border-[#F1C6C6]"
  }
  return "bg-[#FFF7EE] text-[#9A5C11] border-[#F5D7B8]"
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    EN_ATTENTE_LIVREUR: "En attente livreur",
    A_LIVRER: "A livrer",
    EN_ROUTE: "En route",
    LIVRE: "Livrée",
    ABSENT: "Absent",
    REFUS: "Refusée",
    ANNULEE: "Annulée",
    RETOUR_DEPOT: "Retour depot",
    PLANIFIEE: "Planifiee",
  }
  return labels[status.toUpperCase()] || status || "Inconnu"
}

function isCommandeReassignable(status: string) {
  return ["EN_ATTENTE_LIVREUR", "A_LIVRER", "PLANIFIEE"].includes(status.toUpperCase())
}

export default function AdminLivreurPage() {
  const { token } = useAuth()
  const [dispatchDate, setDispatchDate] = useState(todayAsIsoDate)
  const [tournees, setTournees] = useState<AdminDispatchTournee[]>([])
  const [anomalies, setAnomalies] = useState<AdminDispatchAnomalie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isGeneratingDispatch, setIsGeneratingDispatch] = useState(false)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [reassignTarget, setReassignTarget] = useState<ReassignTarget>(null)
  const [selectedTourneeId, setSelectedTourneeId] = useState("")
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false)
  const [resolvingAnomalieId, setResolvingAnomalieId] = useState<number | null>(null)

  const loadTournees = useCallback(
    async (showLoader = true) => {
      if (!token) {
        setTournees([])
        setAnomalies([])
        setIsLoading(false)
        return
      }

      try {
        if (showLoader) {
          setIsLoading(true)
        } else {
          setIsRefreshing(true)
        }
        const response = await getAdminDispatchTournees(token)
        const today = todayAsIsoDate()
        const todaysTournees = (response.tournees || []).filter((tournee) =>
          isSameIsoDate(tournee.date_tournee, today)
        )
        const todaysAnomalies = (response.anomalies || []).filter((anomalie) =>
          isSameIsoDate(anomalie.detected_at || anomalie.date_tournee_ratee, today)
        )
        setDispatchDate(today)
        setTournees(todaysTournees)
        setAnomalies(todaysAnomalies)
        setError("")
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les tournees."
        )
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [token]
  )

  useEffect(() => {
    void loadTournees(true)
  }, [loadTournees])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timeoutId = window.setTimeout(() => setToast(""), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const totalCommandes = useMemo(
    () => tournees.reduce((sum, tournee) => sum + tournee.commandes.length, 0),
    [tournees]
  )
  const fournisseurTourneeGroups = useMemo<FournisseurTourneesGroup[]>(() => {
    const groupsByFournisseur = new Map<string, FournisseurTourneesGroup>()

    for (const tournee of tournees) {
      const fournisseurKey =
        tournee.pickup?.fournisseur_id !== null && tournee.pickup?.fournisseur_id !== undefined
          ? `fournisseur-${tournee.pickup.fournisseur_id}`
          : `fournisseur-inconnu-${tournee.id}`
      const existingGroup = groupsByFournisseur.get(fournisseurKey)

      if (existingGroup) {
        existingGroup.tournees.push(tournee)
        existingGroup.totalCommandes += tournee.commandes.length
        if (!existingGroup.livreurNames.includes(tournee.livreur.nom)) {
          existingGroup.livreurNames.push(tournee.livreur.nom)
        }
      } else {
        groupsByFournisseur.set(fournisseurKey, {
          key: fournisseurKey,
          livreur: tournee.livreur,
          tournees: [tournee],
          totalCommandes: tournee.commandes.length,
          livreurNames: [tournee.livreur.nom],
          pickup: tournee.pickup,
        })
      }
    }

    return Array.from(groupsByFournisseur.values())
  }, [tournees])
  const displayedTournees = useMemo<DisplayedTournee[]>(
    () =>
      fournisseurTourneeGroups.map((group) => {
        const firstTournee = group.tournees[0]
        return {
          ...firstTournee,
          livreur: group.livreur,
          commandes: group.tournees.flatMap((tournee) => tournee.commandes),
          tourneeIds: group.tournees.map((tournee) => tournee.id),
          livreurNames: group.livreurNames,
          pickup: group.pickup,
        }
      }),
    [fournisseurTourneeGroups]
  )
  const commandeSourceTourneeIds = useMemo(() => {
    const sourceIds = new Map<number, number>()

    for (const tournee of tournees) {
      for (const commande of tournee.commandes) {
        sourceIds.set(commande.id, tournee.id)
      }
    }

    return sourceIds
  }, [tournees])
  const dispatchDateLabel = useMemo(() => formatDispatchDate(dispatchDate), [dispatchDate])
  const hasAnomalies = anomalies.length > 0
  const hasDispatchData = totalCommandes > 0 || hasAnomalies

  const openReassignModal = (commande: AdminDispatchCommande, sourceTourneeId: number) => {
    const firstOtherTournee = tournees.find((tournee) => tournee.id !== sourceTourneeId)
    setReassignTarget({ commande, sourceTourneeId })
    setSelectedTourneeId(firstOtherTournee ? String(firstOtherTournee.id) : "")
  }

  const closeReassignModal = () => {
    if (isSubmittingReassign) {
      return
    }
    setReassignTarget(null)
    setSelectedTourneeId("")
  }

  const generateDispatch = async () => {
    if (!token) {
      return
    }

    setIsGeneratingDispatch(true)
    try {
      const response = await runDailyAdminDispatch(token)
      const assignedCount = response.commandes_assigned ?? response.count ?? 0
      const tourneeCount = response.tournees_created ?? 0
      setDispatchDate(response.target_date || todayAsIsoDate())
      setToast(
        response.status === "no_orders"
          ? "Aucune commande disponible pour générer un dispatch."
          : `Dispatch généré : ${tourneeCount} tournée${tourneeCount > 1 ? "s" : ""}, ${assignedCount} commande${assignedCount > 1 ? "s" : ""} assignée${assignedCount > 1 ? "s" : ""}.`
      )
      setError("")
      await loadTournees(false)
    } catch (dispatchError) {
      setError(
        dispatchError instanceof ApiError || dispatchError instanceof Error
          ? dispatchError.message
          : "Impossible de générer le dispatch."
      )
    } finally {
      setIsGeneratingDispatch(false)
    }
  }

  const submitReassign = async () => {
    if (!token || !reassignTarget || !selectedTourneeId) {
      return
    }

    const nextTourneeId = Number(selectedTourneeId)
    if (!Number.isFinite(nextTourneeId)) {
      setError("Tournée cible invalide.")
      return
    }

    setIsSubmittingReassign(true)
    try {
      await reassignAdminDispatchCommande(token, reassignTarget.commande.id, nextTourneeId)
      setToast(`Commande #${reassignTarget.commande.id} réassignée avec succès.`)
      setReassignTarget(null)
      setSelectedTourneeId("")
      await loadTournees(false)
    } catch (submitError) {
      setError(
        submitError instanceof ApiError || submitError instanceof Error
          ? submitError.message
          : "Impossible de reassigner la commande."
      )
    } finally {
      setIsSubmittingReassign(false)
    }
  }

  const resolveAnomalie = async (anomalieId: number, action: "replanifier" | "annuler") => {
    if (!token) {
      return
    }

    setResolvingAnomalieId(anomalieId)
    try {
      if (action === "replanifier") {
        await replanifierAdminAnomalie(token, anomalieId)
        setToast("Anomalie resolue: commande remise en attente.")
      } else {
        await annulerAdminAnomalie(token, anomalieId)
        setToast("Anomalie resolue: commande annulee en perte.")
      }
      setError("")
      await loadTournees(false)
    } catch (resolveError) {
      setError(
        resolveError instanceof ApiError || resolveError instanceof Error
          ? resolveError.message
          : "Impossible de resoudre cette anomalie."
      )
    } finally {
      setResolvingAnomalieId(null)
    }
  }

  const availableTargetTournees = reassignTarget
    ? tournees.filter(
        (tournee) =>
          tournee.id !== reassignTarget.sourceTourneeId &&
          isSameIsoDate(tournee.date_tournee, todayAsIsoDate())
      )
    : []

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {toast && (
        <div className="fixed right-5 top-5 z-[70] flex items-center gap-3 rounded-2xl border border-[#BFE6C4] bg-white px-5 py-4 text-sm font-semibold text-[#1E8A3C] shadow-xl">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
        <section className="mb-8 overflow-hidden rounded-[32px] border border-[#DDEBDD] bg-white shadow-[0_24px_80px_-45px_rgba(30,138,60,0.35)]">
          <div className="bg-gradient-to-r from-[#123A1D] via-[#1E8A3C] to-[#F07C00] p-6 text-white lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em]">
                  <Route className="h-4 w-4" />
                  Dispatch logistique
                </div>
                <h1 className="text-3xl font-black lg:text-5xl">Tournees livreurs</h1>
                <p className="mt-3 max-w-2xl text-sm text-white/80 lg:text-base">
                  Supervision des tournées planifiées, commandes assignées et réassignations rapides.
                </p>
                <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white">
                  <CalendarDays className="h-4 w-4" />
                  Dispatch du {dispatchDateLabel}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Tournees</p>
                  <p className="mt-1 text-3xl font-black">{tournees.length}</p>
                </div>
                <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">Commandes</p>
                  <p className="mt-1 text-3xl font-black">{totalCommandes}</p>
                </div>
                <div className="rounded-3xl bg-red-500/25 px-5 py-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/75">Inspections</p>
                  <p className="mt-1 text-3xl font-black">{anomalies.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 text-sm font-semibold text-[#264129] sm:flex-row sm:items-center">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-[#1E8A3C]" />
                Jour courant
              </span>
              <span className="rounded-2xl border border-[#D7EBD9] bg-[#FAFCFA] px-4 py-3 text-[#264129]">
                Dispatch du {dispatchDateLabel}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => void generateDispatch()}
                disabled={isGeneratingDispatch || isRefreshing || isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-5 py-3 font-bold text-white transition hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingDispatch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Generer le Dispatch
              </button>

              <button
                onClick={() => void loadTournees(false)}
                disabled={isRefreshing || isLoading || isGeneratingDispatch}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-5 py-3 font-bold text-white transition hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Rafraîchir
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="min-h-[360px] space-y-4 rounded-[32px] border border-[#DDEBDD] bg-white p-6" role="status" aria-label="Chargement des tournées">
            <div className="souki-skeleton h-8 w-56 rounded-xl" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="souki-skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : !hasDispatchData ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[32px] border border-[#DDEBDD] bg-white p-8 text-center">
            <div>
              <Package className="mx-auto h-12 w-12 text-[#C8D9CA]" />
              <h2 className="mt-4 text-xl font-black text-[#264129]">
                Aucune commande ou tournée générée pour aujourd'hui.
              </h2>
              <p className="mt-2 text-[#6F8070]">
                Cliquez sur "Generer le Dispatch" pour commencer.
              </p>
              <button
                onClick={() => void generateDispatch()}
                disabled={isGeneratingDispatch || isRefreshing}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F07C00] px-5 py-3 font-bold text-white transition hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingDispatch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Generer le Dispatch
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasAnomalies && (
              <section className="mb-6 rounded-[32px] border-2 border-red-300 bg-red-50 p-5 shadow-[0_20px_70px_-45px_rgba(180,35,24,0.5)]">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Retour depot
                    </div>
                    <h2 className="mt-3 text-2xl font-black text-red-900">
                      Inspections marchandise en attente
                    </h2>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white">
                    {anomalies.length} inspection{anomalies.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {anomalies.map((anomalie) => {
                    const commande = anomalie.commande
                    const produits = commande?.produits || []
                    const isResolving = resolvingAnomalieId === anomalie.id

                    return (
                      <article
                        key={anomalie.id}
                        className="rounded-[24px] border border-red-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-500">
                              Anomalie #{anomalie.id} - CMD-{anomalie.commande_id}
                            </p>
                            <h3 className="mt-1 text-lg font-black text-[#264129]">
                              {commande?.client_nom || "Client inconnu"}
                            </h3>
                          </div>
                          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                            {formatStatus(commande?.statut || "RETOUR_DEPOT")}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div className="rounded-2xl bg-[#FFF7F7] p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                              Livreur defaillant
                            </p>
                            <p className="mt-1 font-bold text-[#264129]">
                              {anomalie.livreur_defaillant?.nom || "Non renseigne"}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#FFF7F7] p-3">
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                              Tournée ratée
                            </p>
                            <p className="mt-1 font-bold text-[#264129]">
                              {formatSimpleDate(anomalie.date_tournee_ratee || anomalie.detected_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-red-100 bg-[#FFFDFD] p-3">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-500">
                            Produits a inspecter
                          </p>
                          {produits.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {produits.map((produit, index) => (
                                <span
                                  key={`${anomalie.id}-${produit.product_id ?? index}`}
                                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-800"
                                >
                                  {produit.nom_fr} - {produit.quantite_kg} kg
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-[#6F8070]">
                              Produits non renseignes.
                            </p>
                          )}
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <button
                            onClick={() => void resolveAnomalie(anomalie.id, "replanifier")}
                            disabled={isResolving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 py-3 text-sm font-black text-white transition hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Marchandise OK - Re-planifier
                          </button>
                          <button
                            onClick={() => void resolveAnomalie(anomalie.id, "annuler")}
                            disabled={isResolving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Marchandise perimee - Annuler
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )}

            {displayedTournees.length > 0 && totalCommandes > 0 && (
              <div className="flex gap-5 overflow-x-auto pb-6">
                {displayedTournees.map((tournee) => (
                  <section
                    key={tournee.id}
                    className="flex max-h-[calc(100vh-240px)] min-w-[320px] max-w-[360px] flex-1 flex-col rounded-[28px] border border-[#DDEBDD] bg-white shadow-[0_20px_60px_-40px_rgba(18,58,29,0.3)]"
                  >
                    <header className="border-b border-[#EEF2EE] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F07C00]">
                            {tournee.tourneeIds.length > 1
                              ? `${tournee.tourneeIds.length} tournées`
                              : `Tournée #${tournee.id}`}
                          </p>
                          <h2 className="mt-1 text-lg font-black text-[#1E8A3C]">
                            {tournee.pickup?.shop_name || "Point Souki"}
                          </h2>
                          <p className="mt-1 flex items-center gap-2 text-sm text-[#6F8070]">
                            <MapPin className="h-4 w-4" />
                            {[tournee.pickup?.address, tournee.pickup?.ville].filter(Boolean).join(", ") ||
                              "Point de ramassage non renseigné"}
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-[#6F8070]">
                            <Bike className="h-4 w-4" />
                            Livreurs : {tournee.livreurNames.join(", ")}
                          </p>
                          {tournee.tourneeIds.length > 1 && (
                            <p className="mt-2 text-xs font-semibold text-[#7A8A7C]">
                              Tournées #{tournee.tourneeIds.join(", #")}
                            </p>
                          )}
                        </div>
                        <span className="rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold text-[#1E8A3C]">
                          {tournee.commandes.length}
                        </span>
                      </div>
                    </header>

                    <div className="flex-1 space-y-3 overflow-y-auto p-4">
                      {tournee.commandes.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[#D7EBD9] p-5 text-center text-sm font-semibold text-[#8A9A8C]">
                Aucune commande assignée.
                        </div>
                      ) : (
                        tournee.commandes.map((commande) => {
                          const canReassign = isCommandeReassignable(commande.statut)

                          return (
                            <article
                              key={commande.id}
                              className="rounded-3xl border border-[#E6F0E7] bg-[#FAFCFA] p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A9A8C]">
                                    Tournée #{commandeSourceTourneeIds.get(commande.id) ?? tournee.id} - Passage{" "}
                                    {commande.ordre_passage ?? "-"}
                                  </p>
                                  <h3 className="mt-1 font-black text-[#264129]">
                                    CMD-{commande.id}
                                  </h3>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full border px-3 py-1 text-xs font-bold",
                                    getStatusClassName(commande.statut)
                                  )}
                                >
                                  {formatStatus(commande.statut)}
                                </span>
                              </div>

                              <p className="mt-3 text-sm font-semibold text-[#264129]">
                                {commande.client_nom}
                              </p>
                              <p className="mt-1 flex items-start gap-2 text-xs text-[#6F8070]">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1E8A3C]" />
                                <span>
                                  {commande.adresse?.full_address ||
                                    commande.adresse?.neighborhood ||
                                    "Adresse non renseignee"}
                                </span>
                              </p>

                              <div className="mt-4 flex items-center justify-between gap-3">
                                <span className="text-sm font-bold text-[#F07C00]">
                                  {formatMoney(commande.montant_total)}
                                </span>
                                {canReassign && (
                                  <button
                                    onClick={() =>
                                      openReassignModal(
                                        commande,
                                        commandeSourceTourneeIds.get(commande.id) ?? tournee.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#F5D7B8] bg-white px-3 py-2 text-xs font-bold text-[#9A5C11] transition hover:bg-[#FFF7EE]"
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                    Réassigner
                                  </button>
                                )}
                              </div>
                            </article>
                          )
                        })
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {reassignTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#122018]/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-[#DDEBDD] bg-white p-6 shadow-[0_30px_90px_rgba(18,32,24,0.25)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F07C00]">
                  Réassignation
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#264129]">
                  Commande #{reassignTarget.commande.id}
                </h2>
                <p className="mt-1 text-sm text-[#6F8070]">
                  Choisissez une autre tournée pour déplacer cette commande.
                </p>
              </div>
              <button
                onClick={closeReassignModal}
                className="rounded-xl p-2 text-[#6F8070] transition hover:bg-[#F0FAF1] hover:text-[#264129]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-6 block text-sm font-bold text-[#264129]">
              Nouvelle tournée
              <select
                value={selectedTourneeId}
                onChange={(event) => setSelectedTourneeId(event.target.value)}
                disabled={availableTargetTournees.length === 0}
                className="mt-2 w-full rounded-2xl border border-[#D7EBD9] bg-[#FAFCFA] px-4 py-3 text-[#264129] outline-none transition focus:border-[#1E8A3C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availableTargetTournees.length === 0 ? (
                  <option value="">Aucune autre tournée disponible</option>
                ) : (
                  availableTargetTournees.map((tournee) => (
                    <option key={tournee.id} value={tournee.id}>
                      Tournée #{tournee.id} - {tournee.livreur.nom}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeReassignModal}
                className="rounded-2xl border border-[#D7EBD9] px-5 py-3 font-bold text-[#264129] transition hover:bg-[#F0FAF1]"
              >
                Annuler
              </button>
              <button
                onClick={() => void submitReassign()}
                disabled={!selectedTourneeId || isSubmittingReassign}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-5 py-3 font-bold text-white transition hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingReassign && <Loader2 className="h-4 w-4 animate-spin" />}
                Valider la réassignation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
