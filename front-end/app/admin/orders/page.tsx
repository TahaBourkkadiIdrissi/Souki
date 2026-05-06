"use client"

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle2,
  ClipboardList,
  Eye,
  Lock,
  Package,
  PhoneCall,
  RefreshCw,
  Rocket,
  Search,
  Scale,
  TriangleAlert,
  Unlock,
  User,
  XCircle,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import {
  ApiError,
  apiCall,
  batchConfirmationCOD,
  getAlerteCOD18h,
  getCommandesCODVerouillees,
  getFicheClient,
  updateConfirmationCOD,
  type AlerteCOD18hDTO,
  type CommandeCODDemainDTO,
  type CommandeHistoriqueDTO,
  type DetailProduitJIT,
  type FicheClientDTO,
  type JITCommandeDeverrouillee,
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
  clientId: number | null
  dateCommande: string | null
  client: string
  clientPhone: string | null
  produits: string
  volumeKg: number | null
  montant: number | null
  modePaiement: string | null
  statut: string
  creneauLivraison: string | null
  isBlacklisted: boolean | null
}

interface ClientGroupDTO {
  key: string
  clientId: number | null
  client: string
  clientPhone: string | null
  commandes: AdminOrderRow[]
  volumeTotal: number
  montantTotal: number
  isBlacklisted: boolean | null
}

interface CODClientGroupDTO {
  key: string
  clientId: number | null
  client: string
  telephone: string | null
  adresse: string | null
  commandes: CommandeCODDemainDTO[]
  montantTotal: number
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

function getBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "oui", "yes"].includes(normalized)) {
      return true
    }
    if (["false", "0", "non", "no"].includes(normalized)) {
      return false
    }
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

function formatDateTime(value: string | null | undefined) {
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

function formatShortDateTime(value: string | null | undefined) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getCasablancaHour(value = new Date()) {
  const hour = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Africa/Casablanca",
  }).format(value)

  return Number(hour)
}

function normalizeStatus(value: string | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function extractOrderLines(rawOrder: RawRecord): OrderLineLike[] {
  const lines = getArray(rawOrder.produits ?? rawOrder.lignes ?? rawOrder.lines ?? rawOrder.produits_details)

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
        clientId:
          getNumber(item.client_id) ??
          getNumber(item.clientId) ??
          getNumber(item.user_id) ??
          getNumber(item.userId),
        dateCommande: getString(item.date_commande),
        client:
          getString(item.client) ||
          getString(item.client_nom) ||
          getString(item.client_label) ||
          getString(item.nom_client) ||
          "Client inconnu",
        clientPhone:
          getString(item.client_phone) ||
          getString(item.phone) ||
          getString(item.telephone),
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
        modePaiement:
          getString(item.mode_paiement) ||
          getString(item.modePaiement) ||
          getString(item.payment_method),
        statut:
          getString(item.statut) ||
          getString(item.status) ||
          "en_attente",
        creneauLivraison:
          getString(item.creneau_livraison) ||
          getString(item.delivery_slot),
        isBlacklisted: getBoolean(item.is_blacklisted),
      }
    })
    .filter((order): order is AdminOrderRow => order !== null)
    .filter((order) => normalizeStatus(order.statut) !== "brouillon")
}

function groupOrdersByClient(orders: AdminOrderRow[]): ClientGroupDTO[] {
  const groupes = orders.reduce((acc, order) => {
    const key = order.clientId !== null ? `client-${order.clientId}` : order.client

    if (!acc[key]) {
      acc[key] = {
        key,
        clientId: order.clientId,
        client: order.client,
        clientPhone: order.clientPhone,
        commandes: [],
        volumeTotal: 0,
        montantTotal: 0,
        isBlacklisted: order.isBlacklisted,
      }
    }

    acc[key].commandes.push(order)
    acc[key].volumeTotal += order.volumeKg || 0
    acc[key].montantTotal += order.montant || 0
    acc[key].isBlacklisted = acc[key].isBlacklisted || order.isBlacklisted

    return acc
  }, {} as Record<string, ClientGroupDTO>)

  return Object.values(groupes)
}

function getCodClientKey(order: CommandeCODDemainDTO) {
  if (typeof order.client_id === "number") {
    return `client-${order.client_id}`
  }

  const phone = getString(order.telephone)
  if (phone) {
    return `phone-${phone}`
  }

  return `client-${getString(order.nom_client) || "inconnu"}-${getString(order.adresse) || "sans-adresse"}`
}

function groupCodOrdersByClient(orders: CommandeCODDemainDTO[]): CODClientGroupDTO[] {
  const groupes = orders.reduce((acc, order) => {
    const key = getCodClientKey(order)

    if (!acc[key]) {
      acc[key] = {
        key,
        clientId: typeof order.client_id === "number" ? order.client_id : null,
        client: getString(order.nom_client) || "Client inconnu",
        telephone: getString(order.telephone),
        adresse: getString(order.adresse),
        commandes: [],
        montantTotal: 0,
      }
    }

    acc[key].commandes.push(order)
    acc[key].montantTotal += order.montant || 0

    return acc
  }, {} as Record<string, CODClientGroupDTO>)

  return Object.values(groupes)
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
      label: "En attente",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      locked: false,
    }
  }

  if (normalized === "confirmee") {
    return {
      label: "Confirmee",
      className: "bg-blue-50 text-blue-800 border-blue-200",
      locked: false,
    }
  }

  if (normalized === "verrouillee") {
    return {
      label: "Verrouillee",
      className: "bg-slate-100 text-slate-800 border-slate-200",
      locked: true,
    }
  }

  if (normalized === "a_livrer") {
    return {
      label: "A livrer",
      className: "bg-indigo-50 text-indigo-900 border-indigo-200",
      locked: false,
    }
  }

  if (normalized === "en_route") {
    return {
      label: "En route",
      className: "bg-violet-50 text-violet-900 border-violet-200",
      locked: false,
    }
  }

  if (normalized === "livre" || normalized === "livree") {
    return {
      label: "Livre",
      className: "bg-emerald-50 text-emerald-900 border-emerald-200",
      locked: false,
    }
  }

  if (normalized === "absent") {
    return {
      label: "Absent",
      className: "bg-orange-50 text-orange-900 border-orange-200",
      locked: false,
    }
  }

  if (normalized === "annulee" || normalized === "annule") {
    return {
      label: "Annulee",
      className: "bg-red-50 text-red-900 border-red-200",
      locked: false,
    }
  }

  return {
    label: status || "Inconnu",
    className: "bg-gray-50 text-gray-700 border-gray-200",
    locked: false,
  }
}

function codConfirmationBadge(status: string) {
  const normalized = normalizeStatus(status).toUpperCase()

  if (normalized === "CONFIRMEE_PAR_APPEL") {
    return {
      label: "Confirmee par appel",
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    }
  }

  if (normalized === "ANNULEE") {
    return {
      label: "Annulee",
      className: "bg-red-50 text-red-800 border-red-200",
    }
  }

  return {
    label: "Non confirmee",
    className: "bg-amber-50 text-amber-800 border-amber-200 animate-pulse",
  }
}

