const DEFAULT_API_BASE_URL = "/backend"

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "")

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  headers?: Record<string, string>
  body?: unknown
  token?: string
  signal?: AbortSignal
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export interface TourneeItem {
  commande_id: number
  client_phone: string | null
  client_label: string
  street: string | null
  neighborhood: string | null
  details: string | null
  full_address: string
  colis_count: number
  creneau_livraison: string | null
  statut: string
  status_version: number
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  montant_total: number
  mode_paiement: string | null
  payment_validated?: boolean | null
  lat: number | null
  lng: number | null
  latitude?: number | null
  longitude?: number | null
}

export interface TourneeResponse {
  status: string
  date_jour: string
  available_after: string
  sort_strategy: string
  tournee_started: boolean
  items: TourneeItem[]
}

export interface DemarrerTourneeResponse {
  status: string
  updated_count: number
  previous_status: string
  new_status: string
  message: string
}

export interface DetailProduitJIT {
  product_id: number
  nom_fr: string
  nom_darija: string
  quantite_brute_kg: number
  buffer_perte_10_pct: number
  volume_total_kg: number
  prix_kg: number
  sous_total: number
  unite: string
}

export interface ResultatAgregationJIT {
  nombre_commandes: number
  nombre_abonnements: number
  volume_total_kg: number
  details_produits: DetailProduitJIT[]
  montant_total: number
  statut: string
  message?: string | null
}

export interface JITLogDTO {
  id?: number | null
  date_execution?: string | null
  volume_total: number
  nombre_commandes: number
  nombre_abonnements: number
  statut: string
  details_volumes?: Record<string, unknown> | null
  message_alerte?: string | null
}

export interface JITDeverrouillerResponse {
  nombre_commandes?: number
  nombre_deverrouillees?: number
  commandes?: JITCommandeDeverrouillee[]
  statut?: string
  message?: string
}

export interface JITCommandeDeverrouillee {
  id: number
  date_commande?: string | null
  statut_avant?: string | null
  statut_apres?: string | null
}

export interface JITLogsParPlageResponse {
  logs: JITLogDTO[]
  nombre: number
}

export interface DeliveryEventRequest {
  target_status: "EN_ROUTE" | "LIVRE" | "ABSENT"
  client_event_id: string
  device_timestamp: string
  expected_version?: number
}

export interface DeliveryEventResponse {
  status: string
  event_id: string
  client_event_id: string
  commande_id: number
  previous_status: string
  new_status: string
  status_version: number
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  device_timestamp: string
  server_timestamp: string
  idempotent: boolean
  message: string
}

export interface CodValidationResponse {
  status: string
  commande_id: number
  payment_validated: boolean
  mode_paiement?: string | null
  montant_total: number
  idempotent: boolean
  message: string
}

export interface ProduitCommandeJourDTO {
  nom_fr: string
  quantite_kg: number
}

export interface PaiementDTO {
  methode?: string | null
  montant?: number | null
  valide?: boolean | null
  frais_cmi?: number | null
  montant_net?: number | null
}

