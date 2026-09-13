export const ORDER_PROGRESS_STEPS = [
  { key: "confirmed", title: "Commande confirmée", description: "Votre commande est bien enregistrée chez Souki." },
  { key: "preparing", title: "Préparation", description: "Nos équipes préparent vos produits frais." },
  { key: "delivery", title: "En livraison", description: "Votre commande est confiée au livreur." },
  { key: "delivered", title: "Livrée", description: "Vos produits frais sont arrivés." },
] as const

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  VERROUILLEE: "En préparation",
  EN_ATTENTE_LIVREUR: "En attente livreur",
  REFUS_LIVREUR: "Réassignation en cours",
  A_LIVRER: "Prête à livrer",
  PLANIFIEE: "Planifiée",
  EN_ROUTE: "En route",
  RETOUR_DEPOT: "Retour au dépôt",
  LIVRE: "Livrée",
  ABSENT: "Destinataire absent",
  REFUS: "Livraison refusée",
  ANNULE: "Annulée",
  ANNULEE: "Annulée",
}

const STATUS_STEP_INDEX: Record<string, number> = {
  BROUILLON: 0,
  EN_ATTENTE: 0,
  CONFIRMEE: 0,
  VERROUILLEE: 1,
  EN_ATTENTE_LIVREUR: 1,
  REFUS_LIVREUR: 1,
  A_LIVRER: 2,
  PLANIFIEE: 2,
  EN_ROUTE: 2,
  RETOUR_DEPOT: 2,
  ABSENT: 2,
  REFUS: 2,
  LIVRE: 3,
  ANNULE: 0,
  ANNULEE: 0,
}

const TERMINAL_ISSUE_MESSAGES: Record<string, string> = {
  ABSENT: "Le livreur n'a pas pu vous remettre la commande. Notre équipe peut vous aider à la reprogrammer.",
  REFUS: "La livraison a été refusée. Contactez-nous si cette information ne correspond pas à votre situation.",
  RETOUR_DEPOT: "La commande est retournée au dépôt. Notre équipe vous contactera pour la suite.",
  ANNULE: "Cette commande a été annulée.",
  ANNULEE: "Cette commande a été annulée.",
}

export type OrderStepState = "complete" | "current" | "upcoming"

export function normalizeOrderStatus(status?: string | null) {
  return (status || "").trim().toUpperCase().replace(/\s+/g, "_")
}

export function getOrderStatusLabel(status?: string | null) {
  const normalized = normalizeOrderStatus(status)
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized]
  if (!normalized) return "Statut inconnu"
  const humanized = normalized.replace(/_/g, " ").toLowerCase()
  return humanized.charAt(0).toUpperCase() + humanized.slice(1)
}

export function getOrderStatusClassName(status?: string | null) {
  const normalized = normalizeOrderStatus(status)
  if (normalized === "LIVRE") return "border-[#BFE6C4] bg-[#EAF8EC] text-[#176B2E]"
  if (["EN_ROUTE", "A_LIVRER", "PLANIFIEE"].includes(normalized)) {
    return "border-[#B9D7F2] bg-[#EEF7FF] text-[#1A5F96]"
  }
  if (TERMINAL_ISSUE_MESSAGES[normalized]) return "border-[#F1C6C6] bg-[#FFF1F1] text-[#B42318]"
  return "border-[#F5D7B8] bg-[#FFF7EE] text-[#8A4E0A]"
}

export function getOrderProgress(status?: string | null) {
  const normalized = normalizeOrderStatus(status)
  const currentIndex = STATUS_STEP_INDEX[normalized] ?? 0
  const isDelivered = normalized === "LIVRE"
  const issueMessage = TERMINAL_ISSUE_MESSAGES[normalized] || null
  const stepStates: OrderStepState[] = ORDER_PROGRESS_STEPS.map((_, index) => {
    if (isDelivered || index < currentIndex) return "complete"
    return index === currentIndex ? "current" : "upcoming"
  })
  return { normalized, currentIndex, isDelivered, issueMessage, stepStates }
}
