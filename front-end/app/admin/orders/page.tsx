"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Eye,
  Lock,
  RefreshCw,
  Rocket,
  TriangleAlert,
  Unlock,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  ApiError,
  apiCall,
  type DetailProduitJIT,
  type JITDeverrouillerResponse,
  type JITLogDTO,
  jitAgreger,
  jitDernierLog,
  jitDeverrouiller,
  jitExecuter,
  type ResultatAgregationJIT,
} from "@/lib/api"

const ORDERS_ENDPOINT = "/api/commandes"

type RawRecord = Record<string, unknown>

interface OrderLineLike {
  productName: string
  quantityKg: number | null
}

interface AdminOrderRow {
  id: string
  client: string
  produits: string
  volumeKg: number | null
  montant: number | null
  statut: string
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null
}

function getString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—"
  }

  return `${value.toFixed(2)} DH`
}

function formatWeight(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—"
  }

  return `${value.toFixed(2)} kg`
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return "—"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function normalizeStatus(value: string | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function extractOrderLines(rawOrder: RawRecord): OrderLineLike[] {
  const lines = getArray(rawOrder.lignes ?? rawOrder.lines ?? rawOrder.produits_details)

  return lines
    .map((line) => {
      if (!isRecord(line)) {
        return null
      }

      return {
        productName:
          getString(line.nom_produit) ||
          getString(line.nom_fr) ||
          getString(line.product_name) ||
          getString(line.produit) ||
          "Produit",
        quantityKg:
          getNumber(line.quantite_kg) ??
          getNumber(line.quantite_effective) ??
          getNumber(line.quantite_brute_kg) ??
          getNumber(line.volume_total_kg),
      }
    })
    .filter((line): line is OrderLineLike => line !== null)
}

function summarizeLines(lines: OrderLineLike[]) {
  if (lines.length === 0) {
    return "—"
  }

  return lines
    .map((line) =>
      typeof line.quantityKg === "number"
        ? `${line.productName} (${line.quantityKg.toFixed(2)} kg)`
        : line.productName
    )
    .join(", ")
}

function sumLineWeights(lines: OrderLineLike[]) {
  const total = lines.reduce((sum, line) => sum + (line.quantityKg || 0), 0)
  return total > 0 ? total : null
}

function extractOrdersPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!isRecord(payload)) {
    return []
  }

  const grouped = payload.items ?? payload.commandes ?? payload.orders ?? payload.data
  return Array.isArray(grouped) ? grouped : []
}

function normalizeOrders(payload: unknown): AdminOrderRow[] {
  return extractOrdersPayload(payload)
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      const lines = extractOrderLines(item)
      const fallbackProducts = getArray(item.produits)
        .map((value) => getString(value))
        .filter((value): value is string => Boolean(value))
        .join(", ")

      return {
        id:
          String(
            getNumber(item.id) ??
              getNumber(item.commande_id) ??
              getString(item.id) ??
              getString(item.commande_id) ??
              "—"
          ),
        client:
          getString(item.client) ||
          getString(item.client_nom) ||
          getString(item.client_label) ||
          getString(item.nom_client) ||
          "Client inconnu",
        produits:
          getString(item.produits_label) ||
          getString(item.produits) ||
          fallbackProducts ||
          summarizeLines(lines),
        volumeKg:
          getNumber(item.volume_kg) ??
          getNumber(item.volume_total_kg) ??
          getNumber(item.quantite_totale_kg) ??
          sumLineWeights(lines),
        montant:
          getNumber(item.montant) ??
          getNumber(item.montant_total) ??
          getNumber(item.total) ??
          getNumber(item.total_amount),
        statut:
          getString(item.statut) ||
          getString(item.status) ||
          "en_attente",
      }
    })
    .filter((order): order is AdminOrderRow => order !== null)
}