export interface SessionClientDTO {
  device_name?: string | null
  browser?: string | null
  location?: string | null
  ip?: string | null
  last_active?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

export interface NotificationPrefsDTO {
  email?: boolean | null
  push?: boolean | null
  sms?: boolean | null
  order_updates?: boolean | null
  promotions?: boolean | null
  newsletter?: boolean | null
}

export interface AbonnementClientDTO {
  poids_garanti?: number | null
  frequence?: string | null
  montant_mensuel?: number | null
  actif?: boolean | null
}

export interface CommandeVocaleClientDTO {
  id: number
  created_at?: string | null
  langue_detectee?: string | null
  transcription_brute?: string | null
}

export interface CommandeHistoriqueDTO {
  id: number
  date_commande?: string | null
  statut?: string | null
  montant_total?: number | null
  mode_paiement?: string | null
  payment_validated?: boolean | null
  montant_a_encaisser?: number | null
  creneau_livraison?: string | null
  enroute_at?: string | null
  delivered_at?: string | null
  absent_at?: string | null
  produits: ProduitCommandeJourDTO[]
  paiement?: PaiementDTO | null
}

export interface AdresseClientDTO {
  neighborhood: string | null
  street: string | null
  details: string | null
  ville: string | null
  is_default: boolean | null
}

export interface FicheClientDTO {
  id: number
  email?: string | null
  phone?: string | null
  created_at?: string | null
  last_login_at?: string | null
  is_active?: boolean | null
  is_blacklisted?: boolean | null
  auth_provider?: string | null
  is_email_verified?: boolean | null
  is_phone_verified?: boolean | null
  adresses: AdresseClientDTO[]
  commandes: CommandeHistoriqueDTO[]
  commandes_vocales: CommandeVocaleClientDTO[]
  sessions: SessionClientDTO[]
  notifications?: NotificationPrefsDTO | null
  abonnement?: AbonnementClientDTO | null
}

export type StatutConfirmationCOD = "NON_CONFIRMEE" | "CONFIRMEE_PAR_APPEL" | "ANNULEE"

export interface CommandeCODDemainDTO {
  id: number
  client_id?: number | null
  nom_client?: string | null
  telephone?: string | null
  adresse?: string | null
  montant?: number | null
  creneau_livraison?: string | null
  statut_confirmation_cod: StatutConfirmationCOD | string
}

export interface ConfirmationCODResponseDTO {
  commande_id: number
  statut_confirmation_cod: StatutConfirmationCOD | string
  commande_statut?: string | null
  logged_at?: string | null
  message: string
}

export async function apiCall<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`
  }

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    signal: options.signal,
  }

  if (options.body !== undefined) {
    fetchOptions.body = JSON.stringify(options.body)
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

export async function validateUserToken(token: string) {
  return apiCall("/auth/me", { token })
}

export async function loginUser(loginId: string, password: string, role = "CLIENT") {
  return apiCall("/auth/login", {
    method: "POST",
    body: { login_id: loginId, password, role },
  })
}

export async function getLivreurTournee(token: string, signal?: AbortSignal) {
  return apiCall<TourneeResponse>("/api/livreur/tournee", { token, signal })
}

export async function demarrerLivreurTournee(token: string) {
  return apiCall<DemarrerTourneeResponse>("/api/livreur/demarrer-tournee", {
    method: "POST",
    token,
  })
}

export async function jitAgreger(token: string) {
  return apiCall<ResultatAgregationJIT>("/api/jit/agreguer", {
    method: "POST",
    token,
  })
}

export async function envoyerEvenementLivraison(
  token: string,
  commandeId: string | number,
  body: DeliveryEventRequest
) {
  return apiCall<DeliveryEventResponse>(`/api/livreur/livraisons/${commandeId}/events`, {
    method: "POST",
    token,
    body,
  })
}

export async function validerPaiementCodLivreur(token: string, commandeId: string | number) {
  return apiCall<CodValidationResponse>(`/api/livreur/livraisons/${commandeId}/cod/validate`, {
    method: "POST",
    token,
  })
}

export async function jitExecuter(token: string) {
  return apiCall<JITLogDTO>("/api/jit/executer", {
    method: "POST",
    token,
  })
}

export async function jitDeverrouiller(token: string) {
  return apiCall<JITDeverrouillerResponse>("/api/jit/deverrouiller", {
    method: "POST",
    token,
  })
}

export async function jitDernierLog(token: string) {
  return apiCall<JITLogDTO>("/api/jit/logs/dernier", { token })
}

export async function jitLogsParPlage(token: string, dateDebut: string, dateFin: string) {
  return apiCall<JITLogsParPlageResponse>(
    `/api/jit/logs/${encodeURIComponent(dateDebut)}/${encodeURIComponent(dateFin)}`,
    { token }
  )
}

export async function getFicheClient(token: string, clientId: number) {
  return apiCall<FicheClientDTO>(`/api/commandes/clients/${clientId}`, { token })
}

export async function getCommandesCODDemain(token: string, signal?: AbortSignal) {
  return apiCall<CommandeCODDemainDTO[]>("/api/commandes/cod/demain", { token, signal })
}

export async function updateConfirmationCOD(
  token: string,
  commandeId: number,
  statut: Exclude<StatutConfirmationCOD, "NON_CONFIRMEE">
) {
  return apiCall<ConfirmationCODResponseDTO>(`/api/commandes/cod/${commandeId}/confirmation`, {
    method: "PATCH",
    token,
    body: { statut },
  })
}
