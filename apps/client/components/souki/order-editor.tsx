"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { useOrderLock } from "@/hooks/useOrderLock"
import { useClientStorageOwner } from "@/hooks/useClientCollection"
import { ApiError, cancelOrder, getOrderForEdit, previewOrderEdit, saveOrderEdit, type OrderEditLine, type OrderEditResponse } from "@/lib/api"
import { fetchCatalogueProducts, type CatalogueProduct } from "@/lib/catalogue"
import { formatDeliveryDate } from "@/lib/order-hours"
import { SoukiLogoLink } from "@/components/souki/souki-logo"
import { useLocale } from "@/contexts/locale-context"

const dh = (value: number) => `${value.toFixed(2)} DH`
const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#CFE6D2] px-4 py-2 font-bold text-[#176B2E] hover:bg-[#F0FAF1] disabled:opacity-50"

export function OrderEditor({ orderId }: { orderId: number }) {
  const { t, dateLocale, productName, unitLabel, quantityLabel, zoneProps } = useLocale()
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
  const [confirmCancel, setConfirmCancel] = useState(false)
  const cancelDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (confirmCancel && order && isAuthenticated) cancelDialog.current?.showModal()
    else cancelDialog.current?.close()
  }, [confirmCancel, order, isAuthenticated])

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setQuote(null)
    try {
      const value = await getOrderForEdit(orderId, signal)
      if (signal?.aborted) return
      setOrder(value); setItems(value.items); setMustReload(false)
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : t("Impossible de charger la commande."))
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
  // Paiement complet par Wallet : la difference passe par le Wallet. Sinon, credit partiel eventuel + reste a la porte.
  const fullWallet = order?.mode_paiement.toLowerCase() === "wallet"
  const cancelLocked = !order?.cancellable || isLocked || expired || mustReload
  const cancel = async () => {
    if (!order || cancelLocked || busy) return
    setBusy(true); setError("")
    try {
      await cancelOrder(orderId, order.version)
      router.replace(`/historique?commande_annulee=${orderId}`)
    } catch (e) {
      setConfirmCancel(false)
      setError(e instanceof Error ? e.message : t("Impossible d’annuler la commande."))
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) setMustReload(true)
    } finally { setBusy(false) }
  }
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
      setError(e instanceof Error ? e.message : t("Impossible d’enregistrer les modifications."))
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) setMustReload(true)
    } finally { setBusy(false) }
  }

  const filtered = products.filter(product => product.name.toLowerCase().includes(search.toLowerCase()))
  return <div {...zoneProps} className="min-h-screen bg-[#FBFDF9] pb-12 text-[#264129]">
    <header className="border-b border-[#E7F0E8] bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
        <Link href="/historique" className={actionClass}><ArrowLeft className="h-4 w-4" /> {t("Mes commandes")}</Link>
        <SoukiLogoLink height={32} />
      </div>
    </header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-2xl font-black text-[#1E8A3C]">{t("Gérer ma commande")}</h1>
      {authLoading || loading ? <p role="status">{t("Chargement de la commande…")}</p> : !isAuthenticated ?
        <p>{t("Connectez-vous pour retrouver votre commande.")} <Link href="/login/client" className="underline">{t("Se connecter")}</Link></p> : <>
        {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
        {order && <>
          <section className="rounded-2xl border border-[#D7EBD9] bg-white p-5">
            <p className="font-bold">{t("Commande N-{id}", { id: order.commande_id })}</p>
            <p className="mt-1 text-sm">{t("Livraison le {date}", { date: t(formatDeliveryDate(order.date_livraison, dateLocale)) })} · {order.creneau_livraison}</p>
            <p className="mt-2 text-sm">{t("Vous pouvez ajouter ou retirer des produits et changer les quantités jusqu’à 01 h du matin, le jour de la livraison.")}</p>
            {locked && <p role="status" className="mt-3 font-bold text-amber-800">{mustReload ? t("Rechargez la commande pour consulter son état actuel.") : t(order.reason || "La clôture est atteinte. Cette commande ne peut plus être modifiée.")}</p>}
          </section>
          <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5" aria-label={t("Produits de la commande")}>
            <h2 className="text-lg font-bold">{t("Vos produits")}</h2>
            {items.length === 0 && <p>{t("Ajoutez au moins un produit.")}</p>}
            {items.map(item => {
              const product = products.find(p => p.id === item.product_id)
              const step = product?.quantityStep || (item.unit === "kg" ? 0.5 : 1)
              const name = productName({ name: item.name, nameAr: product?.nameAr })
              return <div key={item.product_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7FCF7] p-3">
                <div><p className="font-bold">{name}</p><p className="text-sm"><bdi dir="ltr">{dh(item.unit_price)}</bdi> / {unitLabel(item.unit)}</p></div>
                <div className="flex items-center gap-2">
                  <button aria-label={t("Diminuer {name}", { name })} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, item.quantity - step)}><Minus className="h-4 w-4" /></button>
                  <span className="min-w-14 text-center text-sm font-bold">{quantityLabel(item.quantity, item.unit)}</span>
                  <button aria-label={t("Augmenter {name}", { name })} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, item.quantity + step)}><Plus className="h-4 w-4" /></button>
                  <button aria-label={t("Retirer {name}", { name })} disabled={locked || busy} className={actionClass} onClick={() => changeQuantity(item.product_id, 0)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            })}
          </section>
          {!locked && <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5">
            <h2 className="text-lg font-bold">{t("Ajouter des produits")}</h2>
            <input aria-label={t("Rechercher un produit")} placeholder={t("Rechercher un produit")} value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 w-full rounded-xl border border-[#CFE6D2] px-3" />
            {products.length === 0 && <p>{t("Catalogue indisponible. Vous pouvez modifier les quantités existantes ou recharger la page.")}</p>}
            <div className="max-h-72 space-y-2 overflow-auto">{filtered.map(product => <div key={product.id} className="flex items-center justify-between gap-3 border-b border-[#EEF2EE] py-2">
              <span>{productName(product)} <span className="text-sm text-[#6F8070]"><bdi dir="ltr">{dh(order.items.find(item => item.product_id === product.id)?.unit_price ?? product.price)}</bdi> / {unitLabel(product.unit)}</span></span>
              <button className={actionClass} disabled={busy || product.availability === "out_of_stock"} aria-label={t("Ajouter {name}", { name: productName(product) })} onClick={() => add(product)}><Plus className="h-4 w-4" /> {t("Ajouter")}</button>
            </div>)}</div>
          </section>}
          <section className="space-y-3 rounded-2xl border border-[#D7EBD9] bg-white p-5" aria-label={t("Récapitulatif de modification")}>
            <p>{t("Montant actuel :")} <strong>{dh(order.total)}</strong>{!fullWallet && order.wallet_paid > 0 && <span className="text-sm text-[#6F8070]"> {t("dont {montant} payés par le Wallet", { montant: dh(order.wallet_paid) })}</span>}</p>
            {quote && <div aria-live="polite" className="space-y-2 rounded-xl bg-[#F0FAF1] p-4">
              <p>{t("Produits : {montant}", { montant: dh(quote.subtotal) })}</p><p>{t("Livraison : {montant}", { montant: dh(quote.delivery_fee) })}</p>
              <p className="text-lg font-black">{t("Nouveau total : {montant}", { montant: dh(quote.total) })}</p>
              {fullWallet ? (
                <p>{quote.difference > 0 ? t("Complément débité du Wallet : {montant}", { montant: dh(quote.difference) }) : quote.difference < 0 ? t("Montant recrédité au Wallet : {montant}", { montant: dh(-quote.difference) }) : t("Aucun ajustement du Wallet.")}</p>
              ) : (
                <>
                  {quote.wallet_paid > 0 && <p>{t("Déjà payé par le Wallet : {montant}", { montant: dh(quote.wallet_paid) })}</p>}
                  {order.wallet_paid > quote.wallet_paid && <p>{t("Montant recrédité au Wallet : {montant}", { montant: dh(order.wallet_paid - quote.wallet_paid) })}</p>}
                  <p className="font-bold">{t("À payer à la livraison : {montant}", { montant: dh(quote.amount_due) })}</p>
                </>
              )}
              <p className="text-sm">{t("La date de livraison et le numéro de commande restent identiques.")}</p>
            </div>}
            <button disabled={locked || busy || items.length === 0} onClick={() => void submit(Boolean(quote))} className="min-h-12 w-full rounded-xl bg-[#1E8A3C] px-4 font-bold text-white hover:bg-[#176B2E] disabled:opacity-50">
              {busy ? t("Traitement…") : quote ? t("Enregistrer les modifications") : t("Vérifier le nouveau total")}
            </button>
            <p className="text-xs text-[#6F8070]">{t("Rien n’est enregistré avant votre confirmation. Les prix des produits déjà commandés sont conservés.")}</p>
          </section>
          <section className="space-y-3 rounded-2xl border border-red-200 bg-white p-5">
            <h2 className="text-lg font-bold">{t("Annuler la commande")}</h2>
            <p className="text-sm">{t("Possible avant 01 h le jour de la livraison, tant que la préparation n’a pas commencé.")}</p>
            <button disabled={cancelLocked || busy} onClick={() => setConfirmCancel(true)} className="min-h-12 w-full rounded-xl border border-red-300 px-4 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{t("Annuler ma commande")}</button>
            {cancelLocked && <p className="text-sm text-amber-800">{mustReload ? t("Rechargez la commande pour consulter son état actuel.") : t(order.cancellation_reason || "L’annulation de cette commande est fermée.")}</p>}
          </section>
          <dialog ref={cancelDialog} aria-labelledby="cancel-title" aria-describedby="cancel-description" onCancel={event => { if (busy) event.preventDefault(); else setConfirmCancel(false) }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 text-[#264129] backdrop:bg-black/50">
            <h2 id="cancel-title" className="text-xl font-bold">{t("Annuler la commande N-{id} ?", { id: order.commande_id })}</h2>
            <p id="cancel-description" className="mt-3 text-sm">{t("Cette action est définitive.")} {fullWallet ? t("Le total payé de {montant}, livraison comprise, sera recrédité sur votre Wallet.", { montant: dh(order.total) }) : order.wallet_paid > 0 ? t("Les {montant} payés par le Wallet seront recrédités, et vous n’aurez rien à payer à la livraison.", { montant: dh(order.wallet_paid) }) : t("Vous n’aurez rien à payer pour cette commande.")} {t("Les modifications non enregistrées seront abandonnées.")}</p>
            {cancelLocked && <p role="alert" className="mt-3 text-sm text-amber-800">{t("L’annulation n’est plus disponible. Fermez cette fenêtre et rechargez la commande.")}</p>}
            <div className="mt-5 flex flex-col gap-3">
              <button autoFocus disabled={busy} onClick={() => setConfirmCancel(false)} className={actionClass}>{t("Garder ma commande")}</button>
              <button disabled={cancelLocked || busy} onClick={() => void cancel()} className="min-h-12 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-700 disabled:opacity-50">{busy ? t("Annulation…") : t("Confirmer l’annulation")}</button>
            </div>
          </dialog>
        </>}
        {(mustReload || (!order && error)) && <button disabled={busy} className={actionClass} onClick={() => void load()}>{t("Recharger la commande")}</button>}
      </>}
    </main>
  </div>
}
