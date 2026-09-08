

export const API_BASE_URL = "/backend"


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


export interface TourneeItem {
  commande_id: number
  ordre_passage?: number | null
  fournisseur_id?: number | null
  fournisseur_nom?: string | null
  fournisseur_shop_name?: string | null
  fournisseur_address?: string | null
  fournisseur_ville?: string | null
  fournisseur_phone?: string | null
  fournisseur_latitude?: number | null
  fournisseur_longitude?: number | null
  pickup_lat?: number | null
  pickup_lng?: number | null
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
  tournee_id: number | null
  pickup: {
    fournisseur_id: number | null
    shop_name: string | null
    address: string | null
    ville: string | null
    phone: string | null
    latitude: number | null
    longitude: number | null
  } | null
  ramassee: boolean
  ramasse_at: string | null
  items: TourneeItem[]
}


export interface RamassageResponse {
  status: string
  tournee_id: number
  ramasse_at: string
  commandes_ramassees: number
  idempotent: boolean
}


export interface DeliveryEventRequest {
  target_status: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS"
  client_event_id: string
  device_timestamp: string
  expected_version?: number
}


export interface LivraisonDecisionRequest {
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


export interface TourneeRefusResponse {
  status: string
  client_event_id: string
  commandes_refusees: number
  commande_ids: number[]
  dispatch_reassign_triggered: boolean
  dispatch_status?: string | null
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


export async function getLivreurTournee(token: string, signal?: AbortSignal) {
  return apiCall<TourneeResponse>("/api/livreur/tournee", { token, signal })
}


export async function confirmerRamassageLivreur(token: string, tourneeId: number) {
  return apiCall<RamassageResponse>(`/api/livreur/tournees/${tourneeId}/ramassage`, {
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


export async function refuserTourneeLivreur(token: string, body: LivraisonDecisionRequest) {
  return apiCall<TourneeRefusResponse>("/api/livreur/tournee/refuser", {
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
