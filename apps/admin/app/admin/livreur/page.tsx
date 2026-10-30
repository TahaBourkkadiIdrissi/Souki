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
    return "Date non renseignée"
  }

  const [year, month, day] = value.split("T")[0].split("-").map(Number)
  if (!year || !month || !day) {
    return "Date non renseignée"
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
    A_LIVRER: "À livrer",
    EN_ROUTE: "En route",
    LIVRE: "Livrée",
    ABSENT: "Absent",
    REFUS: "Refusée",
    ANNULEE: "Annulée",
    RETOUR_DEPOT: "Retour dépôt",
    PLANIFIEE: "Planifiée",
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
            : "Impossible de charger les tournées."
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
      setToast(`Commande #${reassignTarget.commande.id} déplacée.`)
      setReassignTarget(null)
      setSelectedTourneeId("")
      await loadTournees(false)
    } catch (submitError) {
      setError(
        submitError instanceof ApiError || submitError instanceof Error
          ? submitError.message
          : "Impossible de déplacer la commande."
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
        setToast("Retour dépôt traité : la commande repart dans le prochain lot.")
      } else {
        await annulerAdminAnomalie(token, anomalieId)
        setToast("Retour dépôt traité : commande annulée en perte.")
      }
      setError("")
      await loadTournees(false)
    } catch (resolveError) {
      setError(
        resolveError instanceof ApiError || resolveError instanceof Error
          ? resolveError.message
          : "Impossible de traiter ce retour dépôt."
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
    <div>
      {toast && (
        <div role="status" className="fixed right-5 top-20 z-[70] flex items-center gap-3 rounded-xl border border-[#BFE6C4] bg-white px-4 py-3 text-sm font-semibold text-[var(--adm-green)] shadow-[0_18px_40px_-20px_rgba(22,48,31,0.45)] animate-in fade-in-0 slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}

      <main className="px-4 py-6 lg:px-8 lg:py-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-green)]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Dispatch du {dispatchDateLabel}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--adm-text)] lg:text-[28px]">Tournées du jour</h1>
            <p className="mt-1 max-w-xl text-sm text-[var(--adm-muted)]">
              Suivez les tournées planifiées, déplacez une commande vers un autre livreur et traitez les retours dépôt.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadTournees(false)}
              disabled={isRefreshing || isLoading || isGeneratingDispatch}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--adm-line-strong)] bg-white px-4 text-sm font-semibold text-[var(--adm-text)] transition-colors hover:bg-[var(--adm-green-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4 text-[var(--adm-green)]", isRefreshing && "animate-spin")} />
              Actualiser
            </button>
            <button
              onClick={() => void generateDispatch()}
              disabled={isGeneratingDispatch || isRefreshing || isLoading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--adm-saffron)] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-14px_rgba(240,124,0,0.9)] transition-colors hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingDispatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Générer le dispatch
            </button>
          </div>
        </header>

        <dl className="mb-8 grid grid-cols-3 divide-x divide-[var(--adm-line)] overflow-hidden rounded-xl border border-[var(--adm-line)] bg-white">
          <div className="px-4 py-4 lg:px-6">
            <dt className="text-xs font-medium text-[var(--adm-muted)]">Tournées</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--adm-text)] lg:text-3xl">{tournees.length}</dd>
          </div>
          <div className="px-4 py-4 lg:px-6">
            <dt className="text-xs font-medium text-[var(--adm-muted)]">Commandes assignées</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--adm-text)] lg:text-3xl">{totalCommandes}</dd>
          </div>
          <div className={cn("px-4 py-4 lg:px-6", anomalies.length > 0 && "bg-[#FDF0EE]")}>
            <dt className={cn("text-xs font-medium", anomalies.length > 0 ? "text-[var(--adm-danger)]" : "text-[var(--adm-muted)]")}>Retours dépôt à traiter</dt>
            <dd className={cn("mt-1 text-2xl font-bold tabular-nums lg:text-3xl", anomalies.length > 0 ? "text-[var(--adm-danger)]" : "text-[var(--adm-text)]")}>{anomalies.length}</dd>
          </div>
        </dl>

        {error && (
          <div role="alert" className="mb-6 rounded-xl border border-[#F1C6C1] bg-[#FDF0EE] px-4 py-3 text-sm font-semibold text-[var(--adm-danger)]">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid min-h-[360px] gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Chargement des tournées">
            
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="souki-skeleton h-[340px] rounded-xl" />
            ))}
          </div>
        ) : !hasDispatchData ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-[var(--adm-line-strong)] bg-white/60 p-8 text-center">
            <div>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--adm-green-soft)]"><Package className="h-7 w-7 text-[var(--adm-green)]" /></span>
              <h2 className="mt-4 text-lg font-semibold text-[var(--adm-text)]">
                Aucune commande ou tournée générée pour aujourd'hui.
              </h2>
              <p className="mt-1 text-sm text-[var(--adm-muted)]">
                Le dispatch tourne automatiquement après le JIT de 01h00. Vous pouvez aussi le lancer maintenant.
              </p>
              <button
                onClick={() => void generateDispatch()}
                disabled={isGeneratingDispatch || isRefreshing}
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--adm-saffron)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingDispatch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Générer le dispatch
              </button>
            </div>
          </div>
        ) : (
          <>
            {hasAnomalies && (
              <section className="mb-8 rounded-xl border border-[#F1C6C1] bg-[#FDF5F3] p-4 lg:p-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--adm-danger)]">
                      <AlertTriangle className="h-4 w-4" />
                      Retours dépôt
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--adm-text)]">
                      Marchandise à inspecter avant de replanifier
                    </h2>
                  </div>
                  <span className="inline-flex items-center justify-center rounded-full bg-[var(--adm-danger)] px-3 py-1 text-sm font-semibold tabular-nums text-white">
                    {anomalies.length} à traiter
                  </span>
                </div>

                <div className="adm-stagger grid gap-3 xl:grid-cols-2">
                  {anomalies.map((anomalie) => {
                    const commande = anomalie.commande
                    const produits = commande?.produits || []
                    const isResolving = resolvingAnomalieId === anomalie.id

                    return (
                      <article
                        key={anomalie.id}
                        className="rounded-lg border border-[#F1C6C1] bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[var(--adm-danger)]">
                              Commande N-{anomalie.commande_id}, anomalie {anomalie.id}
                            </p>
                            <h3 className="mt-0.5 text-base font-semibold text-[var(--adm-text)]">
                              {commande?.client_nom || "Client inconnu"}
                            </h3>
                          </div>
                          <span className="rounded-full border border-[#F1C6C1] bg-[#FDF0EE] px-2.5 py-0.5 text-xs font-semibold text-[var(--adm-danger)]">
                            {formatStatus(commande?.statut || "RETOUR_DEPOT")}
                          </span>
                        </div>

                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div className="rounded-md bg-[var(--adm-paper)] px-3 py-2">
                            <dt className="text-xs text-[var(--adm-muted)]">Livreur de la tournée</dt>
                            <dd className="font-semibold text-[var(--adm-text)]">{anomalie.livreur_defaillant?.nom || "Non renseigné"}</dd>
                          </div>
                          <div className="rounded-md bg-[var(--adm-paper)] px-3 py-2">
                            <dt className="text-xs text-[var(--adm-muted)]">Tournée non livrée</dt>
                            <dd className="font-semibold text-[var(--adm-text)]">{formatSimpleDate(anomalie.date_tournee_ratee || anomalie.detected_at)}</dd>
                          </div>
                        </dl>

                        <div className="mt-3">
                          <p className="text-xs text-[var(--adm-muted)]">Produits à inspecter</p>
                          {produits.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {produits.map((produit, index) => (
                                <span
                                  key={`${anomalie.id}-${produit.product_id ?? index}`}
                                  className="rounded-md border border-[var(--adm-line)] bg-white px-2 py-0.5 text-xs font-medium text-[var(--adm-text)]"
                                >
                                  {produit.nom_fr}, {produit.quantite_kg} kg
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-[var(--adm-muted)]">
                              Produits non renseignés.
                            </p>
                          )}
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <button
                            onClick={() => void resolveAnomalie(anomalie.id, "replanifier")}
                            disabled={isResolving}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--adm-green)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Marchandise bonne, replanifier
                          </button>
                          <button
                            onClick={() => void resolveAnomalie(anomalie.id, "annuler")}
                            disabled={isResolving}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#F1C6C1] bg-white px-4 text-sm font-semibold text-[var(--adm-danger)] transition-colors hover:bg-[#FDF0EE] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isResolving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Marchandise périmée, annuler
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )}

            {displayedTournees.length > 0 && totalCommandes > 0 && (
              <div className="adm-stagger flex snap-x gap-4 overflow-x-auto pb-6">
                {displayedTournees.map((tournee) => (
                  <section
                    key={tournee.id}
                    className="flex max-h-[calc(100vh-220px)] min-w-[320px] max-w-[380px] flex-1 snap-start flex-col overflow-hidden rounded-xl border border-[var(--adm-line)] bg-white"
                  >
                    <header className="border-b border-[var(--adm-line)] bg-[var(--adm-paper)]/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[var(--adm-saffron)]">
                            {tournee.tourneeIds.length > 1
                              ? `${tournee.tourneeIds.length} tournées`
                              : `Tournée #${tournee.id}`}
                          </p>
                          <h2 className="mt-0.5 flex items-center gap-2 text-base font-semibold text-[var(--adm-text)]">
                            {tournee.pickup?.shop_name || "Point Souki"}
                          </h2>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--adm-muted)]">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {[tournee.pickup?.address, tournee.pickup?.ville].filter(Boolean).join(", ") ||
                              "Point de ramassage non renseigné"}
                          </p>
                          <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs font-semibold text-[var(--adm-text)] ring-1 ring-[var(--adm-line)]">
                            <Bike className="h-3.5 w-3.5 text-[var(--adm-green)]" />
                            {tournee.livreurNames.join(", ")}
                          </p>
                          {tournee.tourneeIds.length > 1 && (
                            <p className="mt-2 text-xs text-[var(--adm-muted)]">
                              Tournées #{tournee.tourneeIds.join(", #")}
                            </p>
                          )}
                        </div>
                        <span className="flex h-9 min-w-9 flex-col items-center justify-center rounded-lg bg-[var(--adm-green)] px-2 text-sm font-bold tabular-nums text-white" title="Commandes de la tournée">
                          {tournee.commandes.length}
                        </span>
                      </div>
                    </header>

                    <ol className="flex-1 space-y-2 overflow-y-auto p-3">
                      {tournee.commandes.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--adm-line-strong)] p-5 text-center text-sm text-[var(--adm-muted)]">
                Aucune commande assignée.
                        </div>
                      ) : (
                        tournee.commandes.map((commande) => {
                          const canReassign = isCommandeReassignable(commande.statut)

                          return (
                            <li
                              key={commande.id}
                              className="rounded-lg border border-[var(--adm-line)] bg-white p-3 transition-colors hover:border-[var(--adm-line-strong)] hover:bg-[var(--adm-paper)]/50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--adm-text)]">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--adm-ink)] text-[11px] font-bold tabular-nums text-white" title="Ordre de passage">{commande.ordre_passage ?? "–"}</span>
                                    N-{commande.id}
                                  </h3>
                                  <p className="mt-0.5 text-xs text-[var(--adm-muted)]">
                                    Tournée {commandeSourceTourneeIds.get(commande.id) ?? tournee.id}
                                  </p>
                                </div>
                                <span
                                  className={cn(
                                    "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                    getStatusClassName(commande.statut)
                                  )}
                                >
                                  {formatStatus(commande.statut)}
                                </span>
                              </div>

                              <p className="mt-2 text-sm font-medium text-[var(--adm-text)]">
                                {commande.client_nom}
                              </p>
                              <p className="mt-1 flex items-start gap-1.5 text-xs text-[var(--adm-muted)]">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--adm-green)]" />
                                <span>
                                  {commande.adresse?.full_address ||
                                    commande.adresse?.neighborhood ||
                                    "Adresse non renseignée"}
                                </span>
                              </p>

                              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--adm-line)] pt-2">
                                <span className="text-sm font-semibold tabular-nums text-[var(--adm-text)]">
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
                                    className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[#9A5C11] transition-colors hover:bg-[var(--adm-saffron-soft)]"
                                  >
                                    <ArrowLeftRight className="h-3.5 w-3.5" />
                                    Déplacer
                                  </button>
                                )}
                              </div>
                            </li>
                          )
                        })
                      )}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {reassignTarget && (
        <div role="dialog" aria-modal="true" aria-labelledby="reassign-title" className="fixed inset-0 z-[95] flex items-center justify-center bg-[var(--adm-ink)]/50 px-4 backdrop-blur-[2px] animate-in fade-in-0">
          <div className="w-full max-w-lg rounded-xl border border-[var(--adm-line)] bg-white p-6 shadow-[0_30px_80px_-30px_rgba(22,48,31,0.55)] animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="reassign-title" className="text-lg font-semibold text-[var(--adm-text)]">
                  Déplacer la commande N-{reassignTarget.commande.id}
                </h2>
                <p className="mt-1 text-sm text-[var(--adm-muted)]">
                  Choisissez la tournée du jour qui la prendra en charge.
                </p>
              </div>
              <button
                onClick={closeReassignModal}
                aria-label="Fermer" className="rounded-lg p-2 text-[var(--adm-muted)] transition-colors hover:bg-[var(--adm-green-soft)] hover:text-[var(--adm-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-sm font-semibold text-[var(--adm-text)]">
              Nouvelle tournée
              <select
                value={selectedTourneeId}
                onChange={(event) => setSelectedTourneeId(event.target.value)}
                disabled={availableTargetTournees.length === 0}
                className="mt-2 min-h-11 w-full rounded-lg border border-[var(--adm-line-strong)] bg-white px-3 text-[var(--adm-text)] outline-none transition-colors focus:border-[var(--adm-green)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {availableTargetTournees.length === 0 ? (
                  <option value="">Aucune autre tournée disponible</option>
                ) : (
                  availableTargetTournees.map((tournee) => (
                    <option key={tournee.id} value={tournee.id}>
                      Tournée {tournee.id}, {tournee.livreur.nom} ({tournee.commandes.length} commandes)
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeReassignModal}
                className="min-h-11 rounded-lg border border-[var(--adm-line-strong)] px-5 text-sm font-semibold text-[var(--adm-text)] transition-colors hover:bg-[var(--adm-green-soft)]"
              >
                Annuler
              </button>
              <button
                onClick={() => void submitReassign()}
                disabled={!selectedTourneeId || isSubmittingReassign}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--adm-green)] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingReassign && <Loader2 className="h-4 w-4 animate-spin" />}
                Déplacer la commande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
