"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Store,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import { API_BASE_URL } from "@/lib/api"

interface SupplierItem {
  user_id: number
  shop_name: string
  statut: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"
  phone: string | null
  ville: string | null
  address: string | null
  description: string | null
  rejected_reason: string | null
  user_email: string | null
  created_at: string | null
  validated_at: string | null
}

interface SupplierPage {
  items: SupplierItem[]
  total: number
  page: number
  page_size: number
}

const STATUS_CONFIG = {
  PENDING: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  APPROVED: { label: "Approuvé", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "Refusé", color: "bg-red-100 text-red-700", icon: XCircle },
  SUSPENDED: { label: "Suspendu", color: "bg-gray-100 text-gray-700", icon: PauseCircle },
}

export default function AdminFournisseursPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<"pending" | "all">("pending")
  const [pending, setPending] = useState<SupplierItem[]>([])
  const [allData, setAllData] = useState<SupplierPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statutFilter, setStatutFilter] = useState("")
  const [page, setPage] = useState(1)
  const [actionModal, setActionModal] = useState<{
    supplier: SupplierItem
    action: "APPROVE" | "REJECT" | "SUSPEND" | "REACTIVATE"
  } | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchPending = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/suppliers/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setPending(await res.json())
    } catch {}
  }, [token])

  const fetchAll = useCallback(async () => {
    if (!token) return
    const params = new URLSearchParams({ page: String(page), page_size: "20" })
    if (search) params.set("search", search)
    if (statutFilter) params.set("statut", statutFilter)
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/suppliers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setAllData(await res.json())
    } catch {}
  }, [token, page, search, statutFilter])

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      if (tab === "pending") await fetchPending()
      else await fetchAll()
      setLoading(false)
    }
    void load()
  }, [tab, fetchPending, fetchAll])

  const handleAction = async () => {
    if (!actionModal || !token) return
    setActing(true)
    setActionError(null)
    const { supplier, action } = actionModal

    try {
      let res: Response
      if (action === "SUSPEND") {
        res = await fetch(`${API_BASE_URL}/api/admin/suppliers/${supplier.user_id}/suspend`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        })
      } else if (action === "REACTIVATE") {
        res = await fetch(`${API_BASE_URL}/api/admin/suppliers/${supplier.user_id}/reactivate`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        res = await fetch(`${API_BASE_URL}/api/admin/suppliers/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            supplier_user_id: supplier.user_id,
            action,
            rejected_reason: action === "REJECT" ? rejectReason : undefined,
          }),
        })
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d?.detail ?? `Erreur ${res.status}`)
      }
      setActionModal(null)
      setRejectReason("")
      if (tab === "pending") await fetchPending()
      else await fetchAll()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setActing(false)
    }
  }

  const displayList = tab === "pending" ? pending : (allData?.items ?? [])

  return (
    <div className="min-h-screen bg-[#F5F5F0] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-[#6F8070]">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black text-[#264129]">Fournisseurs</h1>
            <p className="text-xs text-[#6F8070]">Gestion des demandes et comptes fournisseurs</p>
          </div>
          <button
            onClick={() => (tab === "pending" ? fetchPending() : fetchAll())}
            className="rounded-xl border border-[#DDEBDD] bg-white p-2"
          >
            <RefreshCw className="h-4 w-4 text-[#6F8070]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex rounded-xl border border-[#DDEBDD] bg-white p-1 shadow-sm">
          {(["pending", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1) }}
              className={`flex-1 rounded-lg py-2 text-xs font-black transition-colors ${
                tab === t ? "bg-[#1E8A3C] text-white" : "text-[#6F8070]"
              }`}
            >
              {t === "pending" ? `En attente (${pending.length})` : "Tous les fournisseurs"}
            </button>
          ))}
        </div>

        {/* Filters (all tab) */}
        {tab === "all" && (
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6F8070]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Rechercher..."
                className="w-full rounded-xl border border-[#DDEBDD] bg-white py-2.5 pl-9 pr-4 text-sm focus:border-[#1E8A3C] focus:outline-none"
              />
            </div>
            <select
              value={statutFilter}
              onChange={(e) => { setStatutFilter(e.target.value); setPage(1) }}
              className="rounded-xl border border-[#DDEBDD] bg-white px-3 py-2.5 text-xs font-bold text-[#264129] focus:outline-none"
            >
              <option value="">Tous statuts</option>
              <option value="APPROVED">Approuvé</option>
              <option value="PENDING">En attente</option>
              <option value="REJECTED">Refusé</option>
              <option value="SUSPENDED">Suspendu</option>
            </select>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#DDEBDD]" />
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDEBDD] bg-white py-16 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-[#DDEBDD]" />
            <p className="text-sm font-bold text-[#6F8070]">
              {tab === "pending" ? "Aucune demande en attente" : "Aucun fournisseur trouvé"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map((s) => {
              const status = STATUS_CONFIG[s.statut]
              const StatusIcon = status.icon
              return (
                <div key={s.user_id} className="rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF8EC]">
                        <Store className="h-5 w-5 text-[#1E8A3C]" />
                      </div>
                      <div>
                        <p className="font-black text-[#264129]">{s.shop_name}</p>
                        {s.user_email && <p className="text-xs text-[#6F8070]">{s.user_email}</p>}
                        {s.phone && <p className="text-xs text-[#6F8070]">{s.phone}</p>}
                        {s.ville && <p className="text-xs text-[#6F8070]">{s.ville}</p>}
                        {s.rejected_reason && (
                          <p className="mt-1 text-xs text-red-500">Motif: {s.rejected_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                      {s.created_at && (
                        <p className="mt-1 text-xs text-[#6F8070]">
                          {new Date(s.created_at).toLocaleDateString("fr-MA")}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#DDEBDD] pt-3">
                    {s.statut === "PENDING" && (
                      <>
                        <button
                          onClick={() => setActionModal({ supplier: s, action: "APPROVE" })}
                          className="flex items-center gap-1 rounded-lg bg-[#1E8A3C] px-3 py-1.5 text-xs font-bold text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approuver
                        </button>
                        <button
                          onClick={() => setActionModal({ supplier: s, action: "REJECT" })}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Refuser
                        </button>
                      </>
                    )}
                    {s.statut === "APPROVED" && (
                      <button
                        onClick={() => setActionModal({ supplier: s, action: "SUSPEND" })}
                        className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700"
                      >
                        <PauseCircle className="h-3.5 w-3.5" /> Suspendre
                      </button>
                    )}
                    {(s.statut === "SUSPENDED" || s.statut === "REJECTED") && (
                      <button
                        onClick={() => setActionModal({ supplier: s, action: "REACTIVATE" })}
                        className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Réactiver
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination (all tab) */}
        {tab === "all" && allData && allData.total > allData.page_size && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-[#DDEBDD] bg-white p-2 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-[#6F8070]">
              Page {allData.page} / {Math.ceil(allData.total / allData.page_size)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(allData.total / allData.page_size)}
              className="rounded-xl border border-[#DDEBDD] bg-white p-2 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-base font-black text-[#264129]">
              {actionModal.action === "APPROVE" && "Approuver la demande"}
              {actionModal.action === "REJECT" && "Refuser la demande"}
              {actionModal.action === "SUSPEND" && "Suspendre le fournisseur"}
              {actionModal.action === "REACTIVATE" && "Réactiver le fournisseur"}
            </h2>
            <p className="mb-4 text-sm text-[#6F8070]">{actionModal.supplier.shop_name}</p>

            {actionModal.action === "REJECT" && (
              <div className="mb-4">
                <label className="mb-1 block text-xs font-bold text-[#264129]">Motif du refus *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Expliquez la raison du refus..."
                  className="w-full rounded-xl border border-[#DDEBDD] px-4 py-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
                />
              </div>
            )}

            {actionError && (
              <div className="mb-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setActionModal(null); setRejectReason(""); setActionError(null) }}
                className="flex-1 rounded-xl border border-[#DDEBDD] py-3 text-sm font-bold text-[#6F8070]"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={acting || (actionModal.action === "REJECT" && !rejectReason.trim())}
                className={`flex-1 rounded-xl py-3 text-sm font-black text-white disabled:opacity-50 ${
                  actionModal.action === "APPROVE" || actionModal.action === "REACTIVATE"
                    ? "bg-[#1E8A3C]"
                    : actionModal.action === "REJECT"
                      ? "bg-red-500"
                      : "bg-amber-500"
                }`}
              >
                {acting ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
