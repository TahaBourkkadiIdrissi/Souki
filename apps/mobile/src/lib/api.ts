import type {
  BlacklistStatusDTO,
  CatalogueCategoryDTO,
  CatalogueProductDTO,
  ChatMessage,
  CheckoutPayload,
  CheckoutResponseDTO,
  ClaimPayload,
  ClaimResponseDTO,
  CurrentUserDTO,
  DishCompositionDTO,
  DishSummaryDTO,
  LoginResponseDTO,
  NotificationPreferencesDTO,
  OrderCancelResponseDTO,
  OrderEditRequest,
  OrderEditResponseDTO,
  OrderHistoryDTO,
  OrderScheduleDTO,
  OtpResponseDTO,
  ParrainageDTO,
  ProfileDTO,
  QuickAnswerDTO,
  RecurrenceDTO,
  RecurrenceFrequency,
  RecurrencePayment,
  RecurrenceUpdate,
  RegisterPayload,
  RegisterResponseDTO,
  SessionDTO,
  SettingsBootstrapDTO,
  SmartBasketRequest,
  SmartBasketResponseDTO,
  SoukiBasketDTO,
  VoiceBasketResponseDTO,
  WalletDTO,
} from "@souki/shared"

import { fetch as expoFetch } from "expo/fetch"

import { clearAccessToken, getAccessToken } from "@/lib/auth-token"
import { API_BASE_URL } from "@/lib/config"

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
  /** false pour les routes publiques : aucun jeton n'est envoye. */
  auth?: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/** Appel JSON a l'API SOUKI, jeton en `Authorization: Bearer` (pas de cookie sur mobile). */
export async function apiCall<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" }
  if (options.body !== undefined) headers["Content-Type"] = "application/json"

  const token = options.auth === false ? null : await getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
    // Jamais de cookie : l'app s'authentifie par Bearer. Sinon iOS garde le cookie de session
    // pose a la connexion et le renvoie seul ; le back-end refuse alors toute ecriture
    // « Origine non autorisee » (protection CSRF des cookies, main.py).
    credentials: "omit",
  })
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json")

  if (!response.ok) {
    // Jeton expire ou session invalidee : on l'oublie, l'ecran de connexion prendra le relais.
    if (response.status === 401 && token) await clearAccessToken()
    const error = isJson ? await response.json().catch(() => null) : null
    // 422 de Pydantic : `detail` est une liste ; on garde le premier message lisible.
    const firstIssue = Array.isArray(error?.detail) ? error.detail.find((issue: { msg?: unknown }) => typeof issue?.msg === "string") : null
    const detail =
      typeof error?.detail === "string"
        ? error.detail
        : firstIssue
          ? String(firstIssue.msg).replace(/^Value error, /, "")
          : `API error: ${response.status}`
    throw new ApiError(response.status, detail)
  }
  return (isJson ? await response.json() : null) as T
}

/** Catalogue public du jour (GET /api/catalogue). */
export function fetchCatalogue(signal?: AbortSignal) {
  return apiCall<CatalogueProductDTO[]>("/api/catalogue", { signal, auth: false })
}

/** Rayons definis dans l'admin, tries par ordre (GET /api/catalogue/categories). */
export function fetchCatalogueCategories(signal?: AbortSignal) {
  return apiCall<CatalogueCategoryDTO[]>("/api/catalogue/categories", { signal, auth: false })
}

/** Fenetre de commande calculee par le serveur (GET /api/order-schedule). */
export function fetchOrderSchedule(signal?: AbortSignal) {
  return apiCall<OrderScheduleDTO>("/api/order-schedule", { signal, auth: false })
}

/** Favoris du compte connecte (GET /api/user/favorites). */
export function fetchFavorites(signal?: AbortSignal) {
  return apiCall<CatalogueProductDTO[]>("/api/user/favorites", { signal })
}

export async function addFavorite(productId: number): Promise<void> {
  await apiCall(`/api/user/favorites/${productId}`, { method: "POST" })
}

export async function removeFavorite(productId: number): Promise<void> {
  await apiCall(`/api/user/favorites/${productId}`, { method: "DELETE" })
}

