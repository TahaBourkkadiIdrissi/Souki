"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Link2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import {
  AdminCommandeException,
  AdminCommandeExceptionsPage,
  AdminDispatchTournee,
  API_BASE_URL,
  annulerAdminCommande,
  getAdminCommandeExceptions,
  getAdminDispatchTournees,
  reassignerAdminCommandeException,
  replanifierAdminCommande,
} from "@/lib/api"

type PendingAdminAction = {
  commandeId: number
  title: string
  description: string
  confirmLabel: string
  tone: "green" | "red"
  action: () => Promise<unknown>
}

const REASONS = [
  "JOUR_PRECEDENT",
  "BROUILLON",
  "PENDING_NON_VALIDE",
  "ECHEC_LIVRAISON",
  "ABERRANT",
  "ANNULEE",
]

const REASON_LABELS: Record<string, string> = {
  JOUR_PRECEDENT: "Jour précédent",
  BROUILLON: "Brouillon",
  PENDING_NON_VALIDE: "Pending non validé",
  ECHEC_LIVRAISON: "Échec livraison",
  ABERRANT: "Statut aberrant",
  ANNULEE: "Annulée",
}

export default function AdminCommandesExceptionsPage() {
  const { token } = useAuth()
  const [data, setData] = useState<AdminCommandeExceptionsPage | null>(null)
  const [tournees, setTournees] = useState<AdminDispatchTournee[]>([])
  const [raison, setRaison] = useState("")
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const [exceptions, dispatch] = await Promise.all([
        getAdminCommandeExceptions(token, {
          raison,
          search,
          date_from: dateFrom,
          date_to: dateTo,
          page,
          page_size: 20,
        }),
        getAdminDispatchTournees(token),
      ])
      setData(exceptions)
      setTournees(dispatch.tournees ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement impossible.")
    } finally {
      setLoading(false)
    }
  }, [token, raison, search, dateFrom, dateTo, page])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = async (commandeId: number, action: () => Promise<unknown>) => {
    setActingId(commandeId)
    setError(null)
    try {
      await action()
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Action impossible.")
    } finally {
      setActingId(null)
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)
    await runAction(action.commandeId, action.action)
  }

  const renderActions = (item: AdminCommandeException) => (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">

      <select
        value=""
        disabled={actingId === item.id || item.tournee_id === null}
        onChange={(event) => {
          const tourneeId = Number(event.target.value)
          if (tourneeId) {
            void runAction(item.id, () =>
              reassignerAdminCommandeException(token!, item.id, tourneeId),
            )
          }
        }}
        className="rounded-xl border border-[#DDEBDD] bg-white px-3 py-2 text-xs font-bold text-[#264129] disabled:opacity-50"
      >
        <option value="">Réassigner à une tournée</option>
        {tournees.filter((tournee) => tournee.id !== item.tournee_id).map((tournee) => (
          <option key={tournee.id} value={tournee.id}>
            Tournée #{tournee.id} — {tournee.livreur.nom}
          </option>
        ))}
      </select>
      <button
        disabled={actingId === item.id}
        onClick={() =>
          setPendingAction({
            commandeId: item.id,
            title: `Replanifier la commande #${item.id} ?`,
            description: "La commande sera replacee dans le flux de planification.",
            confirmLabel: "Replanifier",
            tone: "green",
            action: () => replanifierAdminCommande(token!, item.id),
          })
        }
        className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#EAF8EC] px-3 py-2 text-xs font-black text-[#1E8A3C] disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Replanifier
      </button>
      <button
        disabled={actingId === item.id}
        onClick={() =>
          setPendingAction({
            commandeId: item.id,
            title: `Annuler definitivement la commande #${item.id} ?`,
            description: "Cette action annule la commande et doit rester exceptionnelle.",
            confirmLabel: "Annuler la commande",
            tone: "red",
            action: () => annulerAdminCommande(token!, item.id),
          })
        }
        className="inline-flex items-center justify-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
      >
        <XCircle className="h-3.5 w-3.5" /> Annuler
      </button>
    </div>
  )

  return (
    <main className="min-h-screen bg-[#F5F5F0] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="rounded-lg p-2 text-[#6F8070] hover:bg-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black text-[#264129]">Exceptions / Backlog</h1>
            <p className="text-sm text-[#6F8070]">File de rattrapage administrative, sans suppression.</p>
          </div>
          <button onClick={() => void load()} className="rounded-xl border border-[#DDEBDD] bg-white p-2">
            <RefreshCw className="h-4 w-4 text-[#1E8A3C]" />
          </button>
        </header>

        <section className="mb-5 grid gap-2 rounded-2xl border border-[#DDEBDD] bg-white p-4 md:grid-cols-4">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Commande, client, ville..." className="rounded-xl border border-[#DDEBDD] px-3 py-2 text-sm" />
          <select value={raison} onChange={(e) => { setRaison(e.target.value); setPage(1) }} className="rounded-xl border border-[#DDEBDD] px-3 py-2 text-sm">
            <option value="">Toutes les raisons</option>
            {REASONS.map((value) => <option key={value} value={value}>{REASON_LABELS[value]}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} className="rounded-xl border border-[#DDEBDD] px-3 py-2 text-sm" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} className="rounded-xl border border-[#DDEBDD] px-3 py-2 text-sm" />
        </section>

        {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

        {loading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-[#DDEBDD]" />
        ) : !data?.items.length ? (
          <div className="rounded-2xl border border-dashed border-[#DDEBDD] bg-white py-16 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-[#A9B8AA]" />
            <p className="mt-3 font-bold text-[#6F8070]">Aucune exception pour ces filtres.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-[#DDEBDD] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-black text-[#264129]">Commande #{item.id}</h2>
                    <p className="text-sm font-bold text-[#6F8070]">{item.client_nom}</p>
                    <p className="text-xs text-[#6F8070]">{item.ville || "Ville inconnue"} · {item.montant_total.toFixed(2)} DH</p>
                  </div>
                  <span className="rounded-lg bg-[#F5F5F0] px-2 py-1 text-xs font-black text-[#264129]">{item.statut || "NULL"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.raisons.map((value) => (
                    <span key={value} className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                      {REASON_LABELS[value] || value}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#6F8070]">
                  <p><Link2 className="mr-1 inline h-3 w-3" />Point Souki</p>
                  <p>Tournée : {item.tournee_id ?? "—"} · Livreur : {item.livreur_id ?? "—"}</p>
                </div>
                {renderActions(item)}
              </article>
            ))}
          </div>
        )}

        {data && data.total_pages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-xl border border-[#DDEBDD] bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-bold text-[#6F8070]">Page {data.page} / {data.total_pages}</span>
            <button disabled={page >= data.total_pages} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-[#DDEBDD] bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#122018]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-[#DDEBDD] bg-white p-5 shadow-[0_30px_90px_rgba(18,32,24,0.25)]">
            <div className="flex items-start gap-3">
              <span className={pendingAction.tone === "red" ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF8EC] text-[#1E8A3C]"}>
                {pendingAction.tone === "red" ? <XCircle className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-black text-[#264129]">{pendingAction.title}</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#6F8070]">{pendingAction.description}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-2xl border border-[#DDEBDD] px-5 py-3 text-sm font-bold text-[#607061] hover:bg-[#F7FCF7]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmPendingAction()}
                className={pendingAction.tone === "red" ? "rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white hover:bg-red-700" : "rounded-2xl bg-[#1E8A3C] px-5 py-3 text-sm font-black text-white hover:bg-[#176B2E]"}
              >
                {pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
