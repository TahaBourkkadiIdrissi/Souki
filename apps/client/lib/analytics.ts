"use client"

type AnalyticsParams = Record<string, string | number | boolean | null | undefined | object>

declare global {
  interface Window {
    dataLayer?: unknown[][]
    gtag?: (...args: unknown[]) => void
  }
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && typeof window !== "undefined" &&
      (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_GA_DEBUG === "true")) {
    // GA's external script loads after hydration. Queue early interactions so
    // view_item and begin_checkout are not lost before it becomes available.
    window.dataLayer ||= []
    window.gtag ||= (...args: unknown[]) => { window.dataLayer?.push(args) }
    const debug = process.env.NEXT_PUBLIC_GA_DEBUG === "true" || new URLSearchParams(window.location.search).get("ga_debug") === "1"
    window.gtag("event", eventName, { ...params, ...(debug ? { debug_mode: true, traffic_type: "developer" } : {}) })
    return true
  }
  return false
}

export interface ConfirmedPurchase {
  commande_id: number
  sous_total: number
  frais_livraison: number
  montant_total: number
  lignes: Array<{ product_id: number; nom_produit: string; prix_unitaire: number; quantite: number }>
}

const purchasesSent = new Set<string>()

/** Only confirmed server order lines are sent. An older API response is skipped
 * rather than reconstructed from client prices. Deploy the API before the UI.
 */
export function trackPurchase(order: ConfirmedPurchase) {
  if (typeof window === "undefined" || !Number.isInteger(order.commande_id) ||
      order.commande_id <= 0 ||
      !Array.isArray(order.lignes) || order.lignes.length === 0 ||
      !Number.isFinite(order.sous_total) || order.sous_total < 0 ||
      !Number.isFinite(order.frais_livraison) || order.frais_livraison < 0 ||
      order.lignes.some((line) => !Number.isFinite(line.prix_unitaire) || line.prix_unitaire < 0 ||
        !Number.isFinite(line.quantite) || line.quantite <= 0)) return
  const id = String(order.commande_id)
  if (purchasesSent.has(id)) return
  let previous: string[] = []
  try {
    const stored = JSON.parse(window.localStorage.getItem("souki-ga4-purchases") || "[]")
    if (Array.isArray(stored)) previous = stored.filter((value): value is string => typeof value === "string")
  } catch { /* Analytics must never interrupt checkout when storage is denied. */ }
  if (previous.includes(id)) return
  const queued = trackEvent("purchase", {
    transaction_id: id,
    currency: "MAD",
    // GA4 ecommerce value excludes shipping, reported separately.
    value: order.sous_total,
    shipping: order.frais_livraison,
    items: order.lignes.map((line) => ({
      item_id: String(line.product_id), item_name: line.nom_produit,
      price: line.prix_unitaire, quantity: line.quantite,
    })),
  })
  if (!queued) return
  purchasesSent.add(id)
  try { window.localStorage.setItem("souki-ga4-purchases", JSON.stringify([...previous, id])) }
  catch { /* In-memory deduplication remains available. */ }
}
