"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Minus, Pencil, Plus, Search, X } from "lucide-react"

import { useAuth } from "@/hooks/useAuth"
import {
  createPanierSouki,
  getProduitsPricing,
  listPaniersSouki,
  updatePanierSouki,
  type PanierSoukiDTO,
  type PanierSoukiForm,
  type ProduitPricingDTO,
} from "@/lib/api"
import { formatDh } from "@/lib/commandes-recurrentes"

const inputClass = "min-h-11 w-full rounded-xl border border-[var(--adm-line)] bg-white px-3 text-sm focus:border-[#1E8A3C] focus:outline-none"
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--adm-line)] bg-white px-4 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
const MINIMUM_DH = 50
const FRAIS_LIVRAISON = 15
const SEUIL_LIVRAISON_GRATUITE = 300

type Draft = PanierSoukiForm & { id: number | null }

const emptyDraft = (ordre: number): Draft => ({ id: null, nom: "", description: null, image_url: null, actif: true, ordre, lignes: [] })

const prixDuJour = (product: ProduitPricingDTO) => product.prix_affiche ?? product.prix_kg

/**
 * Paniers proposes a l'abonnement sur la page Abonnements du site client.
 * Le client s'abonne a un panier puis peut en modifier le contenu ; le prix suit toujours le prix du jour.
 */