// ---------------------------------------------------------------------------
// Compte (back-end/controllers/auth_controller.py et settings_controller.py),
// memes routes et memes corps que le site (apps/client/app/login, /verify, /parametres).
// ---------------------------------------------------------------------------

/** Connexion e-mail ou telephone + mot de passe (POST /auth/login). */
export function login(loginId: string, password: string) {
  return apiCall<LoginResponseDTO>("/auth/login", { method: "POST", body: { login_id: loginId.trim(), password, role: "CLIENT" }, auth: false })
}

/** Inscription (POST /auth/register) ; un code a 6 chiffres est ensuite envoye. */
export function register(payload: RegisterPayload) {
  return apiCall<RegisterResponseDTO>("/auth/register", { method: "POST", body: payload, auth: false })
}

export function verifyOtp(userId: number, code: string, channel?: string | null) {
  return apiCall<OtpResponseDTO>("/auth/verify-otp", { method: "POST", body: { user_id: userId, code, channel: channel ?? undefined }, auth: false })
}

export function resendOtp(userId: number, channel?: string | null) {
  return apiCall<OtpResponseDTO>("/auth/resend-otp", { method: "POST", body: { user_id: userId, channel: channel ?? undefined }, auth: false })
}

/** Lien de reinitialisation par e-mail, valable 15 minutes (POST /auth/forgot-password). */
export function requestPasswordReset(email: string) {
  return apiCall<{ message?: string }>("/auth/forgot-password", { method: "POST", body: { email: email.trim() }, auth: false })
}

export function fetchMe(signal?: AbortSignal) {
  return apiCall<CurrentUserDTO>("/auth/me", { signal })
}

/** Invalide la session courante (POST /auth/logout). */
export async function logout(): Promise<void> {
  await apiCall("/auth/logout", { method: "POST" })
}

/** Profil, notifications et sessions en un appel (GET /api/user/bootstrap). */
export function fetchSettingsBootstrap(signal?: AbortSignal) {
  return apiCall<SettingsBootstrapDTO>("/api/user/bootstrap", { signal })
}

export function fetchProfile(signal?: AbortSignal) {
  return apiCall<ProfileDTO>("/api/user/profile", { signal })
}

export function updateProfile(data: { prenom: string; nom: string; email: string; telephone: string }) {
  return apiCall<unknown>("/api/user/profile", { method: "PUT", body: data })
}

export function updateAddress(data: { adresse: string; ville: string; code_postal: string }) {
  return apiCall<unknown>("/api/user/address", { method: "PUT", body: data })
}

export function changePassword(data: { current_password: string; new_password: string; confirm_password: string }) {
  return apiCall<unknown>("/api/user/security/change-password", { method: "POST", body: data })
}

export function fetchSessions(signal?: AbortSignal) {
  return apiCall<SessionDTO[]>("/api/user/sessions", { signal })
}

export async function disconnectSession(sessionId: number): Promise<void> {
  await apiCall(`/api/user/sessions/${sessionId}`, { method: "DELETE" })
}

export async function disconnectAllSessions(): Promise<void> {
  await apiCall("/api/user/sessions", { method: "DELETE" })
}

/** Suppression definitive du compte (DELETE /api/user/account, confirmation « SUPPRIMER »). */
export async function deleteAccount(): Promise<void> {
  await apiCall("/api/user/account", { method: "DELETE", body: { confirmation: "SUPPRIMER" } })
}

export function fetchNotificationPreferences(signal?: AbortSignal) {
  return apiCall<NotificationPreferencesDTO>("/api/user/notifications", { signal })
}

export function updateNotificationPreferences(data: NotificationPreferencesDTO) {
  return apiCall<unknown>("/api/user/notifications", { method: "PUT", body: data })
}

/** Validation de la commande (POST /api/checkout) ; le back-end recalcule tous les montants. */
export function submitCheckout(payload: CheckoutPayload) {
  return apiCall<CheckoutResponseDTO>("/api/checkout", { method: "POST", body: payload })
}

/** Paiement a la livraison bloque apres un refus (GET /api/client/blacklist/status). */
export function fetchBlacklistStatus(signal?: AbortSignal) {
  return apiCall<BlacklistStatusDTO>("/api/client/blacklist/status", { signal })
}

