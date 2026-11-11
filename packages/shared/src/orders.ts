/**
 * Apres la commande : types de l'API, statuts et regles, repris de
 * apps/client/lib/order-status.ts, components/souki/order-edit-link.tsx et
 * back-end/services/claim_service.py. Le back-end reste l'autorite sur chaque action.
 */

/** Ligne de GET /api/commandes/historique (ProduitCommandeJourDTO). */
export interface OrderProductDTO {
  ligne_panier_id: number | null
  product_id: number | null
  nom_fr: string
  nom_ar: string | null
  quantite_kg: number
  sous_total: number | null
}

/** Element de GET /api/commandes/historique (CommandeHistoriqueDTO). */
export interface OrderHistoryDTO {
  id: number
  date_commande: string | null
  statut: string | null
  montant_total: number | null
  mode_paiement: string | null
  payment_validated: boolean | null
  montant_a_encaisser: number | null
  date_livraison: string | null
  creneau_livraison: string | null
  enroute_at: string | null
  delivered_at: string | null
  absent_at: string | null
  produits: OrderProductDTO[]
  paiement: { methode: string | null; montant: number | null; valide: boolean | null } | null
}

/** GET/POST/PATCH /api/commandes/{id}/modification (OrderEditResponseDTO). */
export interface OrderEditLineDTO {
  product_id: number
  name: string
  unit: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderEditResponseDTO {
  commande_id: number
  version: number
  editable: boolean
  reason: string | null
  cancellable: boolean
  cancellation_reason: string | null
  deadline: string | null
  server_time: string
  date_livraison: string | null
  creneau_livraison: string | null
  mode_paiement: string
  items: OrderEditLineDTO[]
  subtotal: number
  delivery_fee: number
  total: number
  previous_total: number
  difference: number
  wallet_paid: number
  amount_due: number
}

export interface OrderEditRequest {
  items: { product_id: number; quantity: number }[]
  expected_version: number
}

export interface OrderCancelResponseDTO {
  commande_id: number
  statut: string
  refunded_amount: number
}

/* ---------- Statuts et etapes ---------- */

export const ORDER_STEPS = [
  { title: "Commande confirmée", description: "Votre commande est bien enregistrée chez Souki." },
  { title: "Préparation", description: "Nos équipes préparent vos produits frais." },
  { title: "En livraison", description: "Votre commande est confiée au livreur." },
  { title: "Livrée", description: "Vos produits frais sont arrivés." },
] as const

/** `wait` en attente/preparation, `road` en route, `ok` livree, `issue` incident ou annulee. */
export type OrderTone = "wait" | "road" | "ok" | "issue"

const STATUS: Record<string, { label: string; step: number; tone: OrderTone }> = {
  BROUILLON: { label: "Brouillon", step: 0, tone: "wait" },
  EN_ATTENTE: { label: "En attente", step: 0, tone: "wait" },
  CONFIRMEE: { label: "Confirmée", step: 0, tone: "wait" },
  VERROUILLEE: { label: "En préparation", step: 1, tone: "wait" },
  EN_ATTENTE_LIVREUR: { label: "En attente livreur", step: 1, tone: "wait" },
  REFUS_LIVREUR: { label: "Réassignation en cours", step: 1, tone: "wait" },
  A_LIVRER: { label: "Prête à livrer", step: 2, tone: "road" },
  PLANIFIEE: { label: "Planifiée", step: 2, tone: "road" },
  EN_ROUTE: { label: "En route", step: 2, tone: "road" },
  RETOUR_DEPOT: { label: "Retour au dépôt", step: 2, tone: "issue" },
  ABSENT: { label: "Destinataire absent", step: 2, tone: "issue" },
  REFUS: { label: "Livraison refusée", step: 2, tone: "issue" },
  LIVRE: { label: "Livrée", step: 3, tone: "ok" },
  ANNULE: { label: "Annulée", step: 0, tone: "issue" },
  ANNULEE: { label: "Annulée", step: 0, tone: "issue" },
}

/** Messages du site pour les incidents et l'annulation. */
const ISSUE_MESSAGES: Record<string, string> = {
  ABSENT: "Le livreur n'a pas pu vous remettre la commande. Notre équipe peut vous aider à la reprogrammer.",
  REFUS: "La livraison a été refusée. Contactez-nous si cette information ne correspond pas à votre situation.",
  RETOUR_DEPOT: "La commande est retournée au dépôt. Notre équipe vous contactera pour la suite.",
  ANNULE: "Cette commande a été annulée.",
  ANNULEE: "Cette commande a été annulée.",
}

export function normalizeOrderStatus(status?: string | null): string {
  return (status || "").trim().toUpperCase().replace(/\s+/g, "_")
}

export interface OrderProgress {
  status: string
  label: string
  tone: OrderTone
  /** Etape en cours (0 a 3). */
  step: number
  delivered: boolean
  cancelled: boolean
  issue: string | null
}

export function orderProgress(status?: string | null): OrderProgress {
  const normalized = normalizeOrderStatus(status)
  const known = STATUS[normalized]
  const humanized = normalized ? normalized.replace(/_/g, " ").toLowerCase() : ""
  return {
    status: normalized,
    label: known?.label ?? (humanized ? humanized.charAt(0).toUpperCase() + humanized.slice(1) : "Statut inconnu"),
    tone: known?.tone ?? "wait",
    step: known?.step ?? 0,
    delivered: normalized === "LIVRE",
    cancelled: normalized === "ANNULE" || normalized === "ANNULEE",
    issue: ISSUE_MESSAGES[normalized] ?? null,
  }
}

/** Commande terminee (onglet « Passées ») : livree, annulee ou incident final. */
export function isOrderFinished(status?: string | null): boolean {
  return ["LIVRE", "ANNULE", "ANNULEE", "REFUS", "RETOUR_DEPOT", "ABSENT"].includes(normalizeOrderStatus(status))
}

const COD_MODES = ["cod", "cash", "especes", "especes_livraison", "cash_on_delivery"]

export function isCodPayment(mode?: string | null): boolean {
  return COD_MODES.includes((mode || "").toLowerCase())
}

/**
 * « Gérer » visible, comme OrderEditLink du site : commandes ouvertes, livraison a la date
 * en cours, en attente ou confirmee, paiement a la livraison non encaisse ou Wallet.
 * Le serveur redit `editable` / `cancellable` a l'ouverture.
 */
export function canManageOrder(order: OrderHistoryDTO, deliveryDate: string | null, ordersClosed: boolean): boolean {
  const mode = (order.mode_paiement || "").toLowerCase()
  const cod = isCodPayment(mode)
  if (ordersClosed || order.date_livraison !== deliveryDate) return false
  if (!["EN_ATTENTE", "CONFIRMEE"].includes(normalizeOrderStatus(order.statut))) return false
  if (!cod && mode !== "wallet") return false
  return !(cod && (order.payment_validated || order.paiement?.valide))
}

/* ---------- Reclamation ---------- */

export const CLAIM_WINDOW_HOURS = 24

/** Les 6 motifs du back-end (schemas/claim_schema.py), libelles du site. */
export const CLAIM_REASONS = [
  { id: "abime", label: "Produit abîmé" },
  { id: "poids_incorrect", label: "Poids incorrect" },
  { id: "erreur_produit", label: "Erreur de produit" },
  { id: "produit_manquant", label: "Produit manquant" },
  { id: "qualite", label: "Qualité insuffisante" },
  { id: "autre", label: "Autre problème" },
] as const

export type ClaimReason = (typeof CLAIM_REASONS)[number]["id"]

/** Fenetre de reclamation : 24 h apres la livraison, seulement pour une commande livree. */
export function claimDeadline(order: Pick<OrderHistoryDTO, "statut" | "delivered_at">): number | null {
  if (normalizeOrderStatus(order.statut) !== "LIVRE" || !order.delivered_at) return null
  const delivered = Date.parse(order.delivered_at)
  return Number.isFinite(delivered) ? delivered + CLAIM_WINDOW_HOURS * 3600 * 1000 : null
}

export function canClaimOrder(order: Pick<OrderHistoryDTO, "statut" | "delivered_at">, now = Date.now()): boolean {
  const deadline = claimDeadline(order)
  return deadline !== null && now <= deadline
}

/** Remboursement annonce d'une ligne : au prorata de la quantite (le serveur recalcule). */
export function claimRefund(line: Pick<OrderProductDTO, "quantite_kg" | "sous_total">, quantity: number): number {
  if (!line.sous_total || line.quantite_kg <= 0) return 0
  return Math.round((line.sous_total * Math.min(quantity, line.quantite_kg)) / line.quantite_kg * 100) / 100
}

/** POST /api/v1/claims */
export interface ClaimPayload {
  commande_id: number
  items: { ligne_panier_id: number; quantity_claimed: number; reason: ClaimReason }[]
}

export interface ClaimResponseDTO {
  status: string
  amount_refunded: string | number
  new_wallet_balance: string | number
}

/* ---------- Dates ---------- */

// Le Maroc reste a GMT depuis le 20/09/2026 (voir order-hours.ts) : apres cette date on lit
// l'heure en UTC, les anciennes bases ICU des telephones prevoyant encore GMT+1.
const GMT_SINCE = Date.parse("2026-09-20T01:00:00Z")

function zoneFor(time: number): string {
  return time >= GMT_SINCE ? "UTC" : "Africa/Casablanca"
}

/** "jeu. 21:14" : heure d'une etape du suivi, en heure du Maroc. */
export function formatOrderMoment(value: string | null | undefined, dateLocale: string): string | null {
  const time = value ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(time)) return null
  try {
    return new Intl.DateTimeFormat(dateLocale, { timeZone: zoneFor(time), weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time))
  } catch {
    return null
  }
}

/** "jeudi 6 novembre" (+ "à 10h04" avec `withTime`) en heure du Maroc. */
export function formatOrderDay(value: string | null | undefined, dateLocale: string, withTime = false): string | null {
  const time = value ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(time)) return null
  try {
    const zone = zoneFor(time)
    const day = new Intl.DateTimeFormat(dateLocale, { timeZone: zone, weekday: "long", day: "numeric", month: "long" }).format(new Date(time))
    if (!withTime) return day
    const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time)).replace(":", "h")
    return `${day} · ${clock}`
  } catch {
    return null
  }
}

/* ---------- Recommander (GET /api/commandes/{id}/recommander, tache B9) ---------- */

export interface ReorderLineDTO {
  product_id: number
  nom_fr: string
  nom_ar: string | null
  unite: string
  image_url: string | null
  /** Quantite de la commande d'origine. */
  quantite: number
  /** Prix du jour ; null si le produit ne peut pas etre repris. */
  prix_unitaire: number | null
  sous_total: number | null
  disponible: boolean
  raison: string | null
}

export interface ReorderResponseDTO {
  commande_id: number
  lignes: ReorderLineDTO[]
  total_dh: number
  nombre_disponibles: number
}
