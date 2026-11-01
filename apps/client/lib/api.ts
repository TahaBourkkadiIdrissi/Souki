

export const API_BASE_URL = "/backend"

/** Server-side transport for the public short link; never cached or prefetched. */
export async function resolveCampaignLink(slug: string, request: Request): Promise<Response> {
  slug = slug.toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(slug)) return new Response("Lien introuvable", { status: 404, headers: { "Cache-Control": "no-store" } })
  const headers = new Headers()
  // Preserve an absent agent rather than letting the server fetch invent one.
  headers.set("user-agent", request.headers.get("user-agent") || "")
  for (const key of ["cookie", "user-agent", "purpose", "sec-purpose", "x-purpose", "x-moz"]) {
    const value = request.headers.get(key)
    if (value) headers.set(key, value)
  }
  try {
    const base = process.env.BACKEND_INTERNAL_URL || (process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://127.0.0.1:8000")
    const response = await fetch(`${base}/api/campaigns/r/${encodeURIComponent(slug)}`, {
      method: request.method === "HEAD" ? "HEAD" : "GET", headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
    })
    const outgoing = new Headers({ "Cache-Control": "private, no-store, max-age=0", "X-Robots-Tag": "noindex" })
    const location = response.headers.get("location")
    if (response.status === 302 && location) {
      outgoing.set("Location", location)
      for (const cookie of response.headers.getSetCookie()) outgoing.append("Set-Cookie", cookie)
      return new Response(null, { status: 302, headers: outgoing })
    }
    return new Response(response.status === 404 ? "Ce lien de campagne est indisponible." : "Lien temporairement indisponible. Réessayez dans un instant.", { status: response.status === 404 ? 404 : 503, headers: outgoing })
  } catch {
    return new Response("Lien temporairement indisponible. Réessayez dans un instant.", { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}

export interface OrderEditLine {
  product_id: number
  name: string
  unit: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderEditResponse {
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
  items: OrderEditLine[]
  subtotal: number
  delivery_fee: number
  total: number
  previous_total: number
  difference: number
}

export interface OrderEditRequest {
  items: { product_id: number; quantity: number }[]
  expected_version: number
}

export function getOrderForEdit(id: number, signal?: AbortSignal) {
  return apiCall<OrderEditResponse>(`/api/commandes/${id}/modification`, { cache: "no-store", signal })
}

export function previewOrderEdit(id: number, body: OrderEditRequest) {
  return apiCall<OrderEditResponse>(`/api/commandes/${id}/modification/apercu`, { method: "POST", body })
}

export function saveOrderEdit(id: number, body: OrderEditRequest & { expected_total: number }) {
  return apiCall<OrderEditResponse>(`/api/commandes/${id}/modification`, { method: "PATCH", body })
}

export interface OrderCancelResponse {
  commande_id: number
  statut: string
  refunded_amount: number
}

export function cancelOrder(id: number, expectedVersion: number) {
  return apiCall<OrderCancelResponse>(`/api/commandes/${id}/annuler`, {
    method: "POST", body: { expected_version: expectedVersion },
  })
}

export interface OrderScheduleDTO {
  closed: boolean
  server_time: string
  next_transition: string
  delivery_date: string | null
}

export function getOrderSchedule() {
  return apiCall<OrderScheduleDTO>("/api/order-schedule", { cache: "no-store", signal: AbortSignal.timeout(5000) })
}

export type FrequenceRecurrente = "QUOTIDIENNE" | "TOUS_LES_3_JOURS" | "HEBDOMADAIRE" | "TOUTES_LES_2_SEMAINES"
export type StatutRecurrence = "ACTIVE" | "EN_PAUSE" | "SUSPENDUE" | "ARRETEE"

export interface CommandeRecurrenteLigneDTO {
  product_id: number
  nom_produit: string
  unite: string
  image_url: string | null
  quantite: number
  prix_unitaire: number
  prix_reference: number | null
  sous_total: number
  variation: number
  disponible: boolean
}

export interface CommandeRecurrenteLivraisonDTO {
  date_livraison: string
  statut: "CREEE" | "SAUTEE" | "ECHEC"
  commande_id: number | null
  montant: number | null
  motif: string | null
}

export interface CommandeRecurrenteDTO {
  id: number
  type: "COMMANDE" | "PANIER"
  panier_souki_id: number | null
  commande_origine_id: number | null
  frequence: FrequenceRecurrente
  prochaine_livraison: string
  statut: StatutRecurrence
  pause_jusqu_au: string | null
  mode_paiement: string
  creneau_livraison: string
  contact_phone: string
  delivery_address: string
  delivery_city: string
  delivery_instructions: string | null
  lignes: CommandeRecurrenteLigneDTO[]
  sous_total_estime: number
  frais_livraison_estimes: number
  total_estime: number
  variation_prix: number
  modifiable: boolean
  message: string | null
  dernieres_livraisons: CommandeRecurrenteLivraisonDTO[]
  created_at: string | null
}

export interface CommandeRecurrenteUpdateDTO {
  frequence?: FrequenceRecurrente
  prochaine_livraison?: string
  mode_paiement?: "cod" | "wallet"
  contact_phone?: string
  delivery_address?: string
  delivery_city?: string
  delivery_instructions?: string
}

export function getCommandesRecurrentes(signal?: AbortSignal) {
  return apiCall<CommandeRecurrenteDTO[]>("/api/commandes-recurrentes", { cache: "no-store", signal })
}

export function creerCommandeRecurrente(commandeId: number, body: { frequence: FrequenceRecurrente; premiere_livraison?: string }) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/depuis-commande/${commandeId}`, { method: "POST", body })
}

export function modifierLignesCommandeRecurrente(id: number, lignes: { product_id: number; quantite: number }[]) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}/lignes`, { method: "PUT", body: { lignes } })
}

export function modifierCommandeRecurrente(id: number, body: CommandeRecurrenteUpdateDTO) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}`, { method: "PATCH", body })
}

export function sauterCommandeRecurrente(id: number) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}/sauter`, { method: "POST" })
}