function normalizeDetailProduit(value: unknown): DetailProduitJIT | null {
  if (!isRecord(value)) {
    return null
  }

  const productId = getNumber(value.product_id)
  const nomFr = getString(value.nom_fr)
  const quantiteBruteKg = getNumber(value.quantite_brute_kg)
  const volumeTotalKg = getNumber(value.volume_total_kg ?? value.volume_final_kg)
  const prixKg = getNumber(value.prix_kg)
  const sousTotal = getNumber(value.sous_total)

  if (
    productId === null ||
    !nomFr ||
    quantiteBruteKg === null ||
    volumeTotalKg === null ||
    prixKg === null ||
    sousTotal === null
  ) {
    return null
  }

  return {
    product_id: productId,
    nom_fr: nomFr,
    nom_darija: getString(value.nom_darija) || "",
    quantite_brute_kg: quantiteBruteKg,
    buffer_perte_10_pct: getNumber(value.buffer_perte_10_pct ?? value.buffer_10_pct) ?? 0,
    volume_total_kg: volumeTotalKg,
    prix_kg: prixKg,
    sous_total: sousTotal,
    unite: getString(value.unite) || "kg",
  }
}

function normalizeLogResult(log: JITLogDTO): ResultatAgregationJIT {
  const details = getArray(log.details_volumes?.produits)
    .map(normalizeDetailProduit)
    .filter((detail): detail is DetailProduitJIT => detail !== null)

  const montantTotal = details.reduce((sum, detail) => sum + detail.sous_total, 0)

  return {
    nombre_commandes: log.nombre_commandes,
    nombre_abonnements: log.nombre_abonnements,
    volume_total_kg: log.volume_total,
    details_produits: details,
    montant_total: Number(montantTotal.toFixed(2)),
    statut: log.statut,
    message: log.message_alerte,
  }
}

function getOrdersErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 404) {
    return `L'endpoint ${ORDERS_ENDPOINT} n'est pas disponible sur le backend actuel.`
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Impossible de charger les commandes du jour."
}

function getUnlockCount(response: JITDeverrouillerResponse) {
  return response.nombre_deverrouillees ?? response.nombre_commandes ?? 0
}

function statusBadge(status: string) {
  const normalized = normalizeStatus(status)

  if (normalized === "en_attente") {
    return {
      label: "en_attente",
      className: "bg-[#F5C400]/20 text-[#B8860B] border-[#F5C400]",
      locked: false,
    }
  }

  if (normalized === "confirmee") {
    return {
      label: "Confirmée",
      className: "bg-[#1A4F8A]/10 text-[#1A4F8A] border-[#1A4F8A]",
      locked: false,
    }
  }

  if (normalized === "verrouillee") {
    return {
      label: "Verrouillée",
      className: "bg-gray-100 text-gray-600 border-gray-300",
      locked: true,
    }
  }

  return {
    label: status || "Inconnu",
    className: "bg-gray-100 text-gray-600 border-gray-300",
    locked: false,
  }
}

function jitLogBadge(status: string) {
  const normalized = normalizeStatus(status)

  if (normalized === "succes") {
    return "bg-[#1E8A3C]/10 text-[#1E8A3C] border-[#1E8A3C]"
  }

  if (normalized === "aucune_commande") {
    return "bg-[#F07C00]/10 text-[#F07C00] border-[#F07C00]"
  }

  return "bg-red-100 text-red-600 border-red-400"
}

