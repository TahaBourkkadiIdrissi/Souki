"use client"

import { createElement, useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertTriangle, CircleDollarSign, Gift, LayoutDashboard, MapPinned, Menu, Package, Pencil, Plus, QrCode, RefreshCw, Search, ShoppingBasket, Tags, Truck, Users, X } from "lucide-react"
import { SoukiLogoLink } from "@/components/souki/souki-logo"
import { useAuth } from "@/hooks/useAuth"
import { createCategory, getProduitsPricing, listCategories, setCategoryProducts, updateCategory, type Category, type CategoryForm, type ProduitPricingDTO } from "@/lib/api"
import { CATEGORY_ICONS, categoryIcon } from "@/lib/category-icons"

const emptyForm: CategoryForm & { slug: string } = { nom: "", slug: "", icone: null, produit_vedette_id: null, ordre: 0, actif: true }
const inputClass = "min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
const primaryClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E8A3C] px-4 text-sm font-semibold text-white hover:bg-[#166d30] disabled:opacity-50"
// Identifiant d'URL (?focus=) dérivé du nom : minuscules, sans accents, tirets.
const toSlug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48).replace(/-+$/g, "")
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

export default function CategoriesPage() {
  const { isAuthenticated, token, can } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<ProduitPricingDTO[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  // Brouillon des cases cochees, valable pour une seule categorie.
  const [draft, setDraft] = useState<{ categoryId: number; ids: Set<number> } | null>(null)
  const [productQuery, setProductQuery] = useState("")
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const selected = categories.find(item => item.id === selectedId) ?? null
  const assigned = useMemo(
    () => draft && draft.categoryId === selected?.id ? draft.ids : new Set(selected?.product_ids ?? []),
    [draft, selected]
  )
  // Le produit phare se choisit parmi les produits deja enregistres dans la categorie.
  const featuredOptions = useMemo(
    () => editing ? products.filter(product => editing.product_ids.includes(product.id)).sort((left, right) => left.nom_fr.localeCompare(right.nom_fr)) : [],
    [editing, products]
  )
  const dirty = Boolean(selected) && (selected!.product_ids.length !== assigned.size || selected!.product_ids.some(id => !assigned.has(id)))
  const visibleProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase()
    return products
      .filter(product => !query || product.nom_fr.toLowerCase().includes(query) || product.nom_darija.toLowerCase().includes(query))
      .sort((left, right) => Number(assigned.has(right.id)) - Number(assigned.has(left.id)) || left.nom_fr.localeCompare(right.nom_fr))
  }, [products, productQuery, assigned])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [rows, pricing] = await Promise.all([listCategories(), getProduitsPricing(token ?? "")])
      setCategories(rows)
      setProducts(pricing.items)
      setSelectedId(current => rows.some(row => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible.") }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (isAuthenticated) void load() }, [isAuthenticated, load])

  const startCreate = () => {
    setEditing(null); setForm(emptyForm); setError(""); setNotice(""); setShowForm(true)
  }
  const startEdit = (row: Category) => {
    setEditing(row); setForm({ nom: row.nom, slug: row.slug, icone: row.icone, produit_vedette_id: row.produit_vedette_id, ordre: row.ordre, actif: row.actif }); setError(""); setNotice(""); setShowForm(true)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    if (!editing && !/^[a-z0-9][a-z0-9-]{0,46}[a-z0-9]$/.test(form.slug)) {
      setError("L'identifiant doit contenir 2 à 48 caractères : minuscules, chiffres et tirets au milieu."); return
    }
    setSaving(true); setError(""); setNotice("")
    try {
      const { slug, ...values } = form
      const result = editing ? await updateCategory(editing.id, values) : await createCategory({ ...values, slug })
      setShowForm(false); setEditing(null); setForm(emptyForm)
      await load(); setSelectedId(result.id)
      setNotice(editing ? "Catégorie mise à jour." : "Catégorie créée. Cochez maintenant ses produits.")
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible.") }
    finally { setSaving(false) }
  }
  const toggleProduct = (id: number) => {
    if (!selected) return
    const next = new Set(assigned)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setDraft({ categoryId: selected.id, ids: next })
  }
  const saveProducts = async () => {
    if (!selected || saving) return
    setSaving(true); setError(""); setNotice("")
    try {
      const result = await setCategoryProducts(selected.id, Array.from(assigned))
      setCategories(rows => rows.map(row => row.id === result.id ? result : row))
      setDraft(null)
      setNotice(`${result.product_ids.length} produit${result.product_ids.length > 1 ? "s" : ""} dans « ${result.nom} ».`)
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible.") }
    finally { setSaving(false) }
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
          {navItems.filter(item => can(item.permission)).map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/admin/categories" ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${item.href === "/admin/categories" ? "bg-white/20 font-semibold" : "text-white/75 hover:bg-white/10"}`}><item.icon className="h-5 w-5 shrink-0" />{item.label}</Link>)}
        </nav>
      </aside>
      {sidebarOpen && <button aria-label="Fermer le menu" className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <main className="min-w-0 flex-1 space-y-6 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-bold">Catégories</h1><p className="mt-1 text-sm text-[#6B7280]">Les rayons du catalogue client et les produits qu&apos;ils contiennent.</p></div>
          <div className="flex gap-2"><button className={buttonClass} disabled={loading || saving} onClick={() => void load()}><RefreshCw className="h-4 w-4" />Actualiser</button><button className={primaryClass} disabled={loading || saving} onClick={startCreate}><Plus className="h-4 w-4" />Nouvelle catégorie</button></div>
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-green-200 bg-[#F0FDF4] p-4 text-sm text-[#1E8A3C]">{notice}</p>}
        {showForm && <form onSubmit={submit} className="space-y-4 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">{editing ? "Modifier la catégorie" : "Créer une catégorie"}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">Nom affiché aux clients<input required maxLength={80} className={inputClass} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value, slug: editing ? form.slug : toSlug(e.target.value) })} placeholder="Fruits de saison" /></label>
            <label className="space-y-1 text-sm">Identifiant<input required disabled={Boolean(editing)} maxLength={48} className={inputClass} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().trim() })} placeholder="fruits-de-saison" /><span className="block text-xs text-[#6B7280]">Utilisé dans les liens du catalogue. Il ne change plus après la création.</span></label>
            <label className="space-y-1 text-sm">Ordre d&apos;affichage<input type="number" min={0} max={999} required className={inputClass} value={form.ordre} onChange={e => setForm({ ...form, ordre: Number(e.target.value) })} /><span className="block text-xs text-[#6B7280]">Le plus petit nombre apparaît en premier.</span></label>
            <label className="space-y-1 text-sm md:col-span-2">Produit phare
              {editing ? <select className={inputClass} value={form.produit_vedette_id ?? ""} onChange={e => setForm({ ...form, produit_vedette_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">Aucun : afficher l&apos;icône</option>
                {featuredOptions.map(product => <option key={product.id} value={product.id}>{product.nom_fr}{product.is_active ? "" : " (inactif)"}</option>)}
              </select> : <span className="block rounded-xl border border-dashed border-[#E5E7EB] p-3 text-xs text-[#6B7280]">Disponible après la création : cochez les produits de la catégorie, puis revenez la modifier.</span>}
              <span className="block text-xs text-[#6B7280]">Sa photo devient la tuile de la catégorie sur l&apos;accueil de l&apos;application.</span>
            </label>
            <fieldset className="space-y-2 text-sm md:col-span-2">
              <legend>Icône</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ICONS.map(item => <button key={item.key} type="button" title={item.label} aria-pressed={form.icone === item.key} onClick={() => setForm({ ...form, icone: form.icone === item.key ? null : item.key })} className={`flex h-11 w-11 items-center justify-center rounded-xl border ${form.icone === item.key ? "border-[#1E8A3C] bg-[#F0FDF4] text-[#1E8A3C]" : "border-[#E5E7EB] text-[#6B7280] hover:bg-gray-50"}`}><item.icon className="h-5 w-5" aria-hidden="true" /><span className="sr-only">{item.label}</span></button>)}
              </div>
              <span className="block text-xs text-[#6B7280]">Affichée sur la tuile quand la catégorie n&apos;a pas de produit phare.</span>
            </fieldset>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} />Visible dans le catalogue client</label>
          <div className="flex flex-wrap gap-2"><button disabled={saving} className={primaryClass}>{saving ? "Enregistrement..." : editing ? "Enregistrer" : "Créer la catégorie"}</button><button type="button" className={buttonClass} onClick={() => { setShowForm(false); setEditing(null) }}>Annuler</button></div>
        </form>}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="border-b border-[#E5E7EB] bg-gray-50 px-4 py-3 text-sm font-semibold">Rayons</div>
            {loading ? <p className="p-4 text-sm text-[#6B7280]">Chargement...</p> : categories.length === 0 ? <p className="p-4 text-sm text-[#6B7280]">Aucune catégorie. Créez la première pour organiser le catalogue.</p> :
              <ul className="divide-y divide-[#E5E7EB]">
                {categories.map(row => <li key={row.id} className={`flex items-center gap-3 px-4 py-3 ${row.id === selectedId ? "bg-[#F0FDF4]" : "hover:bg-gray-50"}`}>
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-current={row.id === selectedId} onClick={() => { setSelectedId(row.id); setNotice("") }}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F0] text-[#1E8A3C]" aria-hidden="true">{createElement(categoryIcon(row.icone), { className: "h-5 w-5" })}</span>
                    <span className="min-w-0"><span className="block truncate font-semibold">{row.nom}</span><span className="block text-xs text-[#6B7280]">{row.slug} · ordre {row.ordre} · {row.product_ids.length} produit{row.product_ids.length > 1 ? "s" : ""}</span></span>
                  </button>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${row.actif ? "border-green-200 bg-[#F0FDF4] text-[#1E8A3C]" : "border-gray-200 bg-gray-50 text-gray-500"}`}>{row.actif ? "Visible" : "Masquée"}</span>
                  <button aria-label={`Modifier ${row.nom}`} className="rounded-lg p-2 text-[#6B7280] hover:bg-gray-100" onClick={() => startEdit(row)}><Pencil className="h-4 w-4" /></button>
                </li>)}
              </ul>}
          </section>
          <section className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold">{selected ? `Produits de « ${selected.nom} »` : "Produits"}</p>
              {selected && <button className={primaryClass} disabled={saving || !dirty} onClick={() => void saveProducts()}>{saving ? "Enregistrement..." : `Enregistrer (${assigned.size})`}</button>}
            </div>
            {!selected ? <p className="p-4 text-sm text-[#6B7280]">Choisissez une catégorie pour lui attribuer des produits.</p> : <div className="space-y-3 p-4">
              <p className="text-xs text-[#6B7280]">Un produit peut appartenir à plusieurs catégories. Un produit sans catégorie garde son ancien rayon.</p>
              <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" /><span className="sr-only">Rechercher un produit</span><input className={`${inputClass} pl-9`} value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder="Rechercher un produit" /></label>
              <ul className="max-h-[60vh] divide-y divide-[#E5E7EB] overflow-y-auto rounded-xl border border-[#E5E7EB]">
                {visibleProducts.map(product => <li key={product.id}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    <input type="checkbox" checked={assigned.has(product.id)} onChange={() => toggleProduct(product.id)} className="h-4 w-4 accent-[#1E8A3C]" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{product.nom_fr}</span><span className="block truncate text-xs text-[#6B7280]">{product.nom_darija} · {product.unite}</span></span>
                    {!product.is_active && <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-500">Inactif</span>}
                  </label>
                </li>)}
                {visibleProducts.length === 0 && <li className="p-3 text-sm text-[#6B7280]">Aucun produit ne correspond à cette recherche.</li>}
              </ul>
            </div>}
          </section>
        </div>
      </main>
    </div>
  </div>
}