export function requestBlacklistLift(motif: string) {
  return apiCall<{ message: string }>("/api/client/blacklist/lift-request", { method: "POST", body: { motif } })
}

export async function markBlacklistLiftNotificationSeen(): Promise<void> {
  await apiCall<{ ok: boolean }>("/api/client/blacklist/lift-notification-seen", { method: "PATCH" })
}

/** Commandes du compte, la plus recente d'abord (GET /api/commandes/historique). */
export function fetchOrderHistory(signal?: AbortSignal) {
  return apiCall<OrderHistoryDTO[]>("/api/commandes/historique", { signal })
}

/** Commande modifiable : lignes, version, echeance (GET /api/commandes/{id}/modification). */
export function fetchOrderForEdit(id: number, signal?: AbortSignal) {
  return apiCall<OrderEditResponseDTO>(`/api/commandes/${id}/modification`, { signal })
}

/** Nouveau total sans rien enregistrer (POST .../modification/apercu). */
export function previewOrderEdit(id: number, body: OrderEditRequest) {
  return apiCall<OrderEditResponseDTO>(`/api/commandes/${id}/modification/apercu`, { method: "POST", body })
}

export function saveOrderEdit(id: number, body: OrderEditRequest & { expected_total: number }) {
  return apiCall<OrderEditResponseDTO>(`/api/commandes/${id}/modification`, { method: "PATCH", body })
}

export function cancelOrder(id: number, expectedVersion: number) {
  return apiCall<OrderCancelResponseDTO>(`/api/commandes/${id}/annuler`, { method: "POST", body: { expected_version: expectedVersion } })
}

/** Reclamation d'une commande livree, remboursee sur le Wallet (POST /api/v1/claims). */
export function submitClaim(payload: ClaimPayload) {
  return apiCall<ClaimResponseDTO>("/api/v1/claims", { method: "POST", body: payload })
}

/* ---------- Fidelite ---------- */

/** Wallet a deux soldes et son historique (GET /api/user/wallet). */
export function fetchWallet(signal?: AbortSignal) {
  return apiCall<WalletDTO>("/api/user/wallet", { signal })
}

/** Code, filleuls (prenom seul) et gains (GET /api/user/parrainage). */
export function fetchParrainage(signal?: AbortSignal) {
  return apiCall<ParrainageDTO>("/api/user/parrainage", { signal })
}

/** Cree le code de parrainage s'il n'existe pas encore (POST /api/user/parrainage/generate). */
export function generateParrainageCode() {
  return apiCall<{ code_parrainage: string }>("/api/user/parrainage/generate", { method: "POST" })
}

export function fetchRecurrences(signal?: AbortSignal) {
  return apiCall<RecurrenceDTO[]>("/api/commandes-recurrentes", { signal })
}

/** Paniers proposes par SOUKI, au prix du jour (GET /api/paniers-souki). */
export function fetchSoukiBaskets(signal?: AbortSignal) {
  return apiCall<SoukiBasketDTO[]>("/api/paniers-souki", { signal, auth: false })
}

export function createRecurrenceFromOrder(orderId: number, body: { frequence: RecurrenceFrequency }) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/depuis-commande/${orderId}`, { method: "POST", body })
}

export function createRecurrenceFromBasket(basketId: number, body: { frequence: RecurrenceFrequency; mode_paiement: RecurrencePayment }) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/depuis-panier/${basketId}`, { method: "POST", body })
}

export function updateRecurrenceLines(id: number, lignes: { product_id: number; quantite: number }[]) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}/lignes`, { method: "PUT", body: { lignes } })
}

export function updateRecurrence(id: number, body: RecurrenceUpdate) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}`, { method: "PATCH", body })
}

export function skipRecurrence(id: number) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}/sauter`, { method: "POST" })
}

export function pauseRecurrence(id: number, until: string) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}/pause`, { method: "POST", body: { jusqu_au: until } })
}