function ProductDetailsTable({ details }: { details: DetailProduitJIT[] }) {
  if (details.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-[#8A8A8A]">
        Aucun détail produit disponible.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produit</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Quantité brute</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Buffer 10%</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Volume total</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Prix kg</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Sous-total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {details.map((detail) => (
            <tr key={detail.product_id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="font-medium text-[#3D3D3D]">{detail.nom_fr}</p>
                <p className="text-xs text-[#8A8A8A]">{detail.nom_darija || "—"}</p>
              </td>
              <td className="px-4 py-3 text-[#3D3D3D]">{formatWeight(detail.quantite_brute_kg)}</td>
              <td className="px-4 py-3 text-[#3D3D3D]">{formatWeight(detail.buffer_perte_10_pct)}</td>
              <td className="px-4 py-3 font-semibold text-[#1E8A3C]">{formatWeight(detail.volume_total_kg)}</td>
              <td className="px-4 py-3 text-[#3D3D3D]">{formatMoney(detail.prix_kg)}</td>
              <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(detail.sous_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminOrdersPage() {
  const { token, isLoading: isAuthLoading } = useAuth()
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [isOrdersLoading, setIsOrdersLoading] = useState(true)
  const [lastOrdersRefresh, setLastOrdersRefresh] = useState<string | null>(null)

  const [jitResult, setJitResult] = useState<ResultatAgregationJIT | null>(null)
  const [jitResultSource, setJitResultSource] = useState<"preview" | "execute" | null>(null)
  const [jitFeedback, setJitFeedback] = useState<string | null>(null)
  const [jitError, setJitError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isExecuteLoading, setIsExecuteLoading] = useState(false)
  const [isExecuteDialogOpen, setIsExecuteDialogOpen] = useState(false)

  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [lastUnlockedCount, setLastUnlockedCount] = useState<number | null>(null)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false)

  const [lastLog, setLastLog] = useState<JITLogDTO | null>(null)
  const [logError, setLogError] = useState<string | null>(null)
  const [isLogLoading, setIsLogLoading] = useState(true)
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false)

  async function loadOrders(nextToken: string, showLoader = true, signal?: AbortSignal) {
    if (showLoader) {
      setIsOrdersLoading(true)
    }

    try {
      const payload = await apiCall<unknown>(ORDERS_ENDPOINT, { token: nextToken, signal })
      setOrders(normalizeOrders(payload))
      setOrdersError(null)
      setLastOrdersRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      setOrdersError(getOrdersErrorMessage(error))
      setOrders([])
    } finally {
      if (showLoader) {
        setIsOrdersLoading(false)
      }
    }
  }

  async function loadLastLog(nextToken: string, showLoader = true) {
    if (showLoader) {
      setIsLogLoading(true)
    }

    try {
      const log = await jitDernierLog(nextToken)
      setLastLog(log)
      setLogError(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setLastLog(null)
        setLogError("Aucun log JIT n'est encore disponible.")
      } else {
        setLastLog(null)
        setLogError(error instanceof Error ? error.message : "Impossible de charger le dernier log JIT.")
      }
    } finally {
      if (showLoader) {
        setIsLogLoading(false)
      }
    }
  }

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token) {
      setIsOrdersLoading(false)
      setIsLogLoading(false)
      return
    }

    const controller = new AbortController()
    let intervalId = 0

    void loadOrders(token, true, controller.signal)
    void loadLastLog(token, true)

    intervalId = window.setInterval(() => {
      void loadOrders(token, false)
    }, 30000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [isAuthLoading, token])

  async function handlePreview() {
    if (!token || isPreviewLoading) {
      return
    }

    setIsPreviewLoading(true)
    setJitError(null)
    setJitFeedback(null)

    try {
      const result = await jitAgreger(token)
      setJitResult(result)
      setJitResultSource("preview")
      setJitFeedback(result.message || "Prévisualisation JIT générée avec succès.")
    } catch (error) {
      setJitError(error instanceof Error ? error.message : "Impossible de prévisualiser l'agrégation JIT.")
    } finally {
      setIsPreviewLoading(false)
    }
  }

  async function handleExecute() {
    if (!token || isExecuteLoading) {
      return
    }

    setIsExecuteLoading(true)
    setJitError(null)
    setJitFeedback(null)

    try {
      const log = await jitExecuter(token)
      setJitResult(normalizeLogResult(log))
      setJitResultSource("execute")
      setLastLog(log)
      setLogError(null)
      setJitFeedback(
        normalizeStatus(log.statut) === "succes"
          ? `${log.nombre_commandes} commande(s) verrouillée(s) avec succès.`
          : log.message_alerte || "Exécution JIT terminée."
      )

      await loadOrders(token, false)
      await loadLastLog(token, false)
      setIsExecuteDialogOpen(false)
    } catch (error) {
      setJitError(error instanceof Error ? error.message : "Impossible d'exécuter le job JIT.")
    } finally {
      setIsExecuteLoading(false)
    }
  }

  async function handleUnlock() {
    if (!token || isUnlocking) {
      return
    }

    setIsUnlocking(true)
    setUnlockError(null)
    setUnlockFeedback(null)

    try {
      const response = await jitDeverrouiller(token)
      const count = getUnlockCount(response)
      setLastUnlockedCount(count)
      setUnlockFeedback(response.message || `${count} commande(s) déverrouillée(s).`)
      await loadOrders(token, false)
      setIsUnlockDialogOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setUnlockError("L'endpoint /api/jit/deverrouiller n'est pas disponible sur le backend actuel.")
      } else {
        setUnlockError(error instanceof Error ? error.message : "Impossible de déverrouiller les commandes.")
      }
    } finally {
      setIsUnlocking(false)
    }
  }

  const logDetails = getArray(lastLog?.details_volumes?.produits)
    .map(normalizeDetailProduit)
    .filter((detail): detail is DetailProduitJIT => detail !== null)

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
        <div className="rounded-3xl bg-white shadow-sm border border-gray-100 px-8 py-10 text-center max-w-md">
          <Spinner className="mx-auto mb-4 size-6 text-[#1E8A3C]" />
          <p className="text-sm uppercase tracking-[0.25em] text-[#8A8A8A]">Back-office</p>
          <h1 className="mt-3 text-2xl font-bold text-[#1E8A3C]">Chargement des commandes</h1>
          <p className="mt-3 text-[#6F6F6F]">Nous préparons le tableau de suivi JIT.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-6 h-16 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="flex items-center gap-2 text-[#3D3D3D] hover:text-[#1E8A3C]">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium hidden sm:inline">Retour</span>
            </Link>

            <div className="flex items-center gap-3 min-w-0">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl shadow-sm overflow-hidden flex items-center justify-center bg-white border border-gray-100 p-0.5">
                  <img
                    src="/logo3.png"
                    alt="SOUKI"
                    className="w-[175%] h-full max-w-none object-cover"
                    style={{ objectPosition: "left center" }}
                  />
                </div>
              </Link>
              <div className="w-px h-6 bg-gray-200" />
              <span className="font-bold text-[#1E8A3C] truncate">Pilotage Commandes & JIT</span>
            </div>
          </div>

          <button
            onClick={() => {
              if (token) {
                void loadOrders(token, true)
                void loadLastLog(token, true)
              }
            }}
            className="px-4 py-2 bg-[#F07C00] text-white rounded-xl font-medium flex items-center gap-2 hover:bg-[#D66B00] disabled:opacity-70"
            disabled={!token || isOrdersLoading || isLogLoading}
          >
            {isOrdersLoading || isLogLoading ? <Spinner className="size-4" /> : <RefreshCw className="w-4 h-4" />}
            Actualiser
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        <section className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Commandes du jour</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Auto-refresh toutes les 30 secondes
                {lastOrdersRefresh ? ` • Dernière mise à jour ${lastOrdersRefresh}` : ""}
              </p>
            </div>

            <div className="px-4 py-2 bg-[#F0FAF1] rounded-xl">
              <p className="text-sm text-[#8A8A8A]">Commandes visibles</p>
              <p className="text-2xl font-bold text-[#1E8A3C]">{orders.length}</p>
            </div>
          </div>

          {ordersError && (
            <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {ordersError}
            </div>
          )}

          {isOrdersLoading ? (
            <div className="px-6 py-12 text-center">
              <Spinner className="mx-auto size-6 text-[#1E8A3C]" />
              <p className="mt-3 text-sm text-[#8A8A8A]">Chargement des commandes en cours…</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-lg font-semibold text-[#3D3D3D]">Aucune commande à afficher.</p>
              <p className="mt-2 text-sm text-[#8A8A8A]">
                La liste dépend du backend admin et sera actualisée automatiquement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produits</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Volume kg</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => {
                    const badge = statusBadge(order.statut)

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-[#1E8A3C]">{order.id}</td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{order.client}</td>
                        <td className="px-6 py-4 text-sm text-[#8A8A8A] max-w-[320px] whitespace-normal">{order.produits}</td>
                        <td className="px-6 py-4 text-[#3D3D3D]">{formatWeight(order.volumeKg)}</td>
                        <td className="px-6 py-4 font-semibold text-[#F07C00]">{formatMoney(order.montant)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                              badge.className
                            )}
                          >
                            {badge.locked && <Lock className="w-3 h-3" />}
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Agrégation JIT</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Prévisualisez l&apos;agrégation ou lancez le verrouillage immédiat des commandes.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handlePreview()}
                disabled={!token || isPreviewLoading || isExecuteLoading}
                className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-70 flex items-center gap-2"
              >
                {isPreviewLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <Eye className="w-4 h-4 text-[#1A4F8A]" />}
                👁 Prévisualiser
              </button>

              <AlertDialog open={isExecuteDialogOpen} onOpenChange={setIsExecuteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={!token || isPreviewLoading || isExecuteLoading}
                    className="px-4 py-2 bg-[#1E8A3C] text-white rounded-xl font-medium hover:bg-[#176B2E] disabled:opacity-70 flex items-center gap-2"
                  >
                    {isExecuteLoading ? <Spinner className="size-4" /> : <Rocket className="w-4 h-4" />}
                    🚀 Lancer le JIT maintenant
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer l&apos;exécution JIT</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action agrège les commandes en attente, verrouille les commandes confirmées
                      et enregistre un log JIT.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(event) => {
                        event.preventDefault()
                        void handleExecute()
                      }}
                      className="rounded-xl bg-[#1E8A3C] hover:bg-[#176B2E]"
                    >
                      {isExecuteLoading ? <Spinner className="size-4" /> : <Rocket className="w-4 h-4" />}
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {jitError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {jitError}
            </div>
          )}

          {jitFeedback && (
            <div className="mb-4 rounded-xl border border-[#4CB84A]/20 bg-[#F0FAF1] px-4 py-3 text-sm text-[#1E8A3C]">
              {jitFeedback}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-[#F0FAF1] rounded-xl">
              <p className="text-sm text-[#8A8A8A]">Commandes verrouillées</p>
              <p className="mt-2 text-3xl font-bold text-[#1E8A3C]">
                {jitResultSource === "execute" && jitResult ? jitResult.nombre_commandes : "—"}
              </p>
            </div>

            <div className="p-4 bg-[#F07C00]/5 rounded-xl">
              <p className="text-sm text-[#8A8A8A]">Volume agrégé</p>
              <p className="mt-2 text-3xl font-bold text-[#F07C00]">
                {jitResult ? formatWeight(jitResult.volume_total_kg) : "—"}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-[#8A8A8A]">Montant estimé</p>
              <p className="mt-2 text-3xl font-bold text-[#3D3D3D]">
                {jitResult ? formatMoney(jitResult.montant_total) : "—"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#3D3D3D]">Détail par produit</h3>
                <p className="text-sm text-[#8A8A8A]">
                  {jitResultSource === "preview" && "Résultat de la prévisualisation"}
                  {jitResultSource === "execute" && "Résultat de la dernière exécution JIT"}
                  {!jitResultSource && "Aucun résultat JIT disponible pour le moment"}
                </p>
              </div>

              {jitResult && (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                    jitLogBadge(jitResult.statut)
                  )}
                >
                  {jitResult.statut}
                </span>
              )}
            </div>

            <div className="p-4">
              <ProductDetailsTable details={jitResult?.details_produits || []} />
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Déverrouillage JIT</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Permet d&apos;annuler le verrouillage JIT si une correction opérationnelle est nécessaire.
              </p>
            </div>

            <AlertDialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
              <AlertDialogTrigger asChild>
                <button
                  disabled={!token || isUnlocking}
                  className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-70 flex items-center gap-2"
                >
                  {isUnlocking ? <Spinner className="size-4 text-[#1E8A3C]" /> : <Unlock className="w-4 h-4 text-[#F07C00]" />}
                  🔓 Déverrouiller
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer le déverrouillage</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est destructive du point de vue opérationnel. Utilisez-la uniquement si vous
                    devez rouvrir les commandes verrouillées par erreur.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault()
                      void handleUnlock()
                    }}
                    className="rounded-xl bg-[#F07C00] hover:bg-[#D66B00]"
                  >
                    {isUnlocking ? <Spinner className="size-4" /> : <Unlock className="w-4 h-4" />}
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {unlockError && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {unlockError}
            </div>
          )}

          {(unlockFeedback || lastUnlockedCount !== null) && !unlockError && (
            <div className="mt-6 rounded-xl border border-[#4CB84A]/20 bg-[#F0FAF1] px-4 py-4">
              <p className="text-sm text-[#8A8A8A]">Commandes rouvertes</p>
              <p className="mt-2 text-3xl font-bold text-[#1E8A3C]">{lastUnlockedCount ?? 0}</p>
              {unlockFeedback && <p className="mt-2 text-sm text-[#1E8A3C]">{unlockFeedback}</p>}
            </div>
          )}

          {!unlockFeedback && lastUnlockedCount === null && !unlockError && (
            <div className="mt-6 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-[#8A8A8A]">
              Aucune action de déverrouillage n&apos;a encore été lancée.
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Dernier log JIT</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Suivi du dernier cycle JIT exécuté depuis le back-office.
              </p>
            </div>

            <button
              onClick={() => setIsLogDialogOpen(true)}
              disabled={!lastLog}
              className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4 text-[#1A4F8A]" />
              Voir le détail
            </button>
          </div>

          {logError && (
            <div className="rounded-xl border border-[#F07C00]/20 bg-[#F07C00]/5 px-4 py-3 text-sm text-[#B15B00]">
              {logError}
            </div>
          )}

          {isLogLoading ? (
            <div className="py-10 text-center">
              <Spinner className="mx-auto size-6 text-[#1E8A3C]" />
              <p className="mt-3 text-sm text-[#8A8A8A]">Chargement du log JIT…</p>
            </div>
          ) : lastLog ? (
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-[#8A8A8A]">Date</p>
                <p className="mt-2 font-semibold text-[#3D3D3D]">{formatDateTime(lastLog.date_execution)}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-[#8A8A8A]">Statut</p>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                    jitLogBadge(lastLog.statut)
                  )}
                >
                  {lastLog.statut}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-[#8A8A8A]">Nb commandes</p>
                <p className="mt-2 text-2xl font-bold text-[#1E8A3C]">{lastLog.nombre_commandes}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-[#8A8A8A]">Volume total</p>
                <p className="mt-2 text-2xl font-bold text-[#F07C00]">{formatWeight(lastLog.volume_total)}</p>
              </div>
            </div>
          ) : null}

          {lastLog?.message_alerte && (
            <div className="mt-4 rounded-xl border border-[#F5C400]/30 bg-[#F5C400]/10 px-4 py-3 text-sm text-[#8B6A00] flex items-start gap-3">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{lastLog.message_alerte}</span>
            </div>
          )}
        </section>

        <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
          <DialogContent className="max-w-4xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Détails du dernier log JIT</DialogTitle>
              <DialogDescription>
                Produits agrégés depuis <span className="font-medium text-[#3D3D3D]">{formatDateTime(lastLog?.date_execution)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
              <ProductDetailsTable details={logDetails} />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
