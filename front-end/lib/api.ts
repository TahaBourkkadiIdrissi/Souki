export const API_BASE_URL = "http://localhost:8000"

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
  latitude: number | null
  longitude: number | null
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
