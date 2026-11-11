/**
 * Fidelite : Wallet a deux soldes, parrainage, abonnements. Types de l'API et libelles du
 * site (apps/client/app/wallet, app/parrainage, lib/commandes-recurrentes.ts). Abonnements
 * sans gain ni perte : prix du site au moment ou la commande est creee (01h00).
 */

/* ---------- Wallet (GET /api/user/wallet) ---------- */

export interface WalletTransactionDTO {
  id: number
  type: string
  montant_centimes: number
  date: string | null
}

export interface WalletDTO {
  has_wallet: boolean
  is_activated: boolean
  balance_centimes: number
  solde_offert_centimes?: number
  solde_rembourse_centimes?: number
  transactions: WalletTransactionDTO[]
  created_at?: string | null
}

/** Libelles du site (app/wallet/page.tsx). */
export const WALLET_TRANSACTION_LABELS: Record<string, string> = {
  DEBIT_COMMANDE: "Paiement de commande",
  DEBIT_MODIFICATION: "Modification de commande",
  CREDIT_MODIFICATION: "Modification de commande",
  CREDIT_ANNULATION: "Remboursement d'annulation",
  CREDIT_SAV: "Remboursement de réclamation",
  CREDIT_REFUS: "Retour après refus de commande",
  PARRAINAGE_PARRAIN: "Parrainage (crédit offert)",
  PARRAINAGE_FILLEUL: "Bienvenue parrainage (crédit offert)",
}

export function walletTransactionLabel(type: string): string {
  return WALLET_TRANSACTION_LABELS[type] ?? "Mouvement du Wallet"
}

/** Credit offert (parrainage), affiche sur l'icone jaune. */
export function isGiftTransaction(type: string): boolean {
  return type.startsWith("PARRAINAGE_")
}

/* ---------- Parrainage (GET /api/user/parrainage) ---------- */

export interface ParrainageFilleulDTO {
  prenom: string
  statut: string
  created_at: string | null
  converted_at: string | null
}

export interface ParrainageDTO {
  code: string | null
  credit_par_filleul: number
  plafond_filleuls: number
  en_attente: number
  convertis: number
  gains_total: number
  filleuls: ParrainageFilleulDTO[]
}

/** Message de partage du site (app/parrainage/page.tsx). */
export const REFERRAL_MESSAGE =
  "Je fais mes courses sur SOUKI : les légumes du marché de gros de Fès, livrés à la maison. Inscris-toi avec mon code {code} : on reçoit chacun {credit} DH dès ta première commande livrée."

/** Lien d'inscription avec le code, comme le site : /login/client?ref=CODE */
export function referralLink(siteUrl: string, code: string): string {
  return `${siteUrl}/login/client?ref=${encodeURIComponent(code)}`
}

/* ---------- Abonnements (commandes recurrentes) ---------- */

export type RecurrenceFrequency = "QUOTIDIENNE" | "TOUS_LES_3_JOURS" | "HEBDOMADAIRE" | "TOUTES_LES_2_SEMAINES"
export type RecurrenceStatus = "ACTIVE" | "EN_PAUSE" | "SUSPENDUE" | "ARRETEE"
export type RecurrencePayment = "cod" | "wallet"

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFrequency; label: string; detail: string }[] = [
  { value: "QUOTIDIENNE", label: "Chaque jour", detail: "Livrée tous les jours" },
  { value: "TOUS_LES_3_JOURS", label: "Tous les 3 jours", detail: "Idéal pour les produits frais" },
  { value: "HEBDOMADAIRE", label: "Chaque semaine", detail: "Le même jour chaque semaine" },
  { value: "TOUTES_LES_2_SEMAINES", label: "Toutes les 2 semaines", detail: "Un jour sur deux semaines" },
]

export function frequencyLabel(value: string): string {
  return RECURRENCE_FREQUENCIES.find((item) => item.value === value)?.label ?? value
}

export const RECURRENCE_STATUS_LABELS: Record<RecurrenceStatus, string> = {
  ACTIVE: "Active",
  EN_PAUSE: "En pause",
  SUSPENDUE: "Suspendue",
  ARRETEE: "Arrêtée",
}

export interface RecurrenceLineDTO {
  product_id: number
  nom_produit: string
  nom_ar: string | null
  unite: string
  image_url: string | null
  quantite: number
  prix_unitaire: number
  prix_reference: number | null
  sous_total: number
  variation: number
  disponible: boolean
}

export interface RecurrenceDeliveryDTO {
  date_livraison: string
  statut: string
  commande_id: number | null
  montant: number | null
  motif: string | null
}

export interface RecurrenceDTO {
  id: number
  type: "COMMANDE" | "PANIER"
  panier_souki_id: number | null
  commande_origine_id: number | null
  frequence: RecurrenceFrequency
  prochaine_livraison: string
  statut: RecurrenceStatus
  pause_jusqu_au: string | null
  mode_paiement: string
  creneau_livraison: string
  contact_phone: string
  delivery_address: string
  delivery_city: string
  delivery_instructions: string | null
  lignes: RecurrenceLineDTO[]
  sous_total_estime: number
  frais_livraison_estimes: number
  total_estime: number
  variation_prix: number
  modifiable: boolean
  message: string | null
  dernieres_livraisons: RecurrenceDeliveryDTO[]
  created_at: string | null
}

export interface RecurrenceUpdate {
  frequence?: RecurrenceFrequency
  mode_paiement?: RecurrencePayment
}

/** Panier propose par SOUKI (GET /api/paniers-souki), estime au prix du jour. */
export interface SoukiBasketDTO {
  id: number
  nom: string
  nom_ar: string | null
  description: string | null
  description_ar: string | null
  image_url: string | null
  lignes: {
    product_id: number
    nom_produit: string
    nom_ar: string | null
    unite: string
    image_url: string | null
    quantite: number
    prix_unitaire: number
    sous_total: number
    disponible: boolean
  }[]
  sous_total_estime: number
  frais_livraison_estimes: number
  total_estime: number
}

/** "+1,50 DH" / "−2 DH" (ecart de prix depuis la derniere livraison). */
export function formatVariation(value: number): string {
  const rounded = Math.round(Math.abs(value) * 100) / 100
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(".", ",")
  return `${value > 0 ? "+ " : value < 0 ? "− " : ""}${text} DH`
}

/** AAAA-MM-JJ, `days` jours apres aujourd'hui (date du telephone). */
export function isoDatePlusDays(days: number, from = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
