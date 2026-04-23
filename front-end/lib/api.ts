const DEFAULT_API_BASE_URL = "http://localhost:8000"

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "")

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
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
  montant_total: number
  mode_paiement: string | null
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
  message?: string
}

export interface JITLogDTO {
  id?: number
  date_execution?: string
  volume_total: number
  nombre_commandes: number
  nombre_abonnements: number
  statut: string
  details_volumes?: { produits: DetailProduitJIT[] }
  message_alerte?: string
}

export interface JITDeverrouillerResponse {
  nombre_commandes?: number
  nombre_deverrouillees?: number
  statut?: string
  message?: string
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
