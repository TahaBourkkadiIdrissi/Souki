"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useOrderLock } from "@/hooks/useOrderLock"
import { useClientStorageOwner } from "@/hooks/useClientCollection"
import { ApiError, getOrderForEdit, previewOrderEdit, saveOrderEdit, type OrderEditLine, type OrderEditResponse } from "@/lib/api"
import { fetchCatalogueProducts, type CatalogueProduct } from "@/lib/catalogue"
import { formatDeliveryDate } from "@/lib/order-hours"
import { SoukiLogoLink } from "@/components/souki/souki-logo"

const dh = (value: number) => `${value.toFixed(2)} DH`
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CFE6D2] px-4 py-2 font-bold text-[#176B2E] hover:bg-[#F0FAF1] disabled:opacity-50"

export function OrderEditor({ orderId }: { orderId: number }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const owner = useClientStorageOwner()
  const { isLocked } = useOrderLock()
  const [order, setOrder] = useState<OrderEditResponse | null>(null)
  const [items, setItems] = useState<OrderEditLine[]>([])
  const [products, setProducts] = useState<CatalogueProduct[]>([])
  const [quote, setQuote] = useState<OrderEditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [expired, setExpired] = useState(false)
  const [mustReload, setMustReload] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setQuote(null)
    try {
      const value = await getOrderForEdit(orderId, signal)
      if (signal?.aborted) return
      setOrder(value); setItems(value.items); setMustReload(false)
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Impossible de charger la commande.")
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [orderId])

  useEffect(() => {
    if (authLoading) return
    setOrder(null); setItems([]); setQuote(null)
    if (!isAuthenticated || !Number.isSafeInteger(orderId) || orderId < 1) { setLoading(false); return }
    const controller = new AbortController()
    void load(controller.signal)
    fetchCatalogueProducts().then(value => { if (!controller.signal.aborted) setProducts(value) })
      .catch(() => { if (!controller.signal.aborted) setProducts([]) })
    return () => controller.abort()
  }, [authLoading, isAuthenticated, owner, orderId, load])

  useEffect(() => {
    if (!order?.deadline) { setExpired(true); return }
    const remaining = Date.parse(order.deadline) - Date.parse(order.server_time)
    setExpired(remaining <= 0)
    // Relative server time avoids an incorrectly set phone clock.
    const timer = window.setTimeout(() => { setExpired(true); setQuote(null) }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [order])

  const locked = !order?.editable || isLocked || expired || mustReload
  const changeQuantity = (id: number, quantity: number) => {
    if (locked || busy) return
    setQuote(null); setError("")
    setItems(current => quantity <= 0 ? current.filter(item => item.product_id !== id)
      : current.map(item => item.product_id === id ? { ...item, quantity: Number(quantity.toFixed(3)) } : item))
  }
  const add = (product: CatalogueProduct) => {
    if (locked || busy) return
    const existing = items.find(item => item.product_id === product.id)
    if (existing) { changeQuantity(product.id, existing.quantity + product.quantityStep); return }
    const original = order?.items.find(item => item.product_id === product.id)
    setQuote(null); setError("")
    setItems(current => [...current, original ? { ...original, quantity: product.quantityStep } : {
      product_id: product.id, name: product.name, unit: product.unit,
      quantity: product.quantityStep, unit_price: product.price, subtotal: product.price * product.quantityStep,
    }])
  }
  const submit = async (save: boolean) => {
    if (!order || locked || busy || items.length === 0 || (save && !quote)) return
    setBusy(true); setError("")
    const body = { expected_version: order.version, items: items.map(item => ({ product_id: item.product_id, quantity: item.quantity })) }
    try {
      if (save && quote) {
        await saveOrderEdit(orderId, { ...body, expected_total: quote.total })
        router.replace(`/historique?commande_modifiee=${orderId}`)
      } else {
        setQuote(await previewOrderEdit(orderId, body))
      }
    } catch (e) {
      setQuote(null)
      setError(e instanceof Error ? e.message : "Impossible d’enregistrer les modifications.")
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) setMustReload(true)
    } finally { setBusy(false) }
  }

  const filtered = products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()))
  return <div className="min-h-screen bg-[#FBFDF9] pb-12 text-[#264129]">
    <header className="border-b border-[#E7F0E8] bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/historique" className={actionClass}><ArrowLeft className="h-4 w-4" /> Mes commandes</Link>
        <SoukiLogoLink height={32} />
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-black text-[#1E8A3C]">Modifier ma commande</h1>
      {authLoading || loading ? <p role="status">Chargement de la commande…</p> : !isAuthenticated ?
        <p>Connectez-vous pour retrouver votre commande. <Link href="/login/client" className="underline">Se connecter</Link></p> : <>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
        {order && <>
          <section className="rounded-2xl border border-[#D7EBD9] bg-white p-5">
            <p className="font-bold">Commande N-{order.commande_id}</p>
            <p className="mt-1 text-sm">Livraison le {formatDeliveryDate(order.date_livraison)} · {order.creneau_livraison}</p>
            <p className="mt-2 text-sm">Vous pouvez ajouter ou retirer des produits et changer les quantités jusqu’à 01 h du matin, le jour de la livraison.</p>
            {locked && <p role="status" className="mt-3 font-bold text-amber-800">{mustReload ? "Rechargez la commande pour consulter son état actuel." : order.reason || "La clôture est atteinte. Cette commande ne peut plus être modifiée."}</p>}
          </section>
          <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5" aria-label="Produits de la commande">
            <h2 className="text-lg font-bold">Vos produits</h2>
            {items.length === 0 && <p>Ajoutez au moins un produit.</p>}
            {items.map(item => {
              const product = products.find(p => p.id === item.product_id)
              const step = product?.quantityStep || (item.unit === "kg" ? 0.5 : 1)
              return <div key={item.product_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7FCF7] p-3">
                <div><p className="font-bold">{item.name}</p><p className="text-sm">{dh(item.unit_price)} / {item.unit}</p></div>
                <div className="flex items-center gap-2">
                  <button aria-label={`Diminuer ${item.name}`} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, item.quantity - step)}><Minus className="h-4 w-4" /></button>
                  <span className="min-w-14 text-center text-sm font-bold">{item.quantity} {item.unit}</span>
                  <button aria-label={`Augmenter ${item.name}`} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, item.quantity + step)}><Plus className="h-4 w-4" /></button>
                  <button aria-label={`Retirer ${item.name}`} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, 0)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            })}
          </section>
          {!locked && <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5">
            <h2 className="text-lg font-bold">Ajouter des produits</h2>
            <input aria-label="Rechercher un produit" placeholder="Rechercher un produit" value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 w-full rounded-xl border border-[#CFE6D2] px-3" />
            {products.length === 0 && <p>Catalogue indisponible. Vous pouvez modifier les quantités existantes ou recharger la page.</p>}
            <div className="max-h-72 space-y-2 overflow-auto">{filtered.map(product => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-[#EEF2EE] py-2">
              <span>{product.name} <span className="text-sm text-[#6F8070]">{dh(order.items.find(item => item.product_id === product.id)?.unit_price ?? product.price)} / {product.unit}</span></span>
              <button className={actionClass} disabled={busy || product.availability === "out_of_stock"} aria-label={`Ajouter ${product.name}`} onClick={() => add(product)}><Plus className="h-4 w-4" /> Ajouter</button>
            </div>)}</div>
          </section>}
          <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5" aria-label="Récapitulatif de modification">
            <p>Montant actuel : <strong>{dh(order.total)}</strong></p>
            {quote && <div aria-live="polite" className="space-y-2 rounded-xl bg-[#F0FAF1] p-4">
              <p>Produits : {dh(quote.subtotal)}</p><p>Livraison : {dh(quote.delivery_fee)}</p>
              <p className="text-lg font-black">Nouveau total : {dh(quote.total)}</p>
              <p>{order.mode_paiement.toLowerCase() === "wallet" ? quote.difference > 0 ? `Complément débité du Wallet : ${dh(quote.difference)}` : quote.difference < 0 ? `Montant recrédité au Wallet : ${dh(-quote.difference)}` : "Aucun ajustement du Wallet." : `À payer à la livraison : ${dh(quote.total)}`}</p>
              <p className="text-sm">La date de livraison et le numéro de commande restent identiques.</p>
            </div>}
            <button disabled={locked || busy || items.length === 0} onClick={() => void submit(Boolean(quote))} className="min-h-12 w-full rounded-xl bg-[#1E8A3C] px-4 font-bold text-white hover:bg-[#176B2E] disabled:opacity-50">
              {busy ? "Traitement…" : quote ? "Enregistrer les modifications" : "Vérifier le nouveau total"}
            </button>
            <p className="text-xs text-[#6F8070]">Rien n’est enregistré avant votre confirmation. Les prix des produits déjà commandés sont conservés.</p>
          </section>
        </>}
        {(mustReload || (!order && error)) && <button disabled={busy} className={actionClass} onClick={() => void load()}>Recharger la commande</button>}
      </>}
    </main>
  </div>
}