function paiementBadge(modePaiement: string | null | undefined) {
  const normalized = normalizeStatus(modePaiement || "")

  if (normalized === "cod") {
    return {
      label: "COD",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      dotClassName: "bg-amber-500",
    }
  }

  if (normalized === "cmi") {
    return {
      label: "CMI",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      dotClassName: "bg-blue-500",
    }
  }

  if (normalized === "wallet") {
    return {
      label: "Wallet",
      className: "bg-violet-50 text-violet-700 border-violet-200",
      dotClassName: "bg-violet-500",
    }
  }

  if (normalized === "cash") {
    return {
      label: "Cash",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotClassName: "bg-emerald-500",
    }
  }

  return {
    label: "N/A",
    className: "bg-gray-50 text-gray-600 border-gray-200",
    dotClassName: "bg-gray-400",
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

function DashboardStatCard({
  icon: Icon,
  label,
  value,
  tone = "green",
  helper,
}: {
  icon: typeof Package
  label: string
  value: string | number
  tone?: "green" | "orange" | "blue" | "slate"
  helper?: string
}) {
  const toneClasses = {
    green: "bg-emerald-50 text-[#1E8A3C] border-emerald-100",
    orange: "bg-orange-50 text-[#F07C00] border-orange-100",
    blue: "bg-blue-50 text-[#1A4F8A] border-blue-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-gray-950">{value}</p>
          {helper ? <p className="mt-1 text-xs text-gray-400">{helper}</p> : null}
        </div>
        <div className={cn("rounded-xl border p-2.5", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function SectionShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm", className)}>
      {children}
    </section>
  )
}

function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-9 rounded-xl bg-gray-200" />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]">
        <ClipboardList className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{description}</p>
    </div>
  )
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
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Unit&eacute;</th>
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
              <td className="px-4 py-3 text-[#3D3D3D]">{detail.unite}</td>
              <td className="px-4 py-3 text-[#3D3D3D]">{formatMoney(detail.prix_kg)}</td>
              <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(detail.sous_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JITLogDetailsTable({ log }: { log: JITLogDTO | null }) {
  if (!Array.isArray(log?.details_volumes?.produits) || log.details_volumes.produits.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-[#8A8A8A]">
        Aucun détail disponible
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produit</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Quantité brute</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Buffer 10%</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Volume final</th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Unité</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {log.details_volumes?.produits?.map((produit, index) => {
            const detail = normalizeDetailProduit(produit)
            if (!detail) {
              return null
            }

            return (
              <tr key={`${detail.product_id}-${index}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-[#8A8A8A] max-w-[320px] whitespace-normal">{detail.nom_fr}</td>
                <td className="px-6 py-4 text-[#3D3D3D]">{formatWeight(detail.quantite_brute_kg)}</td>
                <td className="px-6 py-4 text-[#3D3D3D]">{formatWeight(detail.buffer_perte_10_pct)}</td>
                <td className="px-6 py-4 font-semibold text-[#1E8A3C]">{formatWeight(detail.volume_total_kg)}</td>
                <td className="px-6 py-4 text-[#3D3D3D]">{detail.unite}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function UnlockDetailsTable({ details }: { details: JITCommandeDeverrouillee[] }) {
  if (details.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-[#8A8A8A]">
        Aucun detail de deverrouillage disponible.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">ID commande</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Avant</th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Apres</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {details.map((detail) => {
            const beforeBadge = statusBadge(detail.statut_avant || "")
            const afterBadge = statusBadge(detail.statut_apres || "")

            return (
              <tr key={detail.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-[#1E8A3C]">{detail.id}</td>
                <td className="px-4 py-3 text-sm text-[#3D3D3D]">{formatShortDateTime(detail.date_commande)}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium", beforeBadge.className)}>
                    {beforeBadge.locked && <Lock className="w-3 h-3" />}
                    {beforeBadge.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium", afterBadge.className)}>
                    {afterBadge.locked && <Lock className="w-3 h-3" />}
                    {afterBadge.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

type ClientBlockKey =
  | "identity"
  | "orders"
  | "voice"
  | "sessions"
  | "notifications"
  | "subscription"
  | "payments"

function emptyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Aucune donnée disponible"
  }

  return String(value)
}

function formatBool(value: boolean | null | undefined) {
  if (value === null || value === undefined) {
    return "Aucune donnée disponible"
  }

  return value ? "Oui" : "Non"
}

function ClientInfoGrid({ items }: { items: { label: string; value: string | number | null | undefined }[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-[#8A8A8A]">{item.label}</p>
          <p className="mt-1 text-sm font-medium text-[#3D3D3D]">{emptyValue(item.value)}</p>
        </div>
      ))}
    </div>
  )
}

function EmptyClientBlock() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-[#8A8A8A]">
      Aucune donnée disponible
    </div>
  )
}

function ClientSheetBlock({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  count?: number
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-gray-50"
      >
        <span className="font-semibold text-[#3D3D3D]">
          {title}
          {typeof count === "number" ? <span className="ml-2 text-sm font-normal text-[#8A8A8A]">({count})</span> : null}
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 text-[#8A8A8A]" /> : <ChevronDown className="w-4 h-4 text-[#8A8A8A]" />}
      </button>

      {isOpen && <div className="border-t border-gray-100 p-4">{children}</div>}
    </div>
  )
}

function CommandeClientCard({ commande }: { commande: CommandeHistoriqueDTO }) {
  const badge = statusBadge(commande.statut || "")

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[#1E8A3C]">Commande #{commande.id}</p>
          <p className="text-sm text-[#8A8A8A]">{formatShortDateTime(commande.date_commande)}</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium", badge.className)}>
          {badge.locked && <Lock className="w-3 h-3" />}
          {badge.label}
        </span>
      </div>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Montant</p>
          <p className="font-semibold text-[#F07C00]">{formatMoney(commande.montant_total)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Paiement</p>
          <p className="font-medium text-[#3D3D3D]">{emptyValue(commande.mode_paiement)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">Validé</p>
          <p className="font-medium text-[#3D3D3D]">{formatBool(commande.payment_validated)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-xs uppercase text-[#8A8A8A]">À encaisser</p>
          <p className="font-semibold text-[#3D3D3D]">{formatMoney(commande.montant_a_encaisser)}</p>
        </div>
      </div>

      <ClientInfoGrid
        items={[
          { label: "Créneau", value: commande.creneau_livraison },
          { label: "En route", value: formatShortDateTime(commande.enroute_at) },
          { label: "Livrée", value: formatShortDateTime(commande.delivered_at) },
          { label: "Absent", value: formatShortDateTime(commande.absent_at) },
        ]}
      />

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-[#8A8A8A]">Produits</p>
        {commande.produits.length === 0 ? (
          <EmptyClientBlock />
        ) : (
          <div className="flex flex-wrap gap-2">
            {commande.produits.map((produit, index) => (
              <span key={`${produit.nom_fr}-${index}`} className="rounded-full border border-[#1E8A3C]/20 bg-[#F0FAF1] px-3 py-1 text-xs font-medium text-[#1E8A3C]">
                {produit.nom_fr} · {formatWeight(produit.quantite_kg)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FicheClientPanel({
  fiche,
  openBlocks,
  onToggleBlock,
}: {
  fiche: FicheClientDTO
  openBlocks: Record<string, boolean>
  onToggleBlock: (blockKey: ClientBlockKey) => void
}) {
  const blockOrder: ClientBlockKey[] = ["identity", "orders", "voice", "sessions", "notifications", "subscription"]
  const activeBlock = blockOrder.find((blockKey) => openBlocks[`${fiche.id}:${blockKey}`]) || "identity"
  const paiements = fiche.commandes.filter((commande) => commande.paiement)

  return (
    <div className="rounded-2xl border border-[#1E8A3C]/20 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1E8A3C]">Fiche client</p>
          <h3 className="mt-1 text-base font-bold text-gray-950">Client #{fiche.id}</h3>
          <p className="mt-1 text-sm text-gray-500">{fiche.email || fiche.phone || "Aucune donnee disponible"}</p>
        </div>
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", fiche.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-gray-50 text-gray-600")}>
          {fiche.is_active ? "Actif" : "Inactif"}
        </span>
      </div>

      <Tabs defaultValue={activeBlock} onValueChange={(value) => onToggleBlock(value as ClientBlockKey)} className="p-5">
        <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-2 rounded-xl bg-gray-100 p-1">
          <TabsTrigger value="identity" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Identite</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Commandes</TabsTrigger>
          <TabsTrigger value="voice" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Vocal</TabsTrigger>
          <TabsTrigger value="sessions" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Sessions</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Notifs</TabsTrigger>
          <TabsTrigger value="subscription" className="rounded-lg px-3 py-2 text-xs data-[state=active]:bg-white data-[state=active]:text-[#1E8A3C]">Abonnement</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          <ClientInfoGrid
            items={[
              { label: "Email", value: fiche.email },
              { label: "Telephone", value: fiche.phone },
              { label: "Inscription", value: formatDateTime(fiche.created_at) },
              { label: "Derniere connexion", value: formatDateTime(fiche.last_login_at) },
              { label: "Provider", value: fiche.auth_provider },
              { label: "Email verifie", value: formatBool(fiche.is_email_verified) },
              { label: "Telephone verifie", value: formatBool(fiche.is_phone_verified) },
              { label: "Blacklisted", value: formatBool(fiche.is_blacklisted) },
            ]}
          />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Adresses</p>
            {(fiche.adresses || []).length === 0 ? (
              <EmptyClientBlock />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(fiche.adresses || []).map((adresse, index) => (
                  <div key={`${adresse.neighborhood || "adresse"}-${index}`} className="rounded-xl border border-gray-100 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-950">
                        {[adresse.neighborhood, adresse.street, adresse.ville].filter(Boolean).join(", ") || "Adresse sans libelle"}
                      </p>
                      {adresse.is_default ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                          Principale
                        </span>
                      ) : null}
                    </div>
                    {adresse.details ? <p className="mt-1 text-sm text-gray-500">{adresse.details}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          {fiche.commandes.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            <div className="grid gap-3">
              {fiche.commandes.map((commande) => (
                <CommandeClientCard key={commande.id} commande={commande} />
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Paiements</p>
            {paiements.length === 0 ? (
              <EmptyClientBlock />
            ) : (
              <div className="space-y-3">
                {paiements.map((commande) => (
                  <ClientInfoGrid
                    key={`paiement-${commande.id}`}
                    items={[
                      { label: "Commande", value: `#${commande.id}` },
                      { label: "Methode", value: commande.paiement?.methode },
                      { label: "Montant", value: formatMoney(commande.paiement?.montant) },
                      { label: "Valide", value: formatBool(commande.paiement?.valide) },
                      { label: "Frais CMI", value: formatMoney(commande.paiement?.frais_cmi) },
                      { label: "Montant net", value: formatMoney(commande.paiement?.montant_net) },
                    ]}
                  />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-3">
          {fiche.commandes_vocales.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            fiche.commandes_vocales.map((commande) => (
              <div key={commande.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="font-semibold text-[#1E8A3C]">Commande vocale #{commande.id}</p>
                <p className="text-sm text-gray-500">{formatShortDateTime(commande.created_at)} - {emptyValue(commande.langue_detectee)}</p>
                <p className="mt-2 text-sm text-gray-700">{emptyValue(commande.transcription_brute)}</p>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3">
          {fiche.sessions.length === 0 ? (
            <EmptyClientBlock />
          ) : (
            fiche.sessions.map((session, index) => (
              <ClientInfoGrid
                key={`${session.ip || "session"}-${index}`}
                items={[
                  { label: "Appareil", value: session.device_name },
                  { label: "Navigateur", value: session.browser },
                  { label: "Localisation", value: session.location },
                  { label: "IP", value: session.ip },
                  { label: "Derniere activite", value: formatDateTime(session.last_active) },
                  { label: "Creee le", value: formatDateTime(session.created_at) },
                  { label: "Active", value: formatBool(session.is_active) },
                ]}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="notifications">
          {!fiche.notifications ? (
            <EmptyClientBlock />
          ) : (
            <ClientInfoGrid
              items={[
                { label: "Email", value: formatBool(fiche.notifications.email) },
                { label: "Push", value: formatBool(fiche.notifications.push) },
                { label: "SMS", value: formatBool(fiche.notifications.sms) },
                { label: "Commandes", value: formatBool(fiche.notifications.order_updates) },
                { label: "Promotions", value: formatBool(fiche.notifications.promotions) },
                { label: "Newsletter", value: formatBool(fiche.notifications.newsletter) },
              ]}
            />
          )}
        </TabsContent>

        <TabsContent value="subscription">
          {!fiche.abonnement ? (
            <EmptyClientBlock />
          ) : (
            <ClientInfoGrid
              items={[
                { label: "Poids garanti", value: fiche.abonnement.poids_garanti !== null && fiche.abonnement.poids_garanti !== undefined ? formatWeight(fiche.abonnement.poids_garanti) : null },
                { label: "Frequence", value: fiche.abonnement.frequence },
                { label: "Mensuel", value: fiche.abonnement.montant_mensuel !== null && fiche.abonnement.montant_mensuel !== undefined ? formatMoney(fiche.abonnement.montant_mensuel) : null },
                { label: "Actif", value: formatBool(fiche.abonnement.actif) },
              ]}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
export default function AdminOrdersPage() {
  const { token, isLoading: isAuthLoading } = useAuth()
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [isOrdersLoading, setIsOrdersLoading] = useState(true)
  const [lastOrdersRefresh, setLastOrdersRefresh] = useState<string | null>(null)
  const [codOrders, setCodOrders] = useState<CommandeCODDemainDTO[]>([])
  const [codSearch, setCodSearch] = useState("")
  const [codStatusFilter, setCodStatusFilter] = useState("tous")
  const [codError, setCodError] = useState<string | null>(null)
  const [codFeedback, setCodFeedback] = useState<string | null>(null)
  const [isCodLoading, setIsCodLoading] = useState(true)
  const [codActionId, setCodActionId] = useState<number | null>(null)
  const [codGroupActionKey, setCodGroupActionKey] = useState<string | null>(null)
  const [codAlerte18h, setCodAlerte18h] = useState<AlerteCOD18hDTO | null>(null)
  const [pendingCodCancellation, setPendingCodCancellation] = useState<{
    commande_ids: number[]
    montant_total: number
    nb_commandes: number
  } | null>(null)
  const [isCodCancellationSubmitting, setIsCodCancellationSubmitting] = useState(false)

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
  const [lastUnlockedDetails, setLastUnlockedDetails] = useState<JITCommandeDeverrouillee[]>([])
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false)
  const [isUnlockDetailsOpen, setIsUnlockDetailsOpen] = useState(false)

  const [lastLog, setLastLog] = useState<JITLogDTO | null>(null)
  const [logError, setLogError] = useState<string | null>(null)
  const [isLogLoading, setIsLogLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [openClientId, setOpenClientId] = useState<number | null>(null)
  const [openOrdersClientKey, setOpenOrdersClientKey] = useState<string | null>(null)
  const [openCodClientKey, setOpenCodClientKey] = useState<string | null>(null)
  const [clientSheets, setClientSheets] = useState<Record<number, FicheClientDTO>>({})
  const [clientSheetErrors, setClientSheetErrors] = useState<Record<number, string>>({})
  const [clientSheetLoadingId, setClientSheetLoadingId] = useState<number | null>(null)
  const [openClientBlocks, setOpenClientBlocks] = useState<Record<string, boolean>>({})
  const [activeSection, setActiveSection] = useState<"overview" | "commandes" | "jit" | "cod" | "logs">("overview")
  const [ordersSearch, setOrdersSearch] = useState("")
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("tous")

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

  async function loadCodOrders(nextToken: string, showLoader = true, signal?: AbortSignal) {
    if (showLoader) {
      setIsCodLoading(true)
    }

    try {
      const payload = await getCommandesCODVerouillees(nextToken, signal)
      setCodOrders(payload)
      setCodError(null)
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return
      }

      setCodError(error instanceof Error ? error.message : "Impossible de charger les commandes COD.")
      setCodOrders([])
    } finally {
      if (showLoader) {
        setIsCodLoading(false)
      }
    }
  }

  async function loadAlerteCOD18h(nextToken: string) {
    try {
      const payload = await getAlerteCOD18h(nextToken)
      setCodAlerte18h(payload)
    } catch {
      setCodAlerte18h(null)
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

  async function handleToggleClientSheet(order: AdminOrderRow) {
    if (!token || !order.clientId) {
      return
    }

    const clientId = order.clientId

    if (openClientId === clientId) {
      setOpenClientId(null)
      return
    }

    setOpenClientId(clientId)

    if (clientSheets[clientId]) {
      return
    }

    setClientSheetLoadingId(clientId)
    setClientSheetErrors((current) => ({ ...current, [clientId]: "" }))

    try {
      const fiche = await getFicheClient(token, clientId)
      setClientSheets((current) => ({ ...current, [clientId]: fiche }))
    } catch (error) {
      setClientSheetErrors((current) => ({
        ...current,
        [clientId]: error instanceof Error ? error.message : "Impossible de charger la fiche client.",
      }))
    } finally {
      setClientSheetLoadingId(null)
    }
  }

  function toggleClientBlock(clientId: number, blockKey: ClientBlockKey) {
    const key = `${clientId}:${blockKey}`
    setOpenClientBlocks((current) => ({ ...current, [key]: !(current[key] ?? blockKey === "identity") }))
  }

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token) {
      setIsOrdersLoading(false)
      setIsLogLoading(false)
      setIsCodLoading(false)
      setCodAlerte18h(null)
      return
    }

    const controller = new AbortController()
    let intervalId = 0
    let alertIntervalId = 0

    void loadOrders(token, true, controller.signal)
    void loadCodOrders(token, true, controller.signal)
    void loadAlerteCOD18h(token)
    void loadLastLog(token, true)

    intervalId = window.setInterval(() => {
      void loadOrders(token, false)
      void loadCodOrders(token, false)
    }, 30000)
    alertIntervalId = window.setInterval(() => {
      void loadAlerteCOD18h(token)
    }, 300000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
      window.clearInterval(alertIntervalId)
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

    if (hasLockedOrdersToday) {
      setJitError("Le JIT du jour est deja lance. Deverrouillez les commandes avant de le relancer.")
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
      setLastUnlockedDetails(response.commandes || [])
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

  async function handleCodConfirmation(
    commandeId: number,
    statut: "CONFIRMEE_PAR_APPEL" | "ANNULEE"
  ) {
    if (statut === "ANNULEE") {
      const order = codOrders.find((item) => item.id === commandeId)
      if (order) {
        openCodCancellation([order])
      }
      return
    }

    if (!token || codActionId !== null || codGroupActionKey !== null || isCodCancellationSubmitting) {
      return
    }

    setCodActionId(commandeId)
    setCodError(null)
    setCodFeedback(null)

    try {
      const response = await updateConfirmationCOD(token, commandeId, statut)
      setCodOrders((current) =>
        current.map((order) =>
          order.id === commandeId
            ? { ...order, statut_confirmation_cod: response.statut_confirmation_cod }
            : order
        )
      )
      setCodFeedback(response.message)
      await loadOrders(token, false)
    } catch (error) {
      setCodError(error instanceof Error ? error.message : "Impossible de mettre a jour la confirmation COD.")
    } finally {
      setCodActionId(null)
    }
  }

  function openCodCancellation(commandes: CommandeCODDemainDTO[]) {
    const targets = commandes.filter(
      (order) => normalizeStatus(order.statut_confirmation_cod).toUpperCase() !== "CONFIRMEE_PAR_APPEL"
    )

    if (targets.length === 0) {
      return
    }

    setPendingCodCancellation({
      commande_ids: targets.map((order) => order.id),
      montant_total: targets.reduce((sum, order) => sum + (order.montant || 0), 0),
      nb_commandes: targets.length,
    })
  }

  async function confirmPendingCodCancellation() {
    if (!token || !pendingCodCancellation || isCodCancellationSubmitting) {
      return
    }

    setIsCodCancellationSubmitting(true)
    setCodError(null)
    setCodFeedback(null)

    try {
      const response = await batchConfirmationCOD(token, {
        commande_ids: pendingCodCancellation.commande_ids,
        statut: "ANNULEE",
      })
      const successIds = new Set(response.success)
      setCodOrders((current) => current.filter((order) => !successIds.has(order.id)))
      setCodFeedback(
        response.failed.length > 0
          ? `${response.message} IDs en echec: ${response.failed.join(", ")}.`
          : response.message
      )
      setPendingCodCancellation(null)
      await loadOrders(token, false)
      await loadCodOrders(token, false)
    } catch (error) {
      setCodError(error instanceof Error ? error.message : "Impossible d'annuler les commandes COD.")
    } finally {
      setIsCodCancellationSubmitting(false)
    }
  }

  async function handleCodGroupConfirmation(
    group: CODClientGroupDTO,
    statut: "CONFIRMEE_PAR_APPEL" | "ANNULEE"
  ) {
    if (statut === "ANNULEE") {
      openCodCancellation(group.commandes)
      return
    }

    if (!token || codActionId !== null || codGroupActionKey !== null || isCodCancellationSubmitting) {
      return
    }

    const targets = group.commandes.filter(
      (order) => normalizeStatus(order.statut_confirmation_cod).toUpperCase() !== "CONFIRMEE_PAR_APPEL"
    )

    if (targets.length === 0) {
      return
    }

    setCodGroupActionKey(group.key)
    setCodError(null)
    setCodFeedback(null)

    try {
      const response = await batchConfirmationCOD(token, {
        commande_ids: targets.map((order) => order.id),
        statut,
      })
      const successIds = new Set(response.success)
      setCodOrders((current) =>
        current.map((order) =>
          successIds.has(order.id)
            ? { ...order, statut_confirmation_cod: "CONFIRMEE_PAR_APPEL" }
            : order
        )
      )
      setCodFeedback(
        response.failed.length > 0
          ? `${response.message} IDs en echec: ${response.failed.join(", ")}.`
          : `${response.message} Client: ${group.client}.`
      )
      await loadOrders(token, false)
    } catch (error) {
      setCodError(error instanceof Error ? error.message : "Impossible de mettre a jour les confirmations COD.")
    } finally {
      setCodGroupActionKey(null)
    }
  }

  const todayLabel = formatShortDate(new Date())
  const clientGroups = useMemo(() => groupOrdersByClient(orders), [orders])
  const hasLockedOrdersToday = orders.some((order) => normalizeStatus(order.statut) === "verrouillee")
  const isAfterCodAlertTime = getCasablancaHour() >= 18
  const hasUnconfirmedCodOrders = codOrders.some(
    (order) => normalizeStatus(order.statut_confirmation_cod).toUpperCase() === "NON_CONFIRMEE"
  )
  const codGroups = useMemo(() => groupCodOrdersByClient(codOrders), [codOrders])
  const isCodOrderCalled = (order: CommandeCODDemainDTO) =>
    normalizeStatus(order.statut_confirmation_cod).toUpperCase() === "CONFIRMEE_PAR_APPEL"
  const codCalledClientsCount = codGroups.filter((group) => group.commandes.every(isCodOrderCalled)).length
  const codUncalledClientsCount = codGroups.filter((group) => group.commandes.some((order) => !isCodOrderCalled(order))).length
  const codTotalAmount = codOrders.reduce((sum, order) => sum + (order.montant || 0), 0)
  const ordersTotalVolume = orders.reduce((sum, order) => sum + (order.volumeKg || 0), 0)
  const ordersTotalAmount = orders.reduce((sum, order) => sum + (order.montant || 0), 0)
  const lockedOrdersCount = orders.filter((order) => normalizeStatus(order.statut) === "verrouillee").length
  const orderStatuses = useMemo(
    () => Array.from(new Set(orders.map((order) => normalizeStatus(order.statut)).filter(Boolean))),
    [orders]
  )
  const codStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          codOrders
            .map((order) => normalizeStatus(order.statut_confirmation_cod || "NON_CONFIRMEE").toUpperCase())
            .filter(Boolean)
        )
      ),
    [codOrders]
  )
  const filteredClientGroups = useMemo(() => {
    const query = ordersSearch.trim().toLowerCase()
    const filteredOrders = orders.filter((order) => {
      const matchesQuery = query
        ? [order.id, order.client, order.clientPhone, order.produits, order.creneauLivraison]
            .map((value) => String(value ?? "").toLowerCase())
            .some((value) => value.includes(query))
        : true
      const matchesStatus = ordersStatusFilter === "tous" || normalizeStatus(order.statut) === ordersStatusFilter

      return matchesQuery && matchesStatus
    })

    return groupOrdersByClient(filteredOrders)
  }, [orders, ordersSearch, ordersStatusFilter])
  const filteredCodGroups = useMemo(() => {
    const query = codSearch.trim().toLowerCase()
    const filteredOrders = codOrders.filter((order) => {
      const matchesQuery = query
        ? [
            order.id,
            order.nom_client,
            order.telephone,
            order.adresse,
            order.montant,
            order.creneau_livraison,
            order.statut_confirmation_cod,
          ]
            .map((value) => String(value ?? "").toLowerCase())
            .some((value) => value.includes(query))
        : true
      const normalizedCodStatus = normalizeStatus(order.statut_confirmation_cod || "NON_CONFIRMEE").toUpperCase()
      const matchesStatus = codStatusFilter === "tous" || normalizedCodStatus === codStatusFilter

      return matchesQuery && matchesStatus
    })

    return groupCodOrdersByClient(filteredOrders)
  }, [codOrders, codSearch, codStatusFilter])
  const sidebarItems = [
    { id: "overview" as const, label: "Vue generale", icon: BarChart3, count: null },
    { id: "commandes" as const, label: "Commandes du jour", icon: Package, count: orders.length },
    { id: "jit" as const, label: "JIT", icon: Rocket, count: null },
    { id: "cod" as const, label: "COD", icon: PhoneCall, count: codUncalledClientsCount },
    { id: "logs" as const, label: "Logs", icon: ClipboardList, count: null },
  ]

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
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/admin" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#1E8A3C]">
              <ArrowLeft className="w-4 h-4" />
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
              <div className="hidden h-6 w-px bg-gray-200 sm:block" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900">Gestion des Commandes</h1>
                  <span className="hidden text-xs font-medium text-gray-400 md:inline">{todayLabel}</span>
                </div>
                <p className="hidden text-xs text-gray-500 md:block">Vue d&apos;ensemble operationnelle</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void handlePreview()}
              disabled={!token || isPreviewLoading || isExecuteLoading}
              className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
            >
              {isPreviewLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <Eye className="w-4 h-4 text-[#1A4F8A]" />}
              Prévisualiser
            </button>
            <button
              type="button"
              onClick={() => setIsExecuteDialogOpen(true)}
              disabled={!token || isPreviewLoading || isExecuteLoading || hasLockedOrdersToday}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E8A3C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#166d30] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExecuteLoading ? <Spinner className="size-4" /> : <Rocket className="w-4 h-4" />}
              Lancer JIT
            </button>

            <button
              onClick={() => {
                if (token) {
                  void loadOrders(token, true)
                  void loadCodOrders(token, true)
                  void loadLastLog(token, true)
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!token || isOrdersLoading || isCodLoading || isLogLoading}
            >
              {isOrdersLoading || isCodLoading || isLogLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden lg:inline">Actualiser</span>
            </button>
          </div>
        </div>
      </header>

      {codAlerte18h?.alerte_active && (
        <div className="sticky top-16 z-30 border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm font-medium text-amber-800 lg:pl-72">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>⚠️ {codAlerte18h.nb_non_confirmees} commandes COD non confirmées — Il est passé 18h00</span>
            <button type="button" onClick={() => setActiveSection("cod")} className="text-xs font-semibold text-[#1E8A3C] hover:underline">
              Voir COD →
            </button>
          </div>
        </div>
      )}

      <aside className="fixed left-0 top-16 z-20 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
              {sidebarItems.map((item) => {
                const isActive = activeSection === item.id
                const Icon = item.icon

                return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                  isActive ? "bg-[#F0FDF4] text-[#1E8A3C]" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
                >
                  <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </span>
                {typeof item.count === "number" ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", isActive ? "bg-white text-[#1E8A3C]" : "bg-gray-100 text-gray-500")}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto border-t border-gray-100 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">KPI rapides</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Commandes</p>
              <p className="text-sm font-semibold text-gray-900">{orders.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Volume</p>
              <p className="text-sm font-semibold text-gray-900">{formatWeight(ordersTotalVolume)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Montant</p>
              <p className="text-sm font-semibold text-gray-900">{formatMoney(ordersTotalAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">COD</p>
              <p className="text-sm font-semibold text-gray-900">{codCalledClientsCount}/{codGroups.length} confirmés</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <section className={cn("overflow-hidden rounded-3xl border border-[#DDE7DE] bg-white shadow-sm", activeSection !== "overview" && "hidden")}>
          <div className="relative p-6 lg:p-8">
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#1E8A3C]/10 blur-3xl" />
            <div className="absolute bottom-0 right-20 h-24 w-24 rounded-full bg-[#F07C00]/10 blur-3xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="inline-flex items-center rounded-full border border-[#1E8A3C]/15 bg-[#F0FAF1] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#1E8A3C]">
                  Back-office commandes
                </p>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-950 lg:text-4xl">Gestion des Commandes</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                  Pilotage des commandes du jour, verrouillage JIT et validation COD depuis un dashboard operationnel unique.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-right shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Aujourd'hui</p>
                <p className="mt-1 text-lg font-semibold text-gray-950">{todayLabel}</p>
                {lastOrdersRefresh ? <p className="mt-1 text-xs text-gray-400">MAJ {lastOrdersRefresh}</p> : null}
              </div>
            </div>
          </div>
        </section>

        <section className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-4", activeSection !== "overview" && "hidden")}>
          <DashboardStatCard icon={Package} label="Commandes du jour" value={orders.length} tone="green" helper={`${clientGroups.length} client(s)`} />
          <DashboardStatCard icon={Scale} label="Volume total" value={formatWeight(ordersTotalVolume)} tone="blue" helper={`${lockedOrdersCount} verrouillee(s)`} />
          <DashboardStatCard icon={Banknote} label="Montant total" value={formatMoney(ordersTotalAmount)} tone="orange" helper="Estimation commandes" />
          <DashboardStatCard icon={PhoneCall} label="COD confirmes" value={`${codCalledClientsCount} / ${codGroups.length}`} tone="slate" helper={`${codOrders.length} commande(s) COD`} />
        </section>

        <section className={cn("grid gap-4 md:grid-cols-2", activeSection !== "overview" && "hidden")}>
          <button
            type="button"
            onClick={() => setActiveSection("commandes")}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#1E8A3C]/30 hover:shadow-md"
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              Commandes du jour
            </p>
            <p className="mt-3 text-2xl font-bold text-gray-900">{orders.length} commandes</p>
            <p className="mt-1 text-sm text-gray-500">{clientGroups.length} clients uniques, {orderStatuses.length} statut(s)</p>
            <p className="mt-5 text-sm font-semibold text-[#1E8A3C]">Voir commandes →</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("jit")}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#1E8A3C]/30 hover:shadow-md"
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
              JIT
            </p>
            <p className="mt-3 text-2xl font-bold text-gray-900">{lastLog ? formatWeight(lastLog.volume_total) : "Aucun log"}</p>
            <p className="mt-1 text-sm text-gray-500">{lastLog ? `Derniere exec: ${formatShortDateTime(lastLog.date_execution)}` : "Pret pour aggregation"}</p>
            <p className="mt-5 text-sm font-semibold text-[#1E8A3C]">Gerer JIT →</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("cod")}
            className="relative rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#1E8A3C]/30 hover:shadow-md"
          >
            {codUncalledClientsCount > 0 ? <span className="absolute right-4 top-4 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">{codUncalledClientsCount} a appeler</span> : null}
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
              COD
            </p>
            <p className="mt-3 text-2xl font-bold text-gray-900">{codOrders.length} commandes COD</p>
            <p className="mt-1 text-sm text-gray-500">{codCalledClientsCount} clients appeles, {formatMoney(codTotalAmount)} a encaisser</p>
            <p className="mt-5 text-sm font-semibold text-[#1E8A3C]">Gerer COD →</p>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("logs")}
            className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-150 hover:border-[#1E8A3C]/30 hover:shadow-md"
          >
            <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              Logs
            </p>
            <p className="mt-3 text-2xl font-bold text-gray-900">{lastLog?.statut || "Aucun log"}</p>
            <p className="mt-1 text-sm text-gray-500">{lastLog ? `${lastLog.nombre_commandes} commandes - ${formatShortDateTime(lastLog.date_execution)}` : "Dernier cycle indisponible"}</p>
            <p className="mt-5 text-sm font-semibold text-[#1E8A3C]">Voir logs →</p>
          </button>
        </section>

        {activeSection === "overview" && codAlerte18h?.alerte_active && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800 shadow-sm">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{codAlerte18h.nb_non_confirmees} commandes COD non confirmees. Il est passe 18h00, priorisez les appels avant la tournee.</span>
            </div>
          </div>
        )}

        <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]", !["commandes", "jit"].includes(activeSection) && "hidden", activeSection === "commandes" && "xl:grid-cols-1", activeSection === "jit" && "xl:grid-cols-1")}>
          <div className={cn("min-w-0 space-y-6", activeSection !== "commandes" && "hidden")}>
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-6 border-b border-gray-100 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Commandes du jour</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Auto-refresh toutes les 30 secondes
                {lastOrdersRefresh ? ` • Dernière mise à jour ${lastOrdersRefresh}` : ""}
              </p>
            </div>

            <div className="px-4 py-2 bg-[#F0FAF1] rounded-xl">
              <p className="text-sm text-[#8A8A8A]">Clients visibles</p>
              <p className="text-2xl font-bold text-[#1E8A3C]">{filteredClientGroups.length}</p>
            </div>
          </div>

          {ordersError && (
            <div className="mx-6 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {ordersError}
            </div>
          )}

          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={ordersSearch}
                  onChange={(event) => setOrdersSearch(event.target.value)}
                  placeholder="Rechercher un client, telephone, produit..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-all duration-150 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <select
                  value={ordersStatusFilter}
                  onChange={(event) => setOrdersStatusFilter(event.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all duration-150 hover:bg-gray-50 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
                >
                  <option value="tous">Tous statuts</option>
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isOrdersLoading ? (
            <TableSkeleton rows={6} columns={7} />
          ) : filteredClientGroups.length === 0 ? (
            <EmptyState
              title="Aucune commande aujourd'hui"
              description="La liste depend du backend admin et sera actualisee automatiquement."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Téléphone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Nb commandes</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Statuts</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Volume total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClientGroups.map((group) => {
                    const firstOrder = group.commandes[0]
                    const isOrdersOpen = openOrdersClientKey === group.key
                    const isClientOpen = group.clientId !== null && openClientId === group.clientId
                    const fiche = group.clientId ? clientSheets[group.clientId] : null
                    const ficheError = group.clientId ? clientSheetErrors[group.clientId] : null
                    const isFicheLoading = clientSheetLoadingId === group.clientId
                    const statuses = Array.from(new Set(group.commandes.map((order) => order.statut)))

                    return (
                      <Fragment key={group.key}>
                        <tr
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setOpenOrdersClientKey(isOrdersOpen ? null : group.key)}
                        >
                          <td className="px-6 py-4 text-[#3D3D3D]">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>{group.client}</span>
                              {group.isBlacklisted ? (
                                <span className="inline-flex items-center rounded-full border border-red-400 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                  Blacklisté
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(group.clientPhone)}</td>
                          <td className="px-6 py-4 font-semibold text-[#1E8A3C]">{group.commandes.length}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {statuses.map((status) => {
                                const badge = statusBadge(status)

                                return (
                                  <span
                                    key={status}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                                      badge.className
                                    )}
                                  >
                                    {badge.locked && <Lock className="w-3 h-3" />}
                                    {badge.label}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[#3D3D3D]">{formatWeight(group.volumeTotal)}</td>
                          <td className="px-6 py-4 font-semibold text-[#F07C00]">{formatMoney(group.montantTotal)}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setOpenOrdersClientKey(isOrdersOpen ? null : group.key)
                                }}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                                  isOrdersOpen
                                    ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#1E8A3C] hover:bg-[#DCFCE7]"
                                    : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                                )}
                              >
                                {isOrdersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                {isOrdersOpen ? "Masquer" : "Voir commandes"}
                              </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleToggleClientSheet(firstOrder)
                              }}
                              disabled={!group.clientId || isFicheLoading}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#1E8A3C] shadow-sm transition-all duration-150 hover:border-[#1E8A3C] hover:bg-[#1E8A3C] hover:text-white hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isFicheLoading && <Spinner className="size-4 text-[#1E8A3C]" />}
                              {!isFicheLoading && <User className="h-3.5 w-3.5" />}
                              {isClientOpen ? "Masquer fiche" : "Fiche client"}
                            </button>
                            </div>
                          </td>
                        </tr>
                        {isOrdersOpen && (
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">ID</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Date</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Produits</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Volume kg</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Paiement</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Statut</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Créneau</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {group.commandes.map((order) => {
                                      const badge = statusBadge(order.statut)
                                      const paymentBadge = paiementBadge(order.modePaiement)

                                      return (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3 font-medium text-[#1E8A3C]">{order.id}</td>
                                          <td className="px-4 py-3 text-sm text-[#3D3D3D]">{formatShortDateTime(order.dateCommande)}</td>
                                          <td className="px-4 py-3 text-sm text-[#8A8A8A] max-w-[320px] whitespace-normal">{order.produits}</td>
                                          <td className="px-4 py-3 text-[#3D3D3D]">{formatWeight(order.volumeKg)}</td>
                                          <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(order.montant)}</td>
                                          <td className="px-4 py-3">
                                            <span
                                              className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                                paymentBadge.className
                                              )}
                                            >
                                              <span className={cn("h-1.5 w-1.5 rounded-full", paymentBadge.dotClassName)} aria-hidden="true" />
                                              {paymentBadge.label}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
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
                                          <td className="px-4 py-3 text-sm text-[#3D3D3D]">{emptyValue(order.creneauLivraison)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        {isClientOpen && (
                          <tr className="bg-[#F8FBF8]">
                            <td colSpan={7} className="px-6 py-4">
                              {isFicheLoading ? (
                                <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-8">
                                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#1E8A3C] border-t-transparent" />
                                  <span className="text-sm font-medium text-gray-500">Chargement de la fiche client...</span>
                                </div>
                              ) : ficheError ? (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                  {ficheError}
                                </div>
                              ) : fiche ? (
                                <FicheClientPanel
                                  fiche={fiche}
                                  openBlocks={openClientBlocks}
                                  onToggleBlock={(blockKey) => toggleClientBlock(fiche.id, blockKey)}
                                />
                              ) : (
                                <EmptyClientBlock />
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

          </div>

          <aside className={cn("space-y-6 xl:sticky xl:top-24 xl:self-start", activeSection !== "jit" && "hidden")}>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Agrégation JIT</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Prévisualisez l&apos;agrégation ou lancez le verrouillage immédiat des commandes.
              </p>
              <span className="mt-3 inline-flex items-center rounded-full border border-[#1E8A3C]/20 bg-[#F0FAF1] px-3 py-1 text-xs font-medium text-[#1E8A3C]">
                Agrégation du {todayLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => void handlePreview()}
                disabled={!token || isPreviewLoading || isExecuteLoading}
                className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-70 flex items-center gap-2"
              >
                {isPreviewLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <Eye className="w-4 h-4 text-[#1A4F8A]" />}
                Prévisualiser
              </button>
            <button
              type="button"
              onClick={() => setIsExecuteDialogOpen(true)}
              disabled={!token || isPreviewLoading || isExecuteLoading || hasLockedOrdersToday}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1E8A3C] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#166d30] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isExecuteLoading ? <Spinner className="size-4" /> : <Rocket className="w-4 h-4" />}
              Lancer JIT
            </button>
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

          {hasLockedOrdersToday && (
            <div className="mb-4 rounded-xl border border-[#F5C400]/40 bg-[#F5C400]/10 px-4 py-3 text-sm font-medium text-[#8B6A00] flex items-start gap-3">
              <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Le JIT du jour est déjà lancé. Déverrouillez les commandes avant de relancer une agrégation.</span>
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

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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
                  Déverrouiller
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
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-[#8A8A8A]">Commandes rouvertes</p>
                  <p className="mt-2 text-3xl font-bold text-[#1E8A3C]">{lastUnlockedCount ?? 0}</p>
                  {unlockFeedback && <p className="mt-2 text-sm text-[#1E8A3C]">{unlockFeedback}</p>}
                </div>

                <button
                  onClick={() => setIsUnlockDetailsOpen(true)}
                  disabled={lastUnlockedDetails.length === 0}
                  className="px-4 py-2 border border-[#4CB84A]/30 bg-white rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-[#1A4F8A]" />
                  Voir le détail
                </button>
              </div>
            </div>
          )}

          {!unlockFeedback && lastUnlockedCount === null && !unlockError && (
            <div className="mt-6 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-[#8A8A8A]">
              Aucune action de déverrouillage n&apos;a encore été lancée.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-base font-semibold text-gray-950">Dernier log JIT</h2>
              <p className="mt-1 text-sm text-gray-500">Cycle JIT le plus recent.</p>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              disabled={!lastLog}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Eye className="h-3.5 w-3.5 text-[#1A4F8A]" />
              {showDetails ? "Masquer" : "Details"}
            </button>
          </div>

          {logError && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {logError}
            </div>
          )}

          {isLogLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 rounded-xl bg-gray-200" />
              <Skeleton className="h-10 rounded-xl bg-gray-200" />
              <Skeleton className="h-10 rounded-xl bg-gray-200" />
            </div>
          ) : lastLog ? (
            <div className="grid gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Date</p>
                <p className="mt-1 font-semibold text-gray-950">{formatDateTime(lastLog.date_execution)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Commandes</p>
                  <p className="mt-1 text-xl font-bold text-[#1E8A3C]">{lastLog.nombre_commandes}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Volume</p>
                  <p className="mt-1 text-xl font-bold text-[#F07C00]">{formatWeight(lastLog.volume_total)}</p>
                </div>
              </div>
              <span className={cn("inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", jitLogBadge(lastLog.statut))}>
                {lastLog.statut}
              </span>
            </div>
          ) : null}

          {lastLog?.message_alerte && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{lastLog.message_alerte}</span>
              </div>
            </div>
          )}

          {showDetails && (
            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
              <JITLogDetailsTable log={lastLog} />
            </div>
          )}
        </section>

          </aside>
        </div>

        <section className={cn("overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm", activeSection !== "cod" && "hidden")}>
          <div className="p-6 border-b border-gray-100 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center rounded-full border border-[#F07C00]/20 bg-[#F07C00]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#B15B00]">
                  Validation COD
                </div>
                <h2 className="mt-3 text-lg font-bold text-[#3D3D3D]">Commandes COD verrouillees par le JIT</h2>
                <p className="text-sm text-[#8A8A8A] mt-1">
                  Une ligne par client pour appeler une seule fois, puis traiter toutes ses commandes COD verrouillées.
                </p>
              </div>

              <button
                type="button"
                onClick={() => token && void loadCodOrders(token, true)}
                disabled={!token || isCodLoading}
                className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-70 flex items-center gap-2"
              >
                {isCodLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <RefreshCw className="w-4 h-4 text-[#1A4F8A]" />}
                Rafraîchir COD
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[#1E8A3C]/10 bg-[#F0FAF1] px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#1E8A3C]">Clients appelés</p>
                <p className="mt-2 text-2xl font-bold text-[#1E8A3C]">{codCalledClientsCount}</p>
              </div>
              <div className="rounded-2xl border border-[#F07C00]/10 bg-[#F07C00]/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#B15B00]">Commandes COD</p>
                <p className="mt-2 text-2xl font-bold text-[#F07C00]">{codOrders.length}</p>
              </div>
              <div className="rounded-2xl border border-[#F5C400]/20 bg-[#F5C400]/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#8B6A00]">Clients non appelés</p>
                <p className="mt-2 text-2xl font-bold text-[#8B6A00]">{codUncalledClientsCount}</p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-[#8A8A8A]">Montant COD</p>
                <p className="mt-2 text-2xl font-bold text-[#3D3D3D]">{formatMoney(codTotalAmount)}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {codAlerte18h?.alerte_active && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex items-start gap-3">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{codAlerte18h.nb_non_confirmees} commandes COD non confirmees - Il est passe 18h00</span>
              </div>
            )}

            {isAfterCodAlertTime && hasUnconfirmedCodOrders && (
              <div className="rounded-xl border border-[#F5C400]/40 bg-[#F5C400]/10 px-4 py-3 text-sm font-medium text-[#8B6A00] flex items-start gap-3">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Certaines commandes COD verrouillees par le JIT ne sont pas encore confirmees par appel.</span>
              </div>
            )}

            {codError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {codError}
              </div>
            )}

            {codFeedback && (
              <div className="rounded-xl border border-[#4CB84A]/20 bg-[#F0FAF1] px-4 py-3 text-sm text-[#1E8A3C]">
                {codFeedback}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="relative block w-full md:max-w-xl">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  value={codSearch}
                  onChange={(event) => setCodSearch(event.target.value)}
                  placeholder="Filtrer par client, téléphone, adresse, créneau..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-[#3D3D3D] outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>

              <select
                value={codStatusFilter}
                onChange={(event) => setCodStatusFilter(event.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all duration-150 hover:bg-gray-50 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
              >
                <option value="tous">Tous statuts COD</option>
                {codStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {isCodLoading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : filteredCodGroups.length === 0 ? (
            <EmptyState
              title="Aucune commande COD a confirmer"
              description={codSearch || codStatusFilter !== "tous" ? "Aucun resultat ne correspond aux filtres actuels." : "Aucune commande COD verrouillee par le JIT pour le moment."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Téléphone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Adresse</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Commandes</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Créneaux</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Statut confirmation</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCodGroups.map((group) => {
                    const isCodOpen = openCodClientKey === group.key
                    const isGroupUpdating = codGroupActionKey === group.key
                    const allConfirmed = group.commandes.every(
                      (order) => normalizeStatus(order.statut_confirmation_cod).toUpperCase() === "CONFIRMEE_PAR_APPEL"
                    )
                    const creneaux = Array.from(
                      new Set(group.commandes.map((order) => getString(order.creneau_livraison)).filter(Boolean))
                    )
                    const statuses = Array.from(
                      new Set(group.commandes.map((order) => order.statut_confirmation_cod || "NON_CONFIRMEE"))
                    )

                    return (
                      <Fragment key={group.key}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-[#3D3D3D]">
                            <p className="font-medium">{emptyValue(group.client)}</p>
                            <p className="text-xs text-[#8A8A8A]">{group.commandes.length} commande(s) COD</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(group.telephone)}</td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D] max-w-[320px] whitespace-normal">{emptyValue(group.adresse)}</td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">
                            {group.commandes.map((order) => `#${order.id}`).join(", ")}
                          </td>
                          <td className="px-6 py-4 font-semibold text-[#F07C00]">{formatMoney(group.montantTotal)}</td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{creneaux.length ? creneaux.join(", ") : "Aucun créneau"}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              {statuses.map((status) => {
                                const badge = codConfirmationBadge(status)

                                return (
                                  <span
                                    key={status}
                                    className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", badge.className)}
                                  >
                                    {badge.label}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenCodClientKey(isCodOpen ? null : group.key)}
                                className="px-4 py-2 border border-[#1A4F8A]/20 bg-[#1A4F8A]/10 rounded-xl font-medium text-[#1A4F8A] hover:bg-[#1A4F8A]/15 flex items-center gap-2 whitespace-nowrap"
                              >
                                {isCodOpen ? "Masquer commandes" : "Voir commandes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCodGroupConfirmation(group, "CONFIRMEE_PAR_APPEL")}
                                disabled={isGroupUpdating || codActionId !== null || isCodCancellationSubmitting || allConfirmed}
                                className="px-4 py-2 border border-[#1E8A3C]/20 bg-[#F0FAF1] rounded-xl font-medium text-[#1E8A3C] hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                              >
                                {isGroupUpdating ? <Spinner className="size-4 text-[#1E8A3C]" /> : <CheckCircle2 className="w-4 h-4" />}
                                Confirmer toutes
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleCodGroupConfirmation(group, "ANNULEE")}
                                disabled={isGroupUpdating || codActionId !== null || isCodCancellationSubmitting || allConfirmed}
                                className="px-4 py-2 border border-red-200 bg-red-50 rounded-xl font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                              >
                                {isGroupUpdating ? <Spinner className="size-4 text-red-700" /> : <XCircle className="w-4 h-4" />}
                                Annuler toutes
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isCodOpen && (
                          <tr className="bg-gray-50">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                                <table className="w-full">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">ID</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Créneau</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Statut confirmation</th>
                                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {group.commandes.map((order) => {
                                      const badge = codConfirmationBadge(order.statut_confirmation_cod)
                                      const isUpdating = codActionId === order.id || isGroupUpdating
                                      const isConfirmed =
                                        normalizeStatus(order.statut_confirmation_cod).toUpperCase() === "CONFIRMEE_PAR_APPEL"

                                      return (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3 font-medium text-[#1E8A3C]">#{order.id}</td>
                                          <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(order.montant ?? null)}</td>
                                          <td className="px-4 py-3 text-sm text-[#3D3D3D]">{emptyValue(order.creneau_livraison)}</td>
                                          <td className="px-4 py-3">
                                            <span
                                              className={cn(
                                                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                                                badge.className
                                              )}
                                            >
                                              {badge.label}
                                            </span>
                                          </td>
                                          <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-2">
                                              <button
                                                type="button"
                                                onClick={() => void handleCodConfirmation(order.id, "CONFIRMEE_PAR_APPEL")}
                                                disabled={isUpdating || isCodCancellationSubmitting || isConfirmed}
                                                className="px-4 py-2 border border-[#1E8A3C]/20 bg-[#F0FAF1] rounded-xl font-medium text-[#1E8A3C] hover:bg-[#E7F5E8] disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                              >
                                                {isUpdating ? <Spinner className="size-4 text-[#1E8A3C]" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Confirmee
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void handleCodConfirmation(order.id, "ANNULEE")}
                                                disabled={isUpdating || isCodCancellationSubmitting || isConfirmed}
                                                className="px-4 py-2 border border-red-200 bg-red-50 rounded-xl font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                              >
                                                {isUpdating ? <Spinner className="size-4 text-red-700" /> : <XCircle className="w-4 h-4" />}
                                                Annulee
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={cn("rounded-2xl border border-gray-200 bg-white p-6 shadow-sm", activeSection !== "logs" && "hidden")}>
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#3D3D3D]">Dernier log JIT</h2>
              <p className="text-sm text-[#8A8A8A] mt-1">
                Suivi du dernier cycle JIT exécuté depuis le back-office.
              </p>
            </div>

            <button
              onClick={() => setShowDetails(!showDetails)}
              disabled={!lastLog}
              className="px-4 py-2 border border-gray-200 rounded-xl font-medium text-[#3D3D3D] hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <Eye className="w-4 h-4 text-[#1A4F8A]" />
              {showDetails ? "Masquer détails" : "Voir détails"}
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

          {showDetails && (
            <div className="mt-6 overflow-hidden">
              <JITLogDetailsTable log={lastLog} />
            </div>
          )}
        </section>

        <AlertDialog open={isExecuteDialogOpen} onOpenChange={setIsExecuteDialogOpen}>
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
                className="rounded-xl bg-[#1E8A3C] hover:bg-[#166d30]"
              >
                {isExecuteLoading ? <Spinner className="size-4" /> : <Rocket className="w-4 h-4" />}
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={pendingCodCancellation !== null}
          onOpenChange={(open) => {
            if (!open && !isCodCancellationSubmitting) {
              setPendingCodCancellation(null)
            }
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Annulation de {pendingCodCancellation?.nb_commandes ?? 0} commande(s)
              </AlertDialogTitle>
              <AlertDialogDescription>
                Montant total impacte : {formatMoney(pendingCodCancellation?.montant_total ?? 0)}. Cette action est irreversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl" disabled={isCodCancellationSubmitting}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault()
                  void confirmPendingCodCancellation()
                }}
                className="rounded-xl bg-red-600 hover:bg-red-700"
                disabled={isCodCancellationSubmitting}
              >
                {isCodCancellationSubmitting ? <Spinner className="size-4" /> : <XCircle className="w-4 h-4" />}
                Confirmer l'annulation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isUnlockDetailsOpen} onOpenChange={setIsUnlockDetailsOpen}>
          <DialogContent className="max-w-4xl rounded-2xl p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Details du deverrouillage JIT</DialogTitle>
              <DialogDescription>
                Commandes rouvertes lors de la derniere action de deverrouillage.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
              <UnlockDetailsTable details={lastUnlockedDetails} />
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
