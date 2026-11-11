/**
 * Regles de commande affichees aux clients. Le back-end reste l'autorite
 * (back-end/services/checkout_service.py : PANIER_MINIMUM_DH) ; ces valeurs ne servent
 * qu'a informer avant l'envoi, jamais a calculer un montant facture.
 */

/** Montant minimum d'un panier, livraison incluse. */
export const PANIER_MINIMUM_DH = 50
export const DELIVERY_FEE_DH = 15
export const FREE_DELIVERY_THRESHOLD_DH = 300

export const MOROCCO_TIME_ZONE = "Africa/Casablanca"
/** Commandes ouvertes de 08h00 a 01h00 (heure du Maroc). */
export const ORDER_OPEN_HOUR = 8
export const ORDER_CLOSE_HOUR = 1
/** Livraison entre 8h et 15h a la date confirmee. */
export const DELIVERY_WINDOW = { from: 8, to: 15 } as const

/** Frais de livraison annonces pour un sous-total donne. */
export function deliveryFeeFor(subtotal: number): number {
  return subtotal >= FREE_DELIVERY_THRESHOLD_DH ? 0 : DELIVERY_FEE_DH
}

export interface CartTotals {
  subtotal: number
  deliveryFee: number
  total: number
  /** Le total (livraison comprise) atteint le minimum de commande. */
  meetsMinimum: boolean
  /** Produits a ajouter pour atteindre le minimum (0 si atteint). */
  missingForMinimum: number
  /** Produits a ajouter pour la livraison offerte (0 si offerte). */
  missingForFreeDelivery: number
  /** Avancement vers la livraison offerte, de 0 a 1. */
  freeDeliveryProgress: number
}

/** Totaux annonces au client avant l'envoi ; le back-end recalcule tout a la validation. */
export function cartTotals(subtotal: number): CartTotals {
  const roundedSubtotal = Math.round(subtotal * 100) / 100
  const deliveryFee = roundedSubtotal > 0 ? deliveryFeeFor(roundedSubtotal) : 0
  const total = roundedSubtotal + deliveryFee
  return {
    subtotal: roundedSubtotal,
    deliveryFee,
    total,
    meetsMinimum: roundedSubtotal > 0 && total >= PANIER_MINIMUM_DH,
    missingForMinimum: roundedSubtotal > 0 ? Math.max(0, PANIER_MINIMUM_DH - total) : PANIER_MINIMUM_DH - DELIVERY_FEE_DH,
    missingForFreeDelivery: Math.max(0, FREE_DELIVERY_THRESHOLD_DH - roundedSubtotal),
    freeDeliveryProgress: Math.min(1, roundedSubtotal / FREE_DELIVERY_THRESHOLD_DH),
  }
}
