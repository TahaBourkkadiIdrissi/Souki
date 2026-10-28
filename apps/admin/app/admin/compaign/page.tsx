"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertTriangle, CircleDollarSign, Copy, Download, ExternalLink, Gift, LayoutDashboard, MapPinned, Menu, Package, Pencil, Plus, QrCode, RefreshCw, ShoppingBasket, Tags, Truck, Users, X } from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { SoukiLogoLink } from "@/components/souki/souki-logo"
import { useAuth } from "@/hooks/useAuth"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import { createCampaign, getCampaignOptions, getCampaignQr, getCampaignStats, listCampaigns, restoreCampaign, trashCampaign, updateCampaign, type Campaign, type CampaignForm, type CampaignStats, type CampaignOptions } from "@/lib/api"

const emptyForm: CampaignForm & { slug: string } = { name: "", slug: "", destination: "/catalogue", source: "flyer", medium: "qr", campaign: "lancement-fes", active: true }
const inputClass = "min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
const dateText = (date: Date) => date.toISOString().slice(0, 10)
const presets = [
  { label: "Flyer / imprimé", source: "flyer", medium: "qr" },
  { label: "Email", source: "newsletter", medium: "email" },
  ...Object.entries({ facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", tiktok: "TikTok" }).flatMap(([source, label]) => [
    { label: `${label} — organique`, source, medium: "social" },
    { label: `${label} — payant`, source, medium: "paid" },
  ]),
]
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/admin", permission: "admin.panel.access" },
  { icon: Package, label: "Commandes du jour", href: "/admin/orders", permission: "orders.read" },
  { icon: Users, label: "Clients", href: "/admin/clients", permission: "clients.read" },
  { icon: AlertTriangle, label: "Blackliste", href: "/admin/blacklist", permission: "clients.blacklist" },
  { icon: Truck, label: "Logistique & Livreurs", href: "/admin/livreur", permission: "admin.panel.access" },
  { icon: ShoppingBasket, label: "Gestion Produits & Prix", href: "/admin/produits", permission: "products.manage" },
  { icon: CircleDollarSign, label: "Pricing", href: "/admin/pricing", permission: "admin.panel.access" },
  { icon: Tags, label: "Catégories", href: "/admin/categories", permission: "admin.panel.access" },
  { icon: MapPinned, label: "Zones de livraison", href: "/admin/zones", permission: "admin.panel.access" },
  { icon: AlertTriangle, label: "Exceptions / Backlog", href: "/admin/commandes/exceptions", permission: "admin.panel.access" },
  { icon: Gift, label: "Parrainage", href: "/admin/parrainage", permission: "admin.panel.access" },
  { icon: QrCode, label: "Campagnes", href: "/admin/compaign", permission: "admin.panel.access" },
]