export function pauseCommandeRecurrente(id: number, jusquAu: string) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}/pause`, { method: "POST", body: { jusqu_au: jusquAu } })
}

export function reprendreCommandeRecurrente(id: number) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}/reprendre`, { method: "POST" })
}

export function arreterCommandeRecurrente(id: number) {
  return apiCall<CommandeRecurrenteDTO>(`/api/commandes-recurrentes/${id}/arreter`, { method: "POST" })
}


interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: unknown
  token?: string
  signal?: AbortSignal
  cache?: RequestCache
}


export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}


export interface ProduitCommandeJourDTO {
  ligne_panier_id?: number | null
  product_id?: number | null
  nom_fr: string
  quantite_kg: number
  sous_total?: number | null
  image?: string | null
}


export interface PaiementDTO {
  methode?: string | null
  montant?: number | null
  valide?: boolean | null
  frais_cmi?: number | null
  montant_net?: number | null
}


export interface CommandeHistoriqueDTO {
  id: number
  date_commande?: string | null
  statut?: string | null
  montant_total?: number | null
  mode_paiement?: string | null
  payment_validated?: boolean | null
  montant_a_encaisser?: number | null
  date_livraison?: string | null
  creneau_livraison?: string | null
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  produits: ProduitCommandeJourDTO[]
  paiement?: PaiementDTO | null
}


export type ProduitNiveau = 1 | 2 | 3


/** Rayon défini dans l'admin (GET /api/catalogue/categories), trié par ordre. */
export interface CatalogueCategoryDTO {
  id: number
  slug: string
  nom: string
  icone: string | null
  /** Produit actif dont la photo sert de tuile ; null sinon. */
  produit_vedette_id: number | null
  ordre: number
  product_ids: number[]
}

export function fetchCatalogueCategories(signal?: AbortSignal) {
  return apiCall<CatalogueCategoryDTO[]>("/api/catalogue/categories", { signal })
}

