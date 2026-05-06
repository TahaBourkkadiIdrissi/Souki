"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileBarChart,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserX,
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
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/hooks/useAuth"
import {
  ApiError,
  getBlacklistedClients,
  getBlacklistMonthlyReport,
  liftBlacklist,
  type BlacklistReportDTO,
  type ClientBlacklistDTO,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const monthLabels = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
]

function formatDate(value: string | null | undefined) {
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
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }
  return `${value.toFixed(2)} DH`
}

function formatToday() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function currentMonthInput() {
  const now = new Date()
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  }
}

function emptyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }
  return String(value)
}

function getClientLabel(client: ClientBlacklistDTO) {
  return client.email || client.phone || `Client #${client.client_id}`
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "green",
}: {
  icon: typeof UserX
  label: string
  value: number | string
  helper?: string
  tone?: "green" | "red" | "orange" | "blue"
}) {
  const toneClasses = {
    green: "bg-[#F0FAF1] text-[#1E8A3C] border-emerald-100",
    red: "bg-red-50 text-red-700 border-red-100",
    orange: "bg-orange-50 text-[#F07C00] border-orange-100",
    blue: "bg-blue-50 text-[#1A4F8A] border-blue-100",
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

function TableSkeleton({ columns = 6, rows = 5 }: { columns?: number; rows?: number }) {
  if (columns === 6) {
    return (
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-5 py-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/5" />
            <div className="h-6 bg-gray-200 rounded-full w-20" />
            <div className="h-4 bg-gray-200 rounded w-1/6" />
            <div className="ml-auto h-8 bg-gray-200 rounded-lg w-20" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="animate-pulse space-y-3 p-6">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-4 rounded bg-gray-200" />
          ))}
        </div>
      ))}
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

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof UserX
  title: string
  description: string
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-950">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">{description}</p>
    </div>
  )
}

function SourceBadge({ source }: { source: string | null }) {
  const normalized = (source || "").toUpperCase()

  if (normalized === "AUTO_REFUS") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
        Automatique
      </span>
    )
  }

  if (normalized === "ADMIN") {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
        Admin
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
      Inconnu
    </span>
  )
}

function BlacklistBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      Blackliste
    </span>
  )
}