export default function CompaignPage() {
  const { isAuthenticated, can } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [svg, setSvg] = useState("")
  const [start, setStart] = useState(() => dateText(new Date(Date.now() - 29 * 86400000)))
  const [end, setEnd] = useState(() => dateText(new Date()))
  const [refresh, setRefresh] = useState(0)
  const [options, setOptions] = useState<CampaignOptions | null>(null)
  const [deleted, setDeleted] = useState(false)
  const [sourceFilter, setSourceFilter] = useState("")
  const [mediumFilter, setMediumFilter] = useState("")
  const [pendingTrash, setPendingTrash] = useState<Campaign | null>(null)
  const filtered = campaigns.filter(row => (!sourceFilter || row.source === sourceFilter) && (!mediumFilter || row.medium === mediumFilter))
  const selected = filtered.find(item => item.id === selectedId)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [rows, configuration] = await Promise.all([listCampaigns(deleted), getCampaignOptions()])
      setOptions(configuration)
      setCampaigns(rows)
      setSelectedId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible.") }
    finally { setLoading(false) }
  }, [deleted])

  useEffect(() => { if (isAuthenticated) void load() }, [isAuthenticated, load])
  useEffect(() => {
    if (selectedId === null) { setStats(null); setSvg(""); return }
    const controller = new AbortController()
    setStats(null); setSvg(""); setError("")
    Promise.all([getCampaignStats(selectedId, start, end, controller.signal), getCampaignQr(selectedId)])
      .then(([value, qr]) => { if (!controller.signal.aborted) { setStats(value); setSvg(qr.svg) } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Statistiques indisponibles.") })
    return () => controller.abort()
  }, [selectedId, start, end, refresh])

  const edit = (row: Campaign) => {
    setError(""); setNotice("")
    setEditing(row); setForm({ name: row.name, slug: row.slug, destination: row.destination, source: row.source, medium: row.medium, campaign: row.campaign, active: row.active }); setShowForm(true)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if ((!editing || form.slug !== editing.slug) && (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(form.slug) || options?.reserved_slugs.includes(form.slug))) {
      setError("Choisissez un lien de 3 à 48 caractères : minuscules, chiffres, tirets au milieu, sans nom réservé du site."); return
    }
    setSaving(true); setError(""); setNotice("")
    try {
      const { slug, ...values } = form
      const result = editing ? await updateCampaign(editing.id, { ...values, slug, expected_version: editing.version }) : await createCampaign({ ...values, slug })
      setShowForm(false); setEditing(null); setForm(emptyForm)
      await load(); setSelectedId(result.id); setRefresh(value => value + 1)
      setNotice(editing ? "Campagne mise à jour. Les anciens liens et QR restent utilisables." : "Votre lien est prêt à être partagé. Son QR code est aussi disponible.")
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible.") }
    finally { setSaving(false) }
  }
  const changeTrash = async (row: Campaign, restore: boolean) => {
    if (saving) return
    setSaving(true); setError(""); setNotice("")
    try {
      if (restore) await restoreCampaign(row.id, row.version)
      else await trashCampaign(row.id, row.version)
      setPendingTrash(null); setShowForm(false)
      await load(); setRefresh(value => value + 1)
      setNotice(restore ? "Campagne restaurée, avec son lien désactivé. Vous pouvez le réactiver en la modifiant." : "Campagne déplacée dans la corbeille. Ses liens ouvrent le catalogue ; son historique est conservé.")
    } catch (e) { setError(e instanceof Error ? e.message : "Modification impossible."); setPendingTrash(null) }
    finally { setSaving(false) }
  }
  const copy = async () => {
    if (!selected) return
    try { await navigator.clipboard.writeText(selected.short_url); setNotice("Lien copié.") }
    catch { setError("Copiez le lien affiché dans la fiche de la campagne.") }
  }
  const download = async (format: "svg" | "png") => {
    if (!selected || !svg) return
    try {
      let blob = new Blob([svg], { type: "image/svg+xml" })
      if (format === "png") {
        const image = new Image()
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        await image.decode()
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1200
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Export PNG indisponible. Utilisez le SVG.")
        context.imageSmoothingEnabled = false
        context.drawImage(image, 0, 0, 1200, 1200)
        blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Export PNG impossible.")), "image/png"))
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url; anchor.download = `souki-${selected.slug}.${format}`; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : "Téléchargement impossible.") }
  }

  return <div className="min-h-screen bg-[#F5F5F0] text-[#1F2937]">
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3"><button aria-label="Ouvrir le menu" className="lg:hidden" onClick={() => setSidebarOpen(true)}><Menu /></button><SoukiLogoLink height={32} /></div>
      <p className="text-sm font-bold">SOUKI Dashboard</p>
    </header>
    <div className="flex">
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} fixed left-0 top-0 z-40 h-screen w-64 bg-[#1E8A3C] p-3 text-white lg:sticky lg:top-14 lg:h-[calc(100vh-56px)] lg:translate-x-0`}>
        <button aria-label="Fermer le menu" onClick={() => setSidebarOpen(false)} className="mb-6 ml-auto block lg:hidden"><X /></button>
        <nav className="max-h-[calc(100vh-100px)] space-y-2 overflow-y-auto">
          {navItems.filter(item => can(item.permission)).map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/admin/compaign" ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${item.href === "/admin/compaign" ? "bg-white/20 font-semibold" : "text-white/75 hover:bg-white/10"}`}><item.icon className="h-5 w-5 shrink-0" />{item.label}</Link>)}
        </nav>
      </aside>
      {sidebarOpen && <button aria-label="Fermer le menu" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main className="min-w-0 flex-1 space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Campagnes</h1><p className="mt-1 text-sm text-[#6B7280]">Vos liens de campagne, leurs QR codes et leur trafic.</p></div>
          <div className="flex gap-2"><button className={buttonClass} disabled={loading || saving} onClick={() => { void load(); setRefresh(value => value + 1) }}><RefreshCw className="h-4 w-4" />Actualiser</button><button disabled={loading || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1E8A3C] px-4 text-sm font-semibold text-white hover:bg-[#166d30] disabled:opacity-50" onClick={() => { setDeleted(false); setEditing(null); setForm(emptyForm); setError(""); setNotice(""); setShowForm(true) }}><Plus className="h-4 w-4" />Nouvelle campagne</button></div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-green-200 bg-[#F0FDF4] p-4 text-sm text-[#1E8A3C]">{notice}</p>}
        {showForm && <form onSubmit={submit} className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">{editing ? "Modifier la campagne" : "Créer une campagne"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">Nom de la campagne<input required maxLength={120} className={inputClass} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Flyers Narjiss — octobre" /></label>
            <label className="space-y-1 text-sm">Identifiant du lien court<input required disabled={Boolean(editing && !editing.can_rename)} maxLength={48} className={inputClass} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().trim() })} placeholder="flyer-narjiss" /><span className="block text-xs text-[#6B7280]">3 à 48 caractères : minuscules, chiffres et tirets au milieu. Modifiable avant la première visite ; ensuite figé. Les anciens noms restent réservés.</span><span className="block break-all text-xs text-[#1E8A3C]">{options?.public_origin}/{form.slug || "votre-lien"}</span></label>
            <label className="space-y-1 text-sm md:col-span-2">Page de destination<input required maxLength={1000} className={inputClass} value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder="/catalogue" /><span className="block text-xs text-[#6B7280]">Une page du site Souki. Vous pouvez la changer après impression.</span></label>
            <label className="space-y-1 text-sm">Canal prédéfini<select className={inputClass} value={presets.find(item => item.source === form.source && item.medium === form.medium)?.label ?? "custom"} onChange={event => {
              const preset = presets.find(item => item.label === event.target.value)
              setForm({ ...form, source: preset?.source ?? "autre", medium: preset?.medium ?? "referral" })
            }}>{presets.map(item => <option key={item.label} value={item.label}>{item.label}</option>)}<option value="custom">Personnalisé</option></select></label>
            {([['source', 'Source de trafic'], ['medium', 'Support'], ['campaign', 'Nom de campagne dans les statistiques']] as const).map(([key, label]) => <label key={key} className="space-y-1 text-sm">{label}<input required maxLength={80} className={inputClass} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Lien actif</label>
          </div>
          <p className="text-xs text-[#6B7280]">Créez un lien distinct par canal pour comparer vos résultats. Source et support restent personnalisables.</p>
          <p className="text-xs text-[#6B7280]">Créez un lien distinct par canal pour comparer vos résultats. Source et support restent personnalisables.</p>
          <p className="text-xs text-[#6B7280]">Un lien désactivé ouvre le catalogue sans compter de nouvelle visite. Les statistiques sont conservées. Les commandes liées aux visites antérieures peuvent encore être attribuées pendant 30 jours après ces visites.</p>
          <div className="flex gap-3"><button disabled={saving} className="min-h-11 rounded-xl bg-[#1E8A3C] px-5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer"}</button><button type="button" disabled={saving} className={buttonClass} onClick={() => setShowForm(false)}>Annuler</button></div>
        </form>}
        <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="space-y-4 border-b border-[#E5E7EB] p-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label="État des campagnes">{[false, true].map(value => <button key={String(value)} className={`${buttonClass} ${deleted === value ? "border-[#1E8A3C] text-[#1E8A3C]" : ""}`} aria-pressed={deleted === value} disabled={loading || saving} onClick={() => { setDeleted(value); setSelectedId(null); setCampaigns([]); setShowForm(false); setSourceFilter(""); setMediumFilter("") }}>{value ? "Corbeille" : "Mes campagnes"}</button>)}</div>
            <p className="text-xs text-[#6B7280]">{deleted ? "Historique conservé. Les liens supprimés ouvrent le catalogue sans compter de nouvelle visite. Une restauration laisse le lien désactivé." : "Totaux depuis la création. Utilisez le lien dans vos emails ou publications, ou téléchargez son QR code."}</p>
            <div className="flex flex-wrap gap-3">
              <label className="text-sm">Filtrer par source<select className={inputClass} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}><option value="">Toutes les sources</option>{Array.from(new Set(campaigns.map(row => row.source))).sort().map(value => <option key={value}>{value}</option>)}</select></label>
              <label className="text-sm">Filtrer par support<select className={inputClass} value={mediumFilter} onChange={e => setMediumFilter(e.target.value)}><option value="">Tous les supports</option>{Array.from(new Set(campaigns.map(row => row.medium))).sort().map(value => <option key={value}>{value}</option>)}</select></label>
            </div>
          </div>
          {loading ? <p role="status" className="p-5">Chargement…</p> : filtered.length === 0 ? <p className="p-5 text-sm text-[#6B7280]">{deleted ? "Aucune campagne dans cette sélection de la corbeille." : "Aucune campagne dans cette sélection. Créez un lien pour commencer."}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs text-[#6B7280]"><tr>{["Campagne", "Source / support", "Statut", "Visites", "Visiteurs estimés", "Commandes", "Actions"].map(label => <th className="whitespace-nowrap px-5 py-3" key={label}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{filtered.map(row => <tr key={row.id} className={selectedId === row.id ? "bg-[#F0FDF4]" : ""}>
              <td className="px-5 py-4"><button className="text-left font-semibold text-[#1E8A3C] hover:underline" onClick={() => setSelectedId(row.id)}>{row.name}</button><p className="mt-1 text-xs text-[#6B7280]">{row.short_url}</p></td>
              <td className="px-5 py-4">{row.source}<span className="block text-xs text-[#6B7280]">{row.medium}</span></td>
              <td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs ${row.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{row.deleted_at ? "Corbeille" : row.active ? "Actif" : "Désactivé"}</span></td>
              <td className="px-5 py-4">{row.visits}</td><td className="px-5 py-4">{row.visitors}</td><td className="px-5 py-4">{row.orders}</td>
              <td className="px-5 py-4"><div className="flex gap-2">{deleted ? <button disabled={saving} className={buttonClass} onClick={() => void changeTrash(row, true)} aria-label={`Restaurer ${row.name}`}>Restaurer</button> : <><button disabled={saving} className={buttonClass} onClick={() => edit(row)} aria-label={`Modifier ${row.name}`}><Pencil className="h-4 w-4" />Modifier</button><button disabled={saving} className={`${buttonClass} text-red-700`} onClick={() => setPendingTrash(row)} aria-label={`Supprimer ${row.name}`}>Supprimer</button></>}</div></td>
            </tr>)}</tbody>
          </table></div>}
        </section>
        <AlertDialog open={pendingTrash !== null} onOpenChange={open => { if (!open && !saving) setPendingTrash(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Déplacer cette campagne dans la corbeille ?</AlertDialogTitle><AlertDialogDescription>« {pendingTrash?.name} » restera restaurable. Ses anciens liens et QR ouvriront le catalogue sans nouvelle visite comptée. Le nom du lien restera réservé et les statistiques seront conservées.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel disabled={saving}>Annuler</AlertDialogCancel><AlertDialogAction disabled={saving} className="bg-red-700 hover:bg-red-800" onClick={event => { event.preventDefault(); if (pendingTrash) void changeTrash(pendingTrash, false) }}>{saving ? "Suppression…" : "Mettre à la corbeille"}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {selected && <div className="grid items-start gap-5 xl:grid-cols-[300px_1fr]">
          <section className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="font-bold">{selected.name}</h2>
            <p className="break-all text-sm">{selected.short_url}</p>
            <button className={`${buttonClass} w-full`} onClick={() => void copy()}><Copy className="h-4 w-4" />Copier le lien</button>
            <p className="text-xs text-[#6B7280]">Collez ce lien dans votre email, publication ou statut. Chaque ouverture admissible est suivie comme un scan du QR.</p>
            <details className="space-y-3">
              <summary className="cursor-pointer text-sm font-semibold text-[#1E8A3C]">QR code à télécharger</summary>
              {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={`QR code ${selected.name}`} width={260} height={260} className="mx-auto w-full max-w-64" /> : <p>Chargement du QR…</p>}
              <div className="flex gap-2"><button disabled={!svg} className={`${buttonClass} flex-1`} onClick={() => void download("svg")}><Download className="h-4 w-4" />SVG</button><button disabled={!svg} className={`${buttonClass} flex-1`} onClick={() => void download("png")}><Download className="h-4 w-4" />PNG</button></div>
            </details>
            <a href={selected.target_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[#1E8A3C]"><ExternalLink className="h-4 w-4" />Voir la destination</a>
            <p className="text-xs text-[#6B7280]">Cet aperçu et les téléchargements ne comptent pas comme des visites du QR.</p>
          </section>
          <section className="space-y-5 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3"><h2 className="font-bold">Trafic de la campagne</h2><div className="flex flex-wrap gap-3"><label className="text-xs">Du<input aria-label="Début de période" type="date" className={inputClass} value={start} max={end} onChange={e => setStart(e.target.value)} /></label><label className="text-xs">Au<input aria-label="Fin de période" type="date" className={inputClass} value={end} min={start} onChange={e => setEnd(e.target.value)} /></label></div></div>
            {stats ? <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Visites", stats.visits], ["Visiteurs estimés", stats.visitors], ["Commandes attribuées", stats.orders], ["Dont livrées", stats.delivered_orders]].map(([label, count]) => <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs text-[#6B7280]">{label}</p><p className="mt-2 text-2xl font-bold text-[#1E8A3C]">{count}</p></div>)}</div>
            {stats.days.length > 0 ? <div className="h-64 w-full" aria-label="Évolution des visites par jour"><ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.days}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tickFormatter={day => String(day).slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="visits" name="Visites" stroke="#1E8A3C" fill="#DCFCE7" /><Area type="monotone" dataKey="visitors" name="Visiteurs estimés" stroke="#F07C00" fill="transparent" /></AreaChart></ResponsiveContainer></div> : <p className="py-10 text-center text-sm text-[#6B7280]">Aucune visite sur cette période.</p>}</> : <p role="status">Chargement des statistiques…</p>}
            <p className="text-xs leading-relaxed text-[#6B7280]">Une visite correspond à une ouverture du lien actif. Les visiteurs estimés sont des navigateurs reconnus par un cookie pendant 30 jours, pas un nombre exact de personnes. Les robots connus, requêtes HEAD et préchargements identifiables sont exclus ; certains accès automatisés peuvent rester indétectables. Attribution au dernier clic, par navigateur, dans les 30 jours. Changer de navigateur ou supprimer les cookies peut faire perdre ce lien, notamment dans les navigateurs intégrés à Instagram et Facebook. Une attribution ne prouve pas que la campagne a déclenché l’achat. La période filtre la date de visite (UTC) ; les commandes incluent celles annulées, le nombre livré est affiché séparément.</p>
          </section>
        </div>}
      </main>
    </div>
  </div>
}