export interface CatalogueProductDTO {
  description?: string | null
  id: number
  nom_fr: string
  nom_darija: string
  prix_kg: number
  prix_affiche: number | null
  prix_khddar_estime: number | null
  is_active: boolean
  image_url: string | null
  niveau: ProduitNiveau
  unite: string
  stock: number
  updated_at?: string | null
  availability?: "in_stock" | "preorder" | "out_of_stock"
}


export type ProduitSuggestionDTO = CatalogueProductDTO


export interface SuggestionsRequestDTO {
  exclude_ids: number[]
  panier_total: number
}


export interface BlacklistStatusDTO {
  is_blacklisted: boolean
  last_action: string | null
  last_reason: string | null
  last_date: string | null
  lift_notification_seen: boolean
}


export interface LiftRequestDTO {
  motif: string
}


export async function apiCall<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    signal: options.signal,
    cache: options.cache,
    // Envoie le cookie httpOnly d'authentification.
    credentials: "include",
  }

  if (options.body !== undefined) {
    fetchOptions.body = isFormData ? options.body as BodyInit : JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)
  const contentType = response.headers.get("content-type") || ""
  const isJsonResponse = contentType.includes("application/json")

  if (!response.ok) {
    const error = isJsonResponse ? await response.json().catch(() => null) : null
    throw new ApiError(response.status, error?.detail || `API error: ${response.status}`)
  }

  if (!isJsonResponse) {
    return null as T
  }

  return response.json() as Promise<T>
}


export async function getBlacklistStatus(token: string) {
  return apiCall<BlacklistStatusDTO>("/api/client/blacklist/status", { token })
}


export async function requestBlacklistLift(token: string, motif: string) {
  return apiCall<{ message: string }>("/api/client/blacklist/lift-request", {
    method: "POST",
    token,
    body: { motif } satisfies LiftRequestDTO,
  })
}


export async function markBlacklistLiftNotificationSeen(token: string): Promise<void> {
  await apiCall<{ ok: boolean }>("/api/client/blacklist/lift-notification-seen", {
    method: "PATCH",
    token,
  })
}


export async function getCatalogueSuggestions(
  excludeIds: number[],
  panierTotal: number,
  signal?: AbortSignal
): Promise<ProduitSuggestionDTO[]> {
  return apiCall<ProduitSuggestionDTO[]>("/api/catalogue/suggestions", {
    method: "POST",
    body: {
      exclude_ids: excludeIds.slice(0, 20),
      panier_total: panierTotal,
    } satisfies SuggestionsRequestDTO,
    signal,
  })
}


export async function addFavorite(productId: number, token: string): Promise<void> {
  await apiCall(`/api/user/favorites/${productId}`, { method: "POST", token })
}


export async function removeFavorite(productId: number, token: string): Promise<void> {
  await apiCall(`/api/user/favorites/${productId}`, { method: "DELETE", token })
}


/**
 * Suggestions personnalisees : produits favoris + deja commandes mis en avant,
 * completes par la reco generique (marge/seuil/decouverte). Cote serveur.
 */
export async function fetchPersonalizedSuggestions(token: string): Promise<CatalogueProductDTO[]> {
  try {
    return await apiCall<CatalogueProductDTO[]>("/api/user/suggestions", { token })
  } catch {
    return []
  }
}


export interface ParrainageFilleulDTO {
  prenom: string
  statut: "EN_ATTENTE" | "CONVERTI" | "REJETE" | string
  created_at: string | null
  converted_at: string | null
}

export interface MonParrainageDTO {
  code: string | null
  credit_par_filleul: number
  plafond_filleuls: number
  en_attente: number
  convertis: number
  gains_total: number
  filleuls: ParrainageFilleulDTO[]
}

export async function getMonParrainage(token: string, signal?: AbortSignal): Promise<MonParrainageDTO> {
  return apiCall<MonParrainageDTO>("/api/user/parrainage", { token, signal })
}

export async function generateParrainageCode(token: string): Promise<{ code_parrainage: string }> {
  return apiCall<{ code_parrainage: string }>("/api/user/parrainage/generate", {
    method: "POST",
    token,
  })
}
