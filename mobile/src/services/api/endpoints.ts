import { apiCall } from "@/services/api/client"
import type {
  AuthResponse,
  CatalogueProductDTO,
  CommandeCheckoutResponse,
  DashboardDTO,
  ManualBasketResponse,
  PanierDetailsResponse,
  ProfileData,
  TourneeResponse,
  User
} from "@/types/api"

export function validateUserToken(token: string) {
  return apiCall<User>("/auth/me", { token })
}

export function loginUser(loginId: string, password: string, role = "CLIENT") {
  return apiCall<AuthResponse>("/auth/login", {
    method: "POST",
    token: null,
    body: { login_id: loginId, password, role }
  })
}

export function adminLoginUser(loginId: string, password: string) {
  return apiCall<AuthResponse>("/auth/admin/login", {
    method: "POST",
    token: null,
    body: { login_id: loginId, password }
  })
}

export function registerUser(payload: {
  email?: string
  phone?: string
  password: string
  role: string
  nom?: string
  prenom?: string
}) {
  return apiCall<{ message?: string; user_id?: number }>("/auth/register", {
    method: "POST",
    token: null,
    body: payload
  })
}

export function verifyOtp(payload: { login_id: string; otp_code: string }) {
  return apiCall<AuthResponse & { default_dashboard?: string }>("/auth/verify-otp", {
    method: "POST",
    token: null,
    body: payload
  })
}

export function resendOtp(payload: { login_id: string }) {
  return apiCall<{ message?: string }>("/auth/resend-otp", {
    method: "POST",
    token: null,
    body: payload
  })
}

export function fetchCatalogueProductsDto() {
  return apiCall<CatalogueProductDTO[]>("/api/catalogue", { token: null })
}

export function submitManualBasket(items: Array<{ product_id: number; quantity: number; prix_unitaire: number }>) {
  return apiCall<ManualBasketResponse>("/api/manual-basket", {
    method: "POST",
    body: { items }
  })
}

export function fetchPanierDetails(panierId: number) {
  return apiCall<PanierDetailsResponse>(`/api/paniers/${panierId}`)
}

export function submitCheckout(payload: Record<string, unknown>) {
  return apiCall<CommandeCheckoutResponse>("/api/checkout", {
    method: "POST",
    body: payload
  })
}

export function getLivreurTournee(signal?: AbortSignal) {
  return apiCall<TourneeResponse>("/api/livreur/tournee", { signal })
}

export function demarrerLivreurTournee() {
  return apiCall<{ status: string; message: string; updated_count: number }>(
    "/api/livreur/demarrer-tournee",
    { method: "POST" }
  )
}

export function envoyerEvenementLivraison(
  commandeId: number,
  targetStatus: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS",
  expectedVersion?: number
) {
  return apiCall<{ message: string; new_status: string }>(`/api/livreur/livraisons/${commandeId}/events`, {
    method: "POST",
    body: {
      target_status: targetStatus,
      client_event_id: `${commandeId}-${targetStatus}-${Date.now()}`,
      device_timestamp: new Date().toISOString(),
      expected_version: expectedVersion
    }
  })
}

export function getProfile() {
  return apiCall<ProfileData>("/api/user/profile")
}

export function updateProfile(payload: Pick<ProfileData, "prenom" | "nom" | "email" | "telephone">) {
  return apiCall<{ success: boolean; email_changed: boolean }>("/api/user/profile", {
    method: "PUT",
    body: payload
  })
}

export function getAdminDashboard() {
  return apiCall<DashboardDTO>("/admin/dashboard?periode=today")
}
