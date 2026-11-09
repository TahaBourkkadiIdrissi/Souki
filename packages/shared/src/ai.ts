/**
 * IA-SOUKI : panier intelligent, commande vocale, discussion avec Souki. Types de l'API et
 * regles du site (apps/client/components/souki/ai-modals.tsx, pwa/mascot-chat-sheet.tsx).
 */

/* ---------- Panier intelligent (POST /api/paniers/generer) ---------- */

/** Panier equilibre (tous fruits et legumes) ; sinon l'identifiant d'un plat marocain. */
export const BALANCED_BASKET = "equilibre"
export const SMART_PEOPLE = [1, 2, 3, 4, 5, 6, 7, 8] as const
export const SMART_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const
export const SMART_DEFAULTS = { budget: 150, people: 3, duration: 7 } as const
/** Pour un plat, le budget ne s'applique pas : le site envoie une valeur neutre haute. */
export const DISH_NEUTRAL_BUDGET = 5000

export interface SmartBasketRequest {
  budget: number
  personnes: number
  duree: number
  plat: string
}

export interface SmartBasketLineDTO {
  product_id: number
  nom_produit: string
  nom_ar: string | null
  quantite_kg: number
  prix_unitaire: number
  sous_total: number
  unite: string
  image: string
}

export interface SmartBasketResponseDTO {
  status: string
  source: string
  panier_id: number | null
  criteres: Record<string, unknown>
  lignes_panier: SmartBasketLineDTO[]
  total_dh: number
  nombre_articles: number
  model_warning: string | null
}

/** GET /api/paniers/plats : plats ayant au moins un ingredient au catalogue. */
export interface DishSummaryDTO {
  dish_id: string
  name_fr: string
  name_darija: string
  category: string
}

/** GET /api/paniers/plats/{id}?personnes= : composition et ingredients non vendus. */
export interface DishCompositionDTO {
  status: string
  dish_id: string
  name_fr: string
  name_darija: string
  category: string
  personnes: number
  default_servings: number
  lignes_panier: SmartBasketLineDTO[]
  ingredients_manquants: string[]
  total_dh: number
  nombre_articles: number
}

/** Categories du site, dans son ordre. */
export const DISH_CATEGORIES: { id: string; label: string }[] = [
  { id: "tajine", label: "Tajines" },
  { id: "couscous", label: "Couscous" },
  { id: "soupe", label: "Soupes" },
  { id: "salade", label: "Salades" },
  { id: "jus", label: "Jus & boissons" },
  { id: "plat_mijote", label: "Plats mijotés" },
  { id: "grillade", label: "Grillades" },
  { id: "poisson", label: "Poissons" },
  { id: "pain_patisserie", label: "Pains & pâtisseries" },
  { id: "autre", label: "Autres" },
]

/** Recherche d'un plat en francais ou en darija (sans accents ni casse). */
export function dishMatches(dish: Pick<DishSummaryDTO, "name_fr" | "name_darija">, query: string): boolean {
  const clean = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
  const needle = clean(query)
  return !needle || clean(dish.name_fr).includes(needle) || clean(dish.name_darija).includes(needle)
}

/* ---------- Commande vocale (POST /api/voice-basket, /api/text-basket) ---------- */

/** Enregistrement coupe a 15 s, comme le site ; le serveur refuse au-dela de 60 s. */
export const VOICE_MAX_MS = 15000
/** En dessous, aucune voix n'a ete captee (le site refuse sous 5 Ko). */
export const VOICE_MIN_BYTES = 5000

export interface VoiceBasketLineDTO {
  product_id: number
  nom_produit: string
  quantite_demandee: number
  quantite_effective: number
  prix_unitaire: number
  sous_total: number
  message_ajustement: string | null
}

export interface VoiceBasketResponseDTO {
  status: string
  transcription: string | null
  langue_detectee: string | null
  produits_non_disponibles: string[]
  lignes_panier: VoiceBasketLineDTO[]
  total_dh: number
  nombre_articles: number
  commande_id: number | null
}

/* ---------- Discussion avec Souki (/api/assistant) ---------- */

export type ChatRole = "user" | "assistant"
export interface ChatMessage {
  role: ChatRole
  content: string
}

/** Question rapide avec sa reponse toute prete (GET /api/assistant/suggestions). */
export interface QuickAnswerDTO {
  question: string
  answer: string
}

/** 500 caracteres par message, 20 messages d'historique (ChatRequest du back-end). */
export const CHAT_MAX_LENGTH = 500
export const CHAT_HISTORY = 20

/**
 * Historique accepte par le serveur : echanges complets (user, assistant, user…), 20 au plus.
 */
export function chatHistory(messages: ChatMessage[]): ChatMessage[] {
  const complete = messages.filter((message) => message.content.trim().length > 0)
  let start = Math.max(0, complete.length - CHAT_HISTORY)
  if (complete[start]?.role === "assistant") start += 1
  const slice = complete.slice(start)
  return slice.length % 2 ? slice.slice(0, -1) : slice
}