export function PaniersSoukiPanel() {
  const { token } = useAuth()
  const [paniers, setPaniers] = useState<PanierSoukiDTO[]>([])
  const [products, setProducts] = useState<ProduitPricingDTO[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const [rows, pricing] = await Promise.all([listPaniersSouki(), getProduitsPricing(token ?? "")])
      setPaniers(rows)
      setProducts(pricing.items)
    } catch (e) { setError(e instanceof Error ? e.message : "Chargement impossible.") }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { void load() }, [load])

  const productsById = useMemo(() => new Map(products.map(product => [product.id, product])), [products])
  const estimation = useMemo(() => {
    if (!draft) return { sousTotal: 0, frais: 0 }
    const sousTotal = draft.lignes.reduce((sum, ligne) => {
      const product = productsById.get(ligne.product_id)
      return product && product.is_active ? sum + prixDuJour(product) * ligne.quantite : sum
    }, 0)
    return { sousTotal, frais: sousTotal >= SEUIL_LIVRAISON_GRATUITE || sousTotal === 0 ? 0 : FRAIS_LIVRAISON }
  }, [draft, productsById])
  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle || !draft) return []
    const taken = new Set(draft.lignes.map(ligne => ligne.product_id))
    return products
      .filter(product => product.is_active && !taken.has(product.id))
      .filter(product => product.nom_fr.toLowerCase().includes(needle) || product.nom_darija.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [products, query, draft])

  const edit = (panier: PanierSoukiDTO) => {
    setNotice(""); setError(""); setQuery("")
    setDraft({
      id: panier.id, nom: panier.nom, description: panier.description, image_url: panier.image_url, actif: panier.actif,
      ordre: panier.ordre, lignes: panier.lignes.map(ligne => ({ product_id: ligne.product_id, quantite: ligne.quantite })),
    })
  }

  const setLigne = (productId: number, quantite: number) => setDraft(current => current && ({
    ...current,
    lignes: quantite > 0
      ? current.lignes.map(ligne => ligne.product_id === productId ? { ...ligne, quantite: Math.round(quantite * 100) / 100 } : ligne)
      : current.lignes.filter(ligne => ligne.product_id !== productId),
  }))

  const addProduct = (product: ProduitPricingDTO) => {
    setDraft(current => current && ({ ...current, lignes: [...current.lignes, { product_id: product.id, quantite: 1 }] }))
    setQuery("")
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft || saving) return
    setSaving(true); setError(""); setNotice("")
    const { id, ...body } = draft
    try {
      const saved = id === null ? await createPanierSouki(body) : await updatePanierSouki(id, body)
      setPaniers(current => (id === null ? [...current, saved] : current.map(row => row.id === saved.id ? saved : row))
        .sort((left, right) => left.ordre - right.ordre || left.id - right.id))
      setNotice(id === null ? `« ${saved.nom} » est créé.` : `« ${saved.nom} » est enregistré.`)
      setDraft(null)
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible.") }
    finally { setSaving(false) }
  }

  const toggleActif = async (panier: PanierSoukiDTO) => {
    if (saving) return
    setSaving(true); setError(""); setNotice("")
    try {
      const saved = await updatePanierSouki(panier.id, {
        nom: panier.nom, description: panier.description, image_url: panier.image_url, actif: !panier.actif, ordre: panier.ordre,
        lignes: panier.lignes.map(ligne => ({ product_id: ligne.product_id, quantite: ligne.quantite })),
      })
      setPaniers(current => current.map(row => row.id === saved.id ? saved : row))
      setNotice(saved.actif ? `« ${saved.nom} » est de nouveau proposé aux clients.` : `« ${saved.nom} » n'est plus proposé. Les abonnés actuels le gardent.`)
    } catch (e) { setError(e instanceof Error ? e.message : "Action impossible.") }
    finally { setSaving(false) }
  }

  const sousMinimum = draft !== null && estimation.sousTotal < MINIMUM_DH

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--adm-line)] bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Paniers proposés aux clients</h2>
        <p className="text-sm text-[var(--adm-muted)]">Affichés sur la page Abonnements. Prix au jour le jour, sans remise ni frais d&apos;abonnement.</p>
      </div>
      <button className={`${buttonClass} border-[#1E8A3C] text-[#1E8A3C]`} disabled={loading} onClick={() => { setNotice(""); setError(""); setDraft(emptyDraft((paniers.at(-1)?.ordre ?? 0) + 1)) }}>
        <Plus className="h-4 w-4" />Nouveau panier
      </button>
    </div>

    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-green-200 bg-[var(--adm-green-soft)] p-4 text-sm text-[#1E8A3C]">{notice}</p>}

    {draft && <form onSubmit={save} className="space-y-4 rounded-xl border border-[#1E8A3C]/30 bg-white p-5 shadow-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{draft.id === null ? "Nouveau panier" : `Modifier « ${draft.nom} »`}</h3>
        <button type="button" aria-label="Fermer" className="rounded-lg p-2 text-[var(--adm-muted)] hover:bg-gray-50" onClick={() => setDraft(null)}><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto]">
        <label className="space-y-1 text-sm">Nom<input required maxLength={120} className={inputClass} value={draft.nom} onChange={e => setDraft({ ...draft, nom: e.target.value })} placeholder="Panier famille de la semaine" /></label>
        <label className="space-y-1 text-sm">Ordre d&apos;affichage<input type="number" min={0} max={1000} className={inputClass} value={draft.ordre} onChange={e => setDraft({ ...draft, ordre: Number(e.target.value) || 0 })} /></label>
        <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#1E8A3C]" checked={draft.actif} onChange={e => setDraft({ ...draft, actif: e.target.checked })} />Proposé aux clients</label>
      </div>
      <label className="block space-y-1 text-sm">Description (facultative)<textarea maxLength={1000} rows={2} className={`${inputClass} py-2`} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value || null })} placeholder="Pour qui, combien de repas, ce qu'il contient." /></label>
      <label className="block space-y-1 text-sm">Image (lien, facultatif)<input type="url" maxLength={500} className={inputClass} value={draft.image_url ?? ""} onChange={e => setDraft({ ...draft, image_url: e.target.value || null })} placeholder="https://…" /></label>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Contenu</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--adm-muted)]" />
          <input className={`${inputClass} pl-9`} value={query} onChange={e => setQuery(e.target.value)} placeholder="Ajouter un produit : tomate, maticha…" />
          {suggestions.length > 0 && <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--adm-line)] bg-white shadow-lg">
            {suggestions.map(product => <li key={product.id}><button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--adm-green-soft)]" onClick={() => addProduct(product)}>
              <span>{product.nom_fr} <span className="text-[var(--adm-muted)]">· {product.nom_darija}</span></span>
              <span className="text-[var(--adm-muted)]">{formatDh(prixDuJour(product))} / {product.unite}</span>
            </button></li>)}
          </ul>}
        </div>
        {draft.lignes.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--adm-line)] p-4 text-sm text-[var(--adm-muted)]">Ajoutez au moins un produit.</p> :
          <ul className="divide-y divide-[var(--adm-line)] rounded-xl border border-[var(--adm-line)]">
            {draft.lignes.map(ligne => {
              const product = productsById.get(ligne.product_id)
              const step = product?.unite === "kg" ? 0.5 : 1
              return <li key={ligne.product_id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className={product?.is_active === false ? "text-[var(--adm-muted)]" : ""}>{product?.nom_fr ?? `Produit #${ligne.product_id}`}{product?.is_active === false ? " (inactif, non facturé)" : ""}</span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label="Diminuer" className="rounded-lg border border-[var(--adm-line)] p-1.5" onClick={() => setLigne(ligne.product_id, ligne.quantite - step)}><Minus className="h-3.5 w-3.5" /></button>
                  <input aria-label="Quantité" type="number" min={0} step="0.1" className="w-20 rounded-lg border border-[var(--adm-line)] px-2 py-1 text-right tabular-nums" value={ligne.quantite} onChange={e => setLigne(ligne.product_id, Number(e.target.value))} />
                  <span className="w-8 text-[var(--adm-muted)]">{product?.unite}</span>
                  <button type="button" aria-label="Augmenter" className="rounded-lg border border-[var(--adm-line)] p-1.5" onClick={() => setLigne(ligne.product_id, ligne.quantite + step)}><Plus className="h-3.5 w-3.5" /></button>
                  <span className="w-24 text-right tabular-nums">{product ? formatDh(prixDuJour(product) * ligne.quantite) : "—"}</span>
                </span>
              </li>
            })}
          </ul>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--adm-paper)] px-4 py-3 text-sm">
        <span>Estimation au prix du jour : <strong className="tabular-nums">{formatDh(estimation.sousTotal)}</strong> + livraison {formatDh(estimation.frais)}</span>
        {sousMinimum && <span className="font-semibold text-red-700">Minimum {MINIMUM_DH} DH par livraison</span>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={() => setDraft(null)}>Annuler</button>
        <button className={`${buttonClass} border-[#1E8A3C] bg-[#1E8A3C] text-white hover:bg-[#176B2E]`} disabled={saving || sousMinimum || !draft.nom.trim() || draft.lignes.length === 0}>
          {saving ? "Enregistrement…" : "Enregistrer le panier"}
        </button>
      </div>
    </form>}

    {loading ? <p role="status" className="rounded-xl border border-[var(--adm-line)] bg-white p-5 text-sm">Chargement…</p> :
      paniers.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--adm-line)] bg-white p-6 text-sm text-[var(--adm-muted)]">Aucun panier proposé. La page Abonnements invite alors les clients à répéter une de leurs commandes.</p> :
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {paniers.map(panier => <article key={panier.id} className={`rounded-xl border bg-white p-4 shadow-sm ${panier.actif ? "border-[var(--adm-line)]" : "border-dashed border-[var(--adm-line)] opacity-70"}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{panier.nom}</h3>
              <p className="text-xs text-[var(--adm-muted)]">Ordre {panier.ordre} · {panier.lignes.length} produit{panier.lignes.length > 1 ? "s" : ""}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${panier.actif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{panier.actif ? "Proposé" : "Retiré"}</span>
          </div>
          <p className="mt-3 text-sm"><strong className="tabular-nums">{formatDh(panier.total_estime)}</strong> <span className="text-[var(--adm-muted)]">aujourd&apos;hui, livraison comprise</span></p>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--adm-muted)]">{panier.lignes.map(ligne => `${ligne.nom_produit} ${ligne.quantite} ${ligne.unite}`).join(", ")}</p>
          <div className="mt-3 flex gap-2">
            <button className={buttonClass} disabled={saving} onClick={() => edit(panier)}><Pencil className="h-4 w-4" />Modifier</button>
            <button className={buttonClass} disabled={saving} onClick={() => void toggleActif(panier)}>{panier.actif ? "Retirer" : "Proposer"}</button>
          </div>
        </article>)}
      </div>}
  </section>
}
