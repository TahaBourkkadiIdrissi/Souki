"use client"

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react"
import { RefreshCw } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import {
  arreterCommandeRecurrenteAdmin,
  listCommandesRecurrentes,
  listLivraisonsRecurrentes,
  pauseCommandeRecurrenteAdmin,
  reprendreCommandeRecurrenteAdmin,
  type CommandeRecurrenteAdminDTO,
  type CommandeRecurrenteLivraisonAdminDTO,
} from "@/lib/api"
import { FREQUENCE_LABELS, LIVRAISON_LABELS, STATUT_RECURRENCE, TYPE_RECURRENCE_LABELS, addDaysIso, formatDateFr, formatDh, formatVariation, todayMorocco } from "@/lib/commandes-recurrentes"

const inputClass = "min-h-11 w-full rounded-xl border border-[var(--adm-line)] bg-white px-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--adm-line)] bg-white px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"

type PendingAction = { type: "pause" | "stop"; row: CommandeRecurrenteAdminDTO } | null

export default function AbonnementsAdminPage() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<"abonnes" | "nuit">("abonnes")
  const [rows, setRows] = useState<CommandeRecurrenteAdminDTO[]>([])
  const [livraisons, setLivraisons] = useState<CommandeRecurrenteLivraisonAdminDTO[]>([])
  const [statut, setStatut] = useState("")
  const [type, setType] = useState("")
  const [recherche, setRecherche] = useState("")
  const [rechercheAppliquee, setRechercheAppliquee] = useState("")
  const [jour, setJour] = useState(todayMorocco)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [pending, setPending] = useState<PendingAction>(null)
  const [pauseDate, setPauseDate] = useState(() => addDaysIso(todayMorocco(), 7))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadAbonnes = useCallback(async () => {
    setLoading(true); setError("")
    try { setRows(await listCommandesRecurrentes({ statut, type, recherche: rechercheAppliquee })) }
    catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible.") }
    finally { setLoading(false) }
  }, [statut, type, rechercheAppliquee])

  const loadNuit = useCallback(async () => {
    setLoading(true); setError("")
    try { setLivraisons(await listLivraisonsRecurrentes(jour)) }
    catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible.") }
    finally { setLoading(false) }
  }, [jour])

  useEffect(() => { if (isAuthenticated && tab === "abonnes") void loadAbonnes() }, [isAuthenticated, tab, loadAbonnes])
  useEffect(() => { if (isAuthenticated && tab === "nuit") void loadNuit() }, [isAuthenticated, tab, loadNuit])

  const search = (event: FormEvent) => { event.preventDefault(); setRechercheAppliquee(recherche.trim()) }

  const act = async (action: () => Promise<CommandeRecurrenteAdminDTO>, message: string) => {
    if (saving) return
    setSaving(true); setError(""); setNotice("")
    try {
      const updated = await action()
      setRows(current => current.map(row => row.id === updated.id ? updated : row))
      setNotice(message); setPending(null)
    } catch (e) { setError(e instanceof Error ? e.message : "Action impossible."); setPending(null) }
    finally { setSaving(false) }
  }

  const compte = (value: "CREEE" | "SAUTEE" | "ECHEC") => livraisons.filter(item => item.statut === value).length

  return <div className="text-[var(--adm-text)]">
    <div className="flex">
      <main className="min-w-0 flex-1 space-y-6 p-4 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Abonnements</h1><p className="mt-1 text-sm text-[var(--adm-muted)]">Commandes récurrentes des clients. Elles sont créées automatiquement à 01h00, au prix du site.</p></div>
          <button className={buttonClass} disabled={loading || saving} onClick={() => void (tab === "abonnes" ? loadAbonnes() : loadNuit())}><RefreshCw className="h-4 w-4" />Actualiser</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Vue">
          {([["abonnes", "Abonnements clients"], ["nuit", "Commandes créées à 01h00"]] as const).map(([value, label]) =>
            <button key={value} className={`${buttonClass} ${tab === value ? "border-[#1E8A3C] text-[#1E8A3C]" : ""}`} aria-pressed={tab === value} onClick={() => { setTab(value); setError(""); setNotice("") }}>{label}</button>)}
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-green-200 bg-[var(--adm-green-soft)] p-4 text-sm text-[#1E8A3C]">{notice}</p>}

        {tab === "abonnes" ? <section className="overflow-hidden rounded-xl border border-[var(--adm-line)] bg-white shadow-sm">
          <form onSubmit={search} className="flex flex-wrap items-end gap-3 border-b border-[var(--adm-line)] p-5">
            <label className="text-sm">Statut<select className={inputClass} value={statut} onChange={e => setStatut(e.target.value)}><option value="">Tous</option>{Object.entries(STATUT_RECURRENCE).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select></label>
            <label className="text-sm">Type<select className={inputClass} value={type} onChange={e => setType(e.target.value)}><option value="">Tous</option>{Object.entries(TYPE_RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="min-w-56 flex-1 text-sm">Client<input className={inputClass} value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Nom ou téléphone" /></label>
            <button className={buttonClass} disabled={loading}>Rechercher</button>
          </form>
          {loading ? <p role="status" className="p-5">Chargement…</p> : rows.length === 0 ? <p className="p-5 text-sm text-[var(--adm-muted)]">Aucun abonnement dans cette sélection.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-[var(--adm-muted)]"><tr>{["Client", "Type", "Rythme", "Prochaine livraison", "Estimation", "Statut", "Dernière livraison", "Actions"].map(label => <th className="whitespace-nowrap px-5 py-3" key={label}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{rows.map(row => {
              const derniere = row.dernieres_livraisons[0]
              return <Fragment key={row.id}>
                <tr className={expanded === row.id ? "bg-[var(--adm-green-soft)]" : ""}>
                  <td className="px-5 py-4"><button className="text-left font-semibold text-[#1E8A3C] hover:underline" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{row.client_nom || `Client #${row.client_id}`}</button><p className="mt-1 text-xs text-[var(--adm-muted)]">{row.client_phone || row.contact_phone}</p></td>
                  <td className="px-5 py-4">{TYPE_RECURRENCE_LABELS[row.type]}{row.commande_origine_id ? <span className="block text-xs text-[var(--adm-muted)]">depuis N-{row.commande_origine_id}</span> : null}</td>
                  <td className="whitespace-nowrap px-5 py-4">{FREQUENCE_LABELS[row.frequence]}</td>
                  <td className="whitespace-nowrap px-5 py-4">{row.statut === "EN_PAUSE" ? `Reprise ${formatDateFr(row.pause_jusqu_au)}` : row.statut === "ACTIVE" ? formatDateFr(row.prochaine_livraison) : "—"}</td>
                  <td className="whitespace-nowrap px-5 py-4">{formatDh(row.total_estime)}{Math.abs(row.variation_prix) >= 0.01 && <span className={`block text-xs ${row.variation_prix > 0 ? "text-orange-600" : "text-green-700"}`}>{formatVariation(row.variation_prix)}</span>}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${STATUT_RECURRENCE[row.statut].className}`}>{STATUT_RECURRENCE[row.statut].label}</span></td>
                  <td className="px-5 py-4 text-xs">{derniere ? <>{formatDateFr(derniere.date_livraison)} · {LIVRAISON_LABELS[derniere.statut]}{derniere.commande_id ? ` N-${derniere.commande_id}` : ""}</> : "—"}</td>
                  <td className="px-5 py-4"><div className="flex gap-2">
                    {row.statut === "ACTIVE" && <button disabled={saving} className={buttonClass} onClick={() => { setPauseDate(addDaysIso(todayMorocco(), 7)); setPending({ type: "pause", row }) }}>Pause</button>}
                    {(row.statut === "EN_PAUSE" || row.statut === "SUSPENDUE") && <button disabled={saving} className={buttonClass} onClick={() => void act(() => reprendreCommandeRecurrenteAdmin(row.id), "Abonnement repris.")}>Reprendre</button>}
                    {row.statut !== "ARRETEE" && <button disabled={saving} className={`${buttonClass} text-red-700`} onClick={() => setPending({ type: "stop", row })}>Arrêter</button>}
                  </div></td>
                </tr>
                {expanded === row.id && <tr className="bg-[#F9FAFB]"><td colSpan={8} className="px-5 py-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div><p className="mb-2 text-xs font-semibold text-[var(--adm-muted)]">Liste</p><ul className="space-y-1">{row.lignes.map(ligne => <li key={ligne.product_id} className={`flex justify-between gap-3 ${ligne.disponible ? "" : "text-[#9CA3AF]"}`}><span>{ligne.nom_produit} · {ligne.quantite} {ligne.unite}{ligne.disponible ? "" : " (indisponible)"}</span><span>{formatDh(ligne.sous_total)}{Math.abs(ligne.variation) >= 0.01 ? ` (${formatVariation(ligne.variation)})` : ""}</span></li>)}</ul></div>
                    <div className="space-y-1 text-xs text-[#4B5563]"><p className="mb-2 font-semibold uppercase text-[var(--adm-muted)]">Livraison et historique</p><p>{row.delivery_address}, {row.delivery_city} · {row.mode_paiement === "wallet" ? "Wallet SOUKI" : "Paiement à la livraison"}</p>
                      {row.dernieres_livraisons.map(item => <p key={item.date_livraison}>{formatDateFr(item.date_livraison)} · {LIVRAISON_LABELS[item.statut]}{item.commande_id ? ` N-${item.commande_id} (${formatDh(item.montant)})` : ""}{item.motif ? ` · ${item.motif}` : ""}</p>)}</div>
                  </div>
                </td></tr>}
              </Fragment>
            })}</tbody>
          </table></div>}
        </section> : <section className="overflow-hidden rounded-xl border border-[var(--adm-line)] bg-white shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--adm-line)] p-5">
            <label className="text-sm">Date de livraison<input type="date" className={inputClass} value={jour} onChange={e => setJour(e.target.value)} /></label>
            <div className="grid grid-cols-3 gap-3">{([["CREEE", "Créées"], ["SAUTEE", "Sautées"], ["ECHEC", "Échecs"]] as const).map(([value, label]) => <div key={value} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-2"><p className="text-xs text-[var(--adm-muted)]">{label}</p><p className={`text-xl font-bold ${value === "ECHEC" ? "text-red-700" : "text-[#1E8A3C]"}`}>{compte(value)}</p></div>)}</div>
          </div>
          {loading ? <p role="status" className="p-5">Chargement…</p> : livraisons.length === 0 ? <p className="p-5 text-sm text-[var(--adm-muted)]">Aucune commande récurrente pour cette date.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-[var(--adm-muted)]"><tr>{["Client", "Type", "Résultat", "Commande", "Montant", "Motif"].map(label => <th className="whitespace-nowrap px-5 py-3" key={label}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{livraisons.map(item => <tr key={`${item.recurrence_id}-${item.date_livraison}`}>
              <td className="px-5 py-4 font-semibold">{item.client_nom || `Client #${item.client_id}`}</td>
              <td className="px-5 py-4">{TYPE_RECURRENCE_LABELS[item.type]}</td>
              <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${item.statut === "CREEE" ? "bg-green-100 text-green-700" : item.statut === "SAUTEE" ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>{LIVRAISON_LABELS[item.statut]}</span></td>
              <td className="px-5 py-4">{item.commande_id ? `N-${item.commande_id}` : "—"}</td>
              <td className="px-5 py-4">{item.montant !== null ? formatDh(item.montant) : "—"}</td>
              <td className="px-5 py-4 text-xs text-[var(--adm-muted)]">{item.motif || "—"}</td>
            </tr>)}</tbody>
          </table></div>}
        </section>}

        <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !saving) setPending(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pending?.type === "pause" ? "Mettre cet abonnement en pause ?" : "Arrêter cet abonnement ?"}</AlertDialogTitle>
              <AlertDialogDescription>{pending?.type === "pause"
                ? `Aucune commande ne sera créée pour ${pending.row.client_nom || "ce client"} avant la date de reprise.`
                : `Plus aucune commande récurrente ne sera créée pour ${pending?.row.client_nom || "ce client"}. Les commandes déjà créées ne changent pas.`}</AlertDialogDescription>
            </AlertDialogHeader>
            {pending?.type === "pause" && <label className="space-y-1 text-sm">Reprendre le<input type="date" className={inputClass} value={pauseDate} min={addDaysIso(todayMorocco(), 2)} max={addDaysIso(todayMorocco(), 90)} onChange={e => setPauseDate(e.target.value)} /></label>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel>
              <AlertDialogAction disabled={saving} className={pending?.type === "stop" ? "bg-red-700 hover:bg-red-800" : undefined} onClick={event => {
                event.preventDefault()
                if (!pending) return
                if (pending.type === "pause") void act(() => pauseCommandeRecurrenteAdmin(pending.row.id, pauseDate), "Abonnement mis en pause.")
                else void act(() => arreterCommandeRecurrenteAdmin(pending.row.id), "Abonnement arrêté.")
              }}>{saving ? "Enregistrement…" : pending?.type === "pause" ? "Mettre en pause" : "Arrêter"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  </div>
}