export default function AdminBlacklistPage() {
  const { token } = useAuth()
  const initialMonth = currentMonthInput()
  const [clients, setClients] = useState<ClientBlacklistDTO[]>([])
  const [report, setReport] = useState<BlacklistReportDTO | null>(null)
  const [month, setMonth] = useState(initialMonth.month)
  const [year, setYear] = useState(initialMonth.year)
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("")
  const [activeSection, setActiveSection] = useState<"liste" | "rapport">("liste")
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [isLifting, setIsLifting] = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientBlacklistDTO | null>(null)
  const [liftReason, setLiftReason] = useState("")

  const loadClients = useCallback(async () => {
    if (!token) {
      setIsLoadingClients(false)
      return
    }

    setIsLoadingClients(true)
    try {
      const result = await getBlacklistedClients(token)
      setClients(result)
      setError("")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger la blacklist.")
    } finally {
      setIsLoadingClients(false)
    }
  }, [token])

  const loadReport = useCallback(async () => {
    if (!token) {
      return
    }

    setIsLoadingReport(true)
    try {
      const result = await getBlacklistMonthlyReport(token, year, month)
      setReport(result)
      setError("")
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : "Impossible de charger le rapport.")
    } finally {
      setIsLoadingReport(false)
    }
  }, [month, token, year])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timeoutId = window.setTimeout(() => setToast(""), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return clients.filter((client) => {
      const matchesSearch = !normalizedSearch || [
        client.email,
        client.phone,
        client.motif,
        client.livreur_nom,
        String(client.client_id),
      ].some((value) => (value || "").toLowerCase().includes(normalizedSearch))

      const matchesSource = !sourceFilter || (client.source || "").toUpperCase() === sourceFilter

      return matchesSearch && matchesSource
    })
  }, [clients, search, sourceFilter])

  const newThisMonth = useMemo(() => {
    return clients.filter((client) => {
      if (!client.date_blacklist) {
        return false
      }
      const date = new Date(client.date_blacklist)
      return date.getFullYear() === year && date.getMonth() + 1 === month
    }).length
  }, [clients, month, year])

  const liftedThisMonth = useMemo(() => {
    return clients.filter((client) => {
      if ((client.source || "").toUpperCase() !== "LIFTED" || !client.date_blacklist) {
        return false
      }
      const date = new Date(client.date_blacklist)
      return date.getFullYear() === year && date.getMonth() + 1 === month
    }).length
  }, [clients, month, year])

  const refusalRate = useMemo(() => {
    if (!report?.total_refus) {
      return "0%"
    }
    return `${Math.round((newThisMonth / report.total_refus) * 100)}%`
  }, [newThisMonth, report?.total_refus])

  const hasReportData = Boolean(
    report &&
      (report.total_refus > 0 ||
        report.par_client.length > 0 ||
        report.par_livreur.length > 0 ||
        report.par_quartier.length > 0)
  )

  const submitLift = async () => {
    if (!token || !selectedClient) {
      return
    }

    setIsLifting(true)
    try {
      await liftBlacklist(token, selectedClient.client_id, liftReason.trim() || undefined)
      setToast(`Blacklist leve pour ${selectedClient.email || selectedClient.phone || `client #${selectedClient.client_id}`}.`)
      setSelectedClient(null)
      setLiftReason("")
      await loadClients()
    } catch (liftError) {
      setError(
        liftError instanceof ApiError || liftError instanceof Error
          ? liftError.message
          : "Impossible de lever le blacklist."
      )
    } finally {
      setIsLifting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {toast && (
        <div className="fixed right-5 top-5 z-[70] flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white px-5 py-4 text-sm font-semibold text-[#1E8A3C] shadow-xl">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#1E8A3C]">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </Link>
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-gray-900">Gestion Blacklist COD</h1>
                <p className="hidden text-xs text-gray-500 md:block">Clients bloques pour paiement COD</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="hidden text-sm font-medium capitalize text-gray-500 md:block">{formatToday()}</p>
            <button
              type="button"
              onClick={() => void loadClients()}
              disabled={isLoadingClients}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoadingClients && "animate-spin")} />
              <span className="hidden lg:inline">Actualiser</span>
            </button>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-[73px] z-10 hidden h-[calc(100vh-73px)] w-56 flex-col border-r border-gray-100 bg-white lg:flex">
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {[
            { id: "liste" as const, label: "Liste blacklistes", icon: UserX, count: clients.length },
            { id: "rapport" as const, label: "Rapport mensuel", icon: FileBarChart, count: null },
          ].map((item) => {
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
                {item.count !== null ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", isActive ? "bg-white text-[#1E8A3C]" : "bg-gray-100 text-gray-500")}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="lg:pl-56">
        {error && (
          <div className="mx-6 mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 text-sm font-medium text-red-700">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Impossible de charger les donnees. {error}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadClients()}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                Reessayer
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 border-b border-gray-100 bg-white px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={UserX} label="Blacklistes" value={clients.length} helper="Total actif" tone="red" />
          <KpiCard icon={CalendarDays} label="Ce mois" value={newThisMonth} helper={`${monthLabels[month - 1]} ${year}`} tone="orange" />
          <KpiCard icon={ShieldCheck} label="Leves" value={liftedThisMonth} helper="Ce mois" tone="green" />
          <KpiCard icon={BarChart3} label="Taux refus" value={refusalRate} helper="Blacklistes / refus" tone="blue" />
        </section>

        <div className="px-6 py-6">
          <div className="min-w-0">
            <div className={cn(activeSection !== "liste" && "hidden")}>
              <SectionShell>
                <div className="border-b border-gray-100 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-gray-950">Clients blacklistes</h2>
                    <p className="mt-1 text-sm text-gray-500">Comptes actuellement bloques pour les commandes COD.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/50 px-5 py-4">
                    <label className="relative max-w-sm flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher par email, telephone..."
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm text-gray-700 outline-none transition-all duration-150 placeholder:text-gray-400 focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/20"
                      />
                    </label>

                    <select
                      value={sourceFilter}
                      onChange={(event) => setSourceFilter(event.target.value)}
                      className="cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm text-gray-700 outline-none transition-all duration-150 focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/20"
                    >
                      <option value="">Toutes sources</option>
                      <option value="AUTO_REFUS">Automatique</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                </div>

                {isLoadingClients ? (
                  <TableSkeleton columns={6} />
                ) : filteredClients.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Aucun client blackliste"
                    description="Tous les comptes peuvent passer des commandes COD."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-gray-200 bg-gray-50">
                        <tr>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Client</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Telephone</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Source</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Livreur</th>
                          <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredClients.map((client) => (
                          <tr key={client.client_id} className="group transition-colors duration-100 hover:bg-gray-50/80">
                            <td className="px-5 py-4 text-sm text-gray-700">
                              <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-gray-950">{emptyValue(getClientLabel(client))}</p>
                                  <BlacklistBadge />
                                </div>
                                <p className="text-xs text-gray-400">ID client #{client.client_id}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-700">{emptyValue(client.phone)}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">{formatDate(client.date_blacklist)}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">
                              <div className="flex flex-col gap-1.5">
                                <SourceBadge source={client.source} />
                                <span className="text-xs text-gray-400">{emptyValue(client.motif)}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-gray-700">{emptyValue(client.livreur_nom)}</td>
                            <td className="px-5 py-4 text-sm text-gray-700">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClient(client)
                                  setLiftReason("")
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#1E8A3C] shadow-sm transition-all duration-150 hover:border-[#1E8A3C] hover:bg-[#1E8A3C] hover:text-white hover:shadow"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Lever
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionShell>
            </div>

            <div className={cn(activeSection !== "rapport" && "hidden")}>
              <SectionShell>
                <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1E8A3C]">
                      <FileBarChart className="h-4 w-4" />
                      Rapport mensuel
                    </div>
                    <h2 className="text-lg font-bold tracking-tight text-gray-950">
                      Rapport du mois de {monthLabels[month - 1]} {year}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">Analyse des refus par client, livreur et quartier.</p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      value={month}
                      onChange={(event) => setMonth(Number(event.target.value))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all duration-150 hover:bg-gray-50 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
                    >
                      {monthLabels.map((label, index) => (
                        <option key={label} value={index + 1}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={year}
                      onChange={(event) => setYear(Number(event.target.value))}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none transition-all duration-150 hover:bg-gray-50 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10 sm:w-28"
                    />
                    <button
                      type="button"
                      onClick={() => void loadReport()}
                      disabled={isLoadingReport}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1E8A3C] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isLoadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                      Generer
                      {!isLoadingReport ? <ChevronRight className="h-4 w-4" /> : null}
                    </button>
                  </div>
                </div>

                {isLoadingReport ? (
                  <TableSkeleton columns={4} rows={4} />
                ) : hasReportData && report ? (
                  <div className="space-y-6 p-6">
                    <div className="rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-[#9A5C11]">
                      <div className="flex items-center gap-3">
                        <TriangleAlert className="h-5 w-5" />
                        <p className="font-semibold">
                          {report.total_refus} refus COD sur {monthLabels[report.mois - 1]} {report.annee}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                      <ReportTable title="Par client" icon={UserX} columns={["Client", "Telephone", "Nb refus", "Montant"]}>
                        {report.par_client.map((row) => (
                          <tr key={row.client_id} className="transition-colors duration-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-950">{emptyValue(row.email || `Client #${row.client_id}`)}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{emptyValue(row.phone)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-700">{row.nb_refus}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#F07C00]">{formatMoney(row.montant_perdu)}</td>
                          </tr>
                        ))}
                      </ReportTable>

                      <ReportTable title="Par livreur" icon={ShieldCheck} columns={["Livreur", "Nb refus"]}>
                        {report.par_livreur.map((row) => (
                          <tr key={row.livreur_id} className="transition-colors duration-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-950">{emptyValue(row.livreur_nom || `Livreur #${row.livreur_id}`)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-700">{row.nb_refus}</td>
                          </tr>
                        ))}
                      </ReportTable>

                      <ReportTable title="Par quartier" icon={CalendarDays} columns={["Quartier", "Nb refus", "Montant perdu"]} className="xl:col-span-2">
                        {report.par_quartier.map((row) => (
                          <tr key={row.quartier || "sans-quartier"} className="transition-colors duration-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-950">{emptyValue(row.quartier || "Sans quartier")}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-red-700">{row.nb_refus}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-[#F07C00]">{formatMoney(row.montant_perdu)}</td>
                          </tr>
                        ))}
                      </ReportTable>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="Aucune donnee pour cette periode"
                    description="Selectionnez un mois et cliquez sur Generer pour afficher le rapport."
                  />
                )}
              </SectionShell>
            </div>
          </div>
        </div>
      </main>

      <AlertDialog
        open={selectedClient !== null}
        onOpenChange={(open) => {
          if (!open && !isLifting) {
            setSelectedClient(null)
            setLiftReason("")
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border border-gray-200 p-0 shadow-xl">
          <div className="border-b border-gray-100 px-6 py-5">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-gray-950">
                Lever le blacklist de {selectedClient ? getClientLabel(selectedClient) : "ce client"} ?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-500">
                Le client pourra a nouveau passer des commandes COD.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="px-6 py-5">
            <textarea
              value={liftReason}
              onChange={(event) => setLiftReason(event.target.value)}
              placeholder="Motif (optionnel)..."
              className="min-h-24 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none transition-all duration-150 focus:border-[#1E8A3C] focus:ring-4 focus:ring-[#1E8A3C]/10"
            />
          </div>
          <AlertDialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <AlertDialogCancel className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50" disabled={isLifting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void submitLift()
              }}
              className="rounded-lg bg-[#1E8A3C] text-white hover:bg-[#176B2E]"
              disabled={isLifting}
            >
              {isLifting ? <Spinner className="size-4" /> : <CheckCircle2 className="h-4 w-4" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ReportTable({
  title,
  icon: Icon,
  columns,
  children,
  className,
}: {
  title: string
  icon: typeof UserX
  columns: string[]
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-gray-200 bg-white", className)}>
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0FAF1] text-[#1E8A3C]">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-semibold text-gray-950">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">{children}</tbody>
        </table>
      </div>
    </div>
  )
}
