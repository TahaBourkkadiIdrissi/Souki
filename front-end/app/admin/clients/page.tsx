"use client"

import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
  Users,
} from "lucide-react"

import { EmptyClientBlock, FicheClientPanel, type ClientBlockKey } from "@/components/admin/client-fiche-panel"
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
  blacklistClient,
  getAdminClients,
  getFicheClient,
  type AdminClientDTO,
  type AdminClientsPageDTO,
  type FicheClientDTO,
} from "@/lib/api"
import { cn } from "@/lib/utils"

const CLIENTS_PAGE_SIZE = 20

function formatMoney(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0.00 DH"
  }

  return `${value.toFixed(2)} DH`
}

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

function formatToday() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function emptyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "-"
  }

  return String(value)
}

function getClientLabel(client: AdminClientDTO) {
  return client.email || client.phone || `Client #${client.client_id}`
}

function getClientsErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Impossible de charger les clients."
}

function KpiCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "green",
}: {
  icon: typeof Users
  label: string
  value: string | number
  helper?: string
  tone?: "green" | "orange" | "blue" | "red"
}) {
  const toneClasses = {
    green: "bg-[#F0FAF1] text-[#1E8A3C] border-emerald-100",
    orange: "bg-orange-50 text-[#F07C00] border-orange-100",
    blue: "bg-blue-50 text-[#1A4F8A] border-blue-100",
    red: "bg-red-50 text-red-700 border-red-100",
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

function TableSkeleton({ rows = 6, columns = 8 }: { rows?: number; columns?: number }) {
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

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0FAF1] text-[#1E8A3C]">
        <Users className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-gray-950">Aucun client trouve</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
        Aucun resultat ne correspond aux filtres actuels.
      </p>
    </div>
  )
}

export default function AdminClientsPage() {
  const { token, isLoading: isAuthLoading } = useAuth()
  const [clientsPage, setClientsPage] = useState<AdminClientsPageDTO | null>(null)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [error, setError] = useState("")
  const [isLoadingClients, setIsLoadingClients] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const [openClientId, setOpenClientId] = useState<number | null>(null)
  const [clientSheets, setClientSheets] = useState<Record<number, FicheClientDTO>>({})
  const [clientSheetErrors, setClientSheetErrors] = useState<Record<number, string>>({})
  const [clientSheetLoadingId, setClientSheetLoadingId] = useState<number | null>(null)
  const [openClientBlocks, setOpenClientBlocks] = useState<Record<string, boolean>>({})
  const [blacklistTarget, setBlacklistTarget] = useState<AdminClientDTO | null>(null)
  const [blacklistReason, setBlacklistReason] = useState("")
  const [isBlacklisting, setIsBlacklisting] = useState(false)

  const totalClients = clientsPage?.total ?? 0
  const clients = clientsPage?.items ?? []
  const totalPages = clientsPage?.total_pages ?? 0
  const totalAmount = clientsPage?.montant_total_global ?? 0
  const totalOrders = useMemo(
    () => clients.reduce((sum, client) => sum + (client.nb_commandes || 0), 0),
    [clients]
  )
  const averageOrders = totalClients > 0 ? ((clientsPage?.total_commandes ?? 0) / totalClients).toFixed(1) : "0"

  const loadClients = useCallback(async (showLoader = true, signal?: AbortSignal) => {
    if (!token) {
      setIsLoadingClients(false)
      return
    }

    if (showLoader) {
      setIsLoadingClients(true)
    }

    try {
      const result = await getAdminClients(
        token,
        {
          search: debouncedSearch.trim() || undefined,
          page,
          blacklisted: false,
        },
        signal
      )
      setClientsPage(result)
      setError("")
      setLastRefresh(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }))
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") {
        return
      }
      setError(getClientsErrorMessage(loadError))
    } finally {
      setIsLoadingClients(false)
    }
  }, [debouncedSearch, page, token])

  async function handleToggleClientSheet(client: AdminClientDTO) {
    if (!token) {
      return
    }

    const clientId = client.client_id
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
    } catch (sheetError) {
      setClientSheetErrors((current) => ({
        ...current,
        [clientId]: sheetError instanceof Error ? sheetError.message : "Impossible de charger la fiche client.",
      }))
    } finally {
      setClientSheetLoadingId(null)
    }
  }

  function toggleClientBlock(clientId: number, blockKey: ClientBlockKey) {
    const key = `${clientId}:${blockKey}`
    setOpenClientBlocks((current) => ({ ...current, [key]: !(current[key] ?? blockKey === "identity") }))
  }

  async function handleConfirmBlacklist() {
    if (!token || !blacklistTarget) {
      return
    }

    const reason = blacklistReason.trim()
    if (!reason) {
      setError("Motif obligatoire pour blacklister un client.")
      return
    }

    setIsBlacklisting(true)
    try {
      await blacklistClient(token, blacklistTarget.client_id, reason)
      setBlacklistTarget(null)
      setBlacklistReason("")
      setOpenClientId((current) => (current === blacklistTarget.client_id ? null : current))
      await loadClients(true)
    } catch (blacklistError) {
      setError(blacklistError instanceof Error ? blacklistError.message : "Impossible de blacklister ce client.")
    } finally {
      setIsBlacklisting(false)
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    if (isAuthLoading) {
      return
    }

    if (!token) {
      setIsLoadingClients(false)
      setError("Session admin requise.")
      return
    }

    const controller = new AbortController()
    void loadClients(true, controller.signal)

    const intervalId = window.setInterval(() => {
      if (openClientId !== null) {
        return
      }
      void loadClients(false)
    }, 60000)

    return () => {
      controller.abort()
      window.clearInterval(intervalId)
    }
  }, [isAuthLoading, loadClients, openClientId, token])

  useEffect(() => {
    if (clientsPage && totalPages > 0 && page > totalPages) {
      setPage(totalPages)
    }
  }, [clientsPage, page, totalPages])

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-[#1E8A3C]">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </Link>
            <div className="hidden h-6 w-px bg-gray-200 sm:block" />
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#1E8A3C]">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold tracking-tight text-gray-950">Clients</h1>
                <p className="hidden text-xs text-gray-500 md:block">Vue admin des comptes clients</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <p className="hidden text-sm font-medium capitalize text-gray-500 md:block">{formatToday()}</p>
            {lastRefresh ? <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 lg:inline">MAJ {lastRefresh}</span> : null}
            <button
              type="button"
              onClick={() => void loadClients(true)}
              disabled={!token || isLoadingClients}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4 text-[#1E8A3C]", isLoadingClients && "animate-spin")} />
              <span className="hidden lg:inline">Actualiser</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8 lg:py-8">
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Users} label="Clients" value={totalClients} tone="green" helper={`${CLIENTS_PAGE_SIZE} par page`} />
          <KpiCard icon={Banknote} label="Montant total (global)" value={formatMoney(totalAmount)} tone="orange" helper="Tous les clients filtres" />
          <KpiCard icon={CalendarDays} label="Commandes" value={totalOrders} tone="blue" helper="Page courante" />
          <KpiCard icon={User} label="Moyenne commandes" value={averageOrders} tone="green" helper="Tous les clients filtres" />
        </section>

        <SectionShell>
          <div className="flex flex-col gap-4 border-b border-gray-100 p-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-gray-950">Liste clients</h2>
              <p className="mt-1 text-sm text-gray-500">Recherche, pagination et fiche client inline.</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
              <label className="relative block w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A8A]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher nom ou telephone..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-[#3D3D3D] outline-none focus:border-[#1E8A3C] focus:ring-2 focus:ring-[#1E8A3C]/10"
                />
              </label>
            </div>
          </div>

          {isLoadingClients ? (
            <TableSkeleton columns={7} />
          ) : clients.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Telephone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Nb commandes</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Montant total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Mode paiement favori</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Date inscription</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-[#8A8A8A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map((client) => {
                    const isClientOpen = openClientId === client.client_id
                    const fiche = clientSheets[client.client_id]
                    const ficheError = clientSheetErrors[client.client_id]
                    const isFicheLoading = clientSheetLoadingId === client.client_id

                    return (
                      <Fragment key={client.client_id}>
                        <tr
                          onClick={() => void handleToggleClientSheet(client)}
                          className={cn("cursor-pointer transition-colors duration-100 hover:bg-gray-50", isClientOpen && "bg-[#F8FBF8]")}
                        >
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#1E8A3C]">
                                <User className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-950">{getClientLabel(client)}</p>
                                <p className="text-xs text-[#8A8A8A]">Client #{client.client_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(client.phone)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[#1E8A3C]">{client.nb_commandes}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[#F07C00]">{formatMoney(client.montant_total)}</td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{emptyValue(client.mode_paiement_favori)}</td>
                          <td className="px-6 py-4 text-sm text-[#3D3D3D]">{formatDate(client.date_inscription)}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleToggleClientSheet(client)
                                }}
                                disabled={isFicheLoading}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-xs font-semibold text-[#1E8A3C] shadow-sm transition-all duration-150 hover:border-[#1E8A3C] hover:bg-[#1E8A3C] hover:text-white hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isFicheLoading ? <Spinner className="size-4 text-[#1E8A3C]" /> : <User className="h-3.5 w-3.5" />}
                                {isClientOpen ? "Masquer fiche" : "Fiche client"}
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setBlacklistTarget(client)
                                  setBlacklistReason("")
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition-all duration-150 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                                Blacklister
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isClientOpen ? (
                          <tr className="bg-[#F8FBF8]">
                            <td colSpan={7} className="px-6 py-4">
                              {isFicheLoading ? (
                                <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-8">
                                  <Spinner className="size-5 text-[#1E8A3C]" />
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
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Page {clientsPage?.page ?? page} sur {totalPages || 1} - {totalClients} client(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || isLoadingClients}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Precedent
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => (totalPages ? Math.min(totalPages, current + 1) : current + 1))}
                disabled={totalPages === 0 || page >= totalPages || isLoadingClients}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SectionShell>
      </main>

      <AlertDialog
        open={blacklistTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen && !isBlacklisting) {
            setBlacklistTarget(null)
            setBlacklistReason("")
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl border border-gray-200 p-0 shadow-xl">
          <div className="px-6 pt-6">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold text-gray-950">
                Blacklister {blacklistTarget ? getClientLabel(blacklistTarget) : "ce client"} ?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-500">
                Le client sera retire de la page clients et apparaitra dans la blacklist. Le motif est obligatoire.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <textarea
              value={blacklistReason}
              onChange={(event) => setBlacklistReason(event.target.value)}
              placeholder="Motif du blacklist..."
              className="mt-4 min-h-28 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10"
            />
          </div>
          <AlertDialogFooter className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <AlertDialogCancel className="rounded-lg border-gray-200 bg-white text-gray-700 hover:bg-gray-50" disabled={isBlacklisting}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmBlacklist()
              }}
              disabled={!blacklistReason.trim() || isBlacklisting}
              className="rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBlacklisting ? "Blacklisting..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