export function resumeRecurrence(id: number) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}/reprendre`, { method: "POST" })
}

export function stopRecurrence(id: number) {
  return apiCall<RecurrenceDTO>(`/api/commandes-recurrentes/${id}/arreter`, { method: "POST" })
}

/* ---------- IA-SOUKI ---------- */

/** Panier intelligent compose par l'IA (POST /api/paniers/generer). */
export function generateSmartBasket(body: SmartBasketRequest) {
  return apiCall<SmartBasketResponseDTO>("/api/paniers/generer", { method: "POST", body })
}

/** Plats marocains proposes (GET /api/paniers/plats). */
export function fetchDishes(signal?: AbortSignal) {
  return apiCall<DishSummaryDTO[]>("/api/paniers/plats", { signal })
}

/** Composition d'un plat, dont les ingredients que SOUKI ne vend pas. */
export function fetchDishComposition(dishId: string, people: number) {
  return apiCall<DishCompositionDTO>(`/api/paniers/plats/${encodeURIComponent(dishId)}?personnes=${people}`)
}

/** Liste tapee ou dictee (POST /api/text-basket). */
export function sendTextBasket(texte: string) {
  return apiCall<VoiceBasketResponseDTO>("/api/text-basket", { method: "POST", body: { texte } })
}

/**
 * Liste dite a voix haute (POST /api/voice-basket) : fichier WAV enregistre sur l'iPhone,
 * envoye en multipart (le serveur accepte WAV, MP3 et WebM, 60 s au plus).
 */
export async function sendVoiceBasket(fileUri: string): Promise<VoiceBasketResponseDTO> {
  const token = await getAccessToken()
  const form = new FormData()
  // React Native envoie le fichier a partir de son chemin local.
  form.append("audio", { uri: fileUri, name: "enregistrement.wav", type: "audio/wav" } as unknown as Blob)
  const response = await fetch(`${API_BASE_URL}/api/voice-basket`, {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
    credentials: "omit",
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) await clearAccessToken()
    throw new ApiError(response.status, typeof data?.detail === "string" ? data.detail : "Erreur lors du traitement vocal.")
  }
  return data as VoiceBasketResponseDTO
}

/** Questions rapides de Souki et leurs reponses (GET /api/assistant/suggestions). */
export function fetchQuickAnswers(signal?: AbortSignal) {
  return apiCall<QuickAnswerDTO[]>("/api/assistant/suggestions", { signal })
}

/**
 * Reponse de Souki en continu (POST /api/assistant/chat, flux `text/event-stream`) :
 * `onDelta` recoit chaque morceau. `expo/fetch` lit le flux, ce que le fetch de React Native
 * ne sait pas faire.
 */
export async function streamChat(message: string, history: ChatMessage[], onDelta: (delta: string) => void, signal: AbortSignal): Promise<void> {
  const token = await getAccessToken()
  const response = await expoFetch(`${API_BASE_URL}/api/assistant/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message, history }),
    signal,
    credentials: "omit",
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, typeof data?.detail === "string" ? data.detail : "Souki est momentanément indisponible.")
  }
  if (!response.body) throw new ApiError(500, "Réponse indisponible.")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let done = false
  try {
    while (!done) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      const frames = buffer.split("\n\n")
      buffer = frames.pop() ?? ""
      for (const frame of frames) {
        if (!frame.startsWith("data: ")) continue
        const event = JSON.parse(frame.slice(6)) as { delta?: string; done?: boolean; error?: string }
        if (event.error) throw new ApiError(503, event.error)
        if (event.delta) onDelta(event.delta)
        if (event.done) done = true
      }
      if (chunk.done && !done) throw new ApiError(500, "La réponse a été interrompue. Réessayez.")
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

/**
 * Photo de profil (POST /api/user/profile/photo, champ `file`) : JPG, PNG ou WEBP, 2 Mo au
 * plus ; le serveur reencode l'image et renvoie une URL signee.
 */
export async function uploadProfilePhoto(fileUri: string, mimeType: string): Promise<{ photo_url: string }> {
  const token = await getAccessToken()
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"
  const form = new FormData()
  form.append("file", { uri: fileUri, name: `photo.${extension}`, type: mimeType } as unknown as Blob)
  const response = await fetch(`${API_BASE_URL}/api/user/profile/photo`, {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
    credentials: "omit",
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && token) await clearAccessToken()
    throw new ApiError(response.status, typeof data?.detail === "string" ? data.detail : "Envoi de la photo impossible.")
  }
  return data as { photo_url: string }
}
