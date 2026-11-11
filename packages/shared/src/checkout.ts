/**
 * Checkout : types de l'API et calculs annonces au client, repris de
 * apps/client/app/checkout/page.tsx. Le back-end (services/checkout_service.py) recalcule
 * tout a la validation ; ces valeurs ne servent qu'a informer avant l'envoi.
 */

/** Livraison a l'heure exacte entre 08h00 et 15h00 (CheckoutRequestDTO). */
export const DELIVERY_TIME_MIN = 8 * 60
export const DELIVERY_TIME_MAX = 15 * 60
/** Pas du curseur d'heure (design system : 30 min). */
export const DELIVERY_TIME_STEP = 30
/** Raccourcis du site : 8h, 10h, 12h, 14h. */
export const DELIVERY_TIME_PRESETS = [8 * 60, 10 * 60, 12 * 60, 14 * 60] as const
/** Le site ouvre le choix sur 08:00. */
export const DEFAULT_DELIVERY_TIME = DELIVERY_TIME_MIN

/** Ville unique de livraison. */
export const DELIVERY_CITY = "Fès"

/** 600 -> "10:00" (format attendu par `creneau_livraison`). */
export function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** 600 -> "10h00" (affichage, comme `formatDeliveryTime` du site). */
export function minutesToLabel(minutes: number): string {
  return minutesToHHMM(minutes).replace(":", "h")
}

export type PaymentMode = "cod" | "wallet"

export interface CheckoutAmounts {
  /** Produits + livraison. */
  orderTotal: number
  /** Credit Wallet deduit du paiement a la livraison (0 si non utilise). */
  walletDiscount: number
  /** Reste a regler a la porte, ou total paye par le Wallet. */
  due: number
  /** Le Wallet seul ne couvre pas la commande. */
  walletInsufficient: boolean
}

/** Montants du checkout, exactement comme le site (walletDiscount, total, isWalletInsufficient). */
export function checkoutAmounts(orderTotal: number, walletBalance: number, payment: PaymentMode, useWalletCredit: boolean): CheckoutAmounts {
  const walletDiscount = payment === "cod" && useWalletCredit ? Math.round(Math.min(walletBalance, orderTotal) * 100) / 100 : 0
  return {
    orderTotal,
    walletDiscount,
    due: Math.round((orderTotal - walletDiscount) * 100) / 100,
    walletInsufficient: walletBalance < orderTotal,
  }
}

/** Corps de POST /api/checkout (CheckoutRequestDTO). */
export interface CheckoutPayload {
  items: { product_id: number; quantity: number }[]
  creneau_livraison: string
  mode_paiement: PaymentMode
  utiliser_wallet: boolean
  contact_phone: string | null
  delivery_address: string
  delivery_city: string
  delivery_instructions: string | null
  brouillon_vocal_id: number | null
  panier_id: number | null
}

/** Reponse de POST /api/checkout (CheckoutResponseDTO). */
export interface CheckoutResponseDTO {
  date_livraison: string | null
  status: string
  commande_id: number
  panier_id: number
  total_articles: number
  sous_total: number
  frais_livraison: number
  montant_total: number
  montant_wallet: number
  reste_a_payer: number
  mode_paiement: string | null
  lignes: { product_id: number; nom_produit: string; prix_unitaire: number; quantite: number }[]
  message: string
}

/** GET /api/client/blacklist/status : paiement a la livraison bloque apres un refus. */
export interface BlacklistStatusDTO {
  is_blacklisted: boolean
  last_action: string | null
  last_reason: string | null
  last_date: string | null
  lift_notification_seen: boolean
}

/** Partie `wallet` de GET /api/user/bootstrap (SettingsService.get_wallet). */
export interface WalletSummaryDTO {
  has_wallet: boolean
  is_activated: boolean
  balance_centimes: number
  solde_centimes?: number
  solde_offert_centimes?: number
  solde_rembourse_centimes?: number
}
