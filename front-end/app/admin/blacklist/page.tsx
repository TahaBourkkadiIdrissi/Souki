"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-"
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }
  return `${value.toFixed(2)} DH`
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

function KpiCard({
  icon: Icon,
  label,
  value,
  tone = "green",
}: {
  icon: typeof UserX
  label: string
  value: number | string
  tone?: "green" | "red" | "orange" | "blue"
}) {
  const toneClasses = {
    green: "bg-[#F0FAF1] text-[#1E8A3C] border-[#BFE6C4]",
    red: "bg-red-50 text-red-700 border-red-200",
    orange: "bg-orange-50 text-[#F07C00] border-orange-200",
    blue: "bg-blue-50 text-[#1A4F8A] border-blue-200",
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-black text-[#26352A]">{value}</p>
          <p className="mt-1 text-sm font-semibold text-[#6F8070]">{label}</p>
        </div>
        <div className={cn("rounded-xl border p-2.5", toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className="h-9 rounded-xl bg-gray-200" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SourceBadge({ source }: { source: string | null }) {
  const normalized = (source || "").toUpperCase()
  const isAuto = normalized === "AUTO_REFUS"

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-bold",
        isAuto
          ? "border-orange-200 bg-orange-50 text-[#B15B00]"
          : "border-blue-200 bg-blue-50 text-[#1A4F8A]"
      )}
    >
      {isAuto ? "AUTO" : "ADMIN"}
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
    void loadReport()
  }, [loadReport])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timeoutId = window.setTimeout(() => setToast(""), 3500)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  const filteredClients = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) {
      return clients
    }

    return clients.filter((client) => {
      const values = [
        client.email,
        client.phone,
        client.motif,
        client.livreur_nom,
        String(client.client_id),
      ]
      return values.some((value) => (value || "").toLowerCase().includes(normalizedSearch))
    })
  }, [clients, search])

  const newThisMonth = useMemo(() => {
    return clients.filter((client) => {
      if (!client.date_blacklist) {
        return false
      }
      const date = new Date(client.date_blacklist)
      return date.getFullYear() === year && date.getMonth() + 1 === month
    }).length
  }, [clients, month, year])

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
      await loadReport()
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
        <div className="fixed right-5 top-5 z-[70] flex items-center gap-3 rounded-2xl border border-[#BFE6C4] bg-white px-5 py-4 text-sm font-semibold text-[#1E8A3C] shadow-xl">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 text-[#3D3D3D] hover:text-[#1E8A3C]">
              <ArrowLeft className="h-5 w-5" />
              <span className="hidden font-medium sm:inline">Retour</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8A8A8A]">Back-office</p>
                <h1 className="font-black text-[#1E8A3C]">Blacklist COD</h1>
              </div>
            </div>
          </div>

          <button
            onClick={() => void loadClients()}
            disabled={isLoadingClients}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 py-2 font-bold text-white transition hover:bg-[#176B2E] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingClients && "animate-spin")} />
            Rafraichir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={UserX} label="Blacklistes total" value={clients.length} tone="red" />
          <KpiCard icon={CalendarDays} label="Ce mois nouveaux" value={newThisMonth} tone="orange" />
          <KpiCard icon={ShieldCheck} label="Leves ce mois" value="-" tone="green" />
          <KpiCard icon={RefreshCw} label="Reinscrits bloques" value="-" tone="blue" />
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#26352A]">Clients blacklistes</h2>
              <p className="mt-1 text-sm text-[#6F8070]">Comptes bloques pour les commandes COD.</p>
            </div>
            <label className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher client, telephone, livreur..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-[#3D3D3D] outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
              />
            </label>
          </div>

          {isLoadingClients ? (
            <TableSkeleton columns={6} />
          ) : filteredClients.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <UserX className="mx-auto h-10 w-10 text-[#C8D9CA]" />
              <h3 className="mt-4 font-black text-[#26352A]">Aucun client blacklisté</h3>
              <p className="mt-2 text-sm text-[#6F8070]">La liste active est vide pour les filtres actuels.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Tel.</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Motif</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Livreur</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client) => (
                    <tr key={client.client_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#26352A]">{emptyValue(client.email || `Client #${client.client_id}`)}</p>
                          <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                            BLACKLISTE
                          </span>
                          <SourceBadge source={client.source} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(client.phone)}</td>
                      <td className="px-6 py-4 text-sm text-[#3D3D3D]">{formatDate(client.date_blacklist)}</td>
                      <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(client.motif)}</td>
                      <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(client.livreur_nom)}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(client)
                            setLiftReason("")
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#1E8A3C]/20 bg-[#F0FAF1] px-4 py-2 text-sm font-bold text-[#1E8A3C] transition hover:bg-[#E7F5E8]"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Lever le blacklist
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F0FAF1] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1E8A3C]">
                <FileBarChart className="h-4 w-4" />
                Rapport mensuel
              </div>
              <h2 className="text-lg font-black text-[#26352A]">Analyse des refus</h2>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#3D3D3D] outline-none focus:border-[#1E8A3C]"
              >
                {Array.from({ length: 12 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {String(index + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                className="w-28 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#3D3D3D] outline-none focus:border-[#1E8A3C]"
              />
              <button
                onClick={() => void loadReport()}
                disabled={isLoadingReport}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F07C00] px-5 py-2.5 font-bold text-white transition hover:bg-[#D66B00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart className="h-4 w-4" />}
                Generer le rapport
              </button>
            </div>
          </div>

          {isLoadingReport ? (
            <TableSkeleton columns={4} />
          ) : report ? (
            <div className="space-y-8 p-6">
              <div className="rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-[#9A5C11]">
                <div className="flex items-center gap-3">
                  <TriangleAlert className="h-5 w-5" />
                  <p className="font-bold">{report.total_refus} refus COD sur {String(report.mois).padStart(2, "0")}/{report.annee}</p>
                </div>
              </div>

              <ReportTable title="Par client" columns={["Client", "Telephone", "Nb refus", "Montant perdu"]}>
                {report.par_client.map((row) => (
                  <tr key={row.client_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#26352A]">{emptyValue(row.email || `Client #${row.client_id}`)}</td>
                    <td className="px-4 py-3 text-sm text-[#3D3D3D]">{emptyValue(row.phone)}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{row.nb_refus}</td>
                    <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(row.montant_perdu)}</td>
                  </tr>
                ))}
              </ReportTable>

              <ReportTable title="Par livreur" columns={["Livreur", "ID", "Nb refus"]}>
                {report.par_livreur.map((row) => (
                  <tr key={row.livreur_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#26352A]">{emptyValue(row.livreur_nom || `Livreur #${row.livreur_id}`)}</td>
                    <td className="px-4 py-3 text-sm text-[#3D3D3D]">{row.livreur_id || "-"}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{row.nb_refus}</td>
                  </tr>
                ))}
              </ReportTable>

              <ReportTable title="Par quartier" columns={["Quartier", "Nb refus", "Montant perdu"]}>
                {report.par_quartier.map((row) => (
                  <tr key={row.quartier || "sans-quartier"} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-[#26352A]">{emptyValue(row.quartier || "Sans quartier")}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{row.nb_refus}</td>
                    <td className="px-4 py-3 font-semibold text-[#F07C00]">{formatMoney(row.montant_perdu)}</td>
                  </tr>
                ))}
              </ReportTable>
            </div>
          ) : null}
        </section>
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
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Lever le blacklist</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedClient
                ? `${selectedClient.email || selectedClient.phone || `Client #${selectedClient.client_id}`}`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={liftReason}
            onChange={(event) => setLiftReason(event.target.value)}
            placeholder="Motif optionnel"
            className="min-h-24 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isLifting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void submitLift()
              }}
              className="rounded-xl bg-[#1E8A3C] hover:bg-[#176B2E]"
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
  columns,
  children,
}: {
  title: string
  columns: string[]
  children: ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 font-black text-[#26352A]">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  )
}
