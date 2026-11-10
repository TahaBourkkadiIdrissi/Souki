/**
 * Compte client : formes des reponses de l'API (back-end/dto/user_dto.py, settings_dto.py,
 * services/settings_service.py) et regles du formulaire, comme apps/client/app/login.
 */

/** POST /auth/login et POST /auth/google */
export interface LoginResponseDTO {
  access_token: string
  token_type: string
  role?: string | null
  roles: string[]
  default_dashboard: string
  user?: Record<string, unknown> | null
}

/** POST /auth/register (RegisterResponse) */
export interface RegisterResponseDTO {
  id: number
  email: string | null
  phone: string | null
  role: string
  is_verified: boolean
  verification_required: boolean
  verification_channel: string | null
  verification_target: string | null
  expires_in_seconds: number | null
  resend_available_in_seconds: number | null
  message: string
}

/** POST /auth/verify-otp et /auth/resend-otp (OTPVerificationResponse) */
export interface OtpResponseDTO {
  message: string
  access_token?: string | null
  is_verified: boolean
  onboarding_completed?: boolean
  verification_channel?: string | null
  verification_target?: string | null
  expires_in_seconds?: number | null
  resend_available_in_seconds?: number | null
}

/** GET /auth/me (CurrentUserResponse) */
export interface CurrentUserDTO {
  id: number
  email: string | null
  phone: string | null
  role: string
  roles: string[]
  is_verified: boolean
  is_active: boolean
  onboarding_completed: boolean
  user?: Record<string, unknown> | null
}

/** GET /api/user/profile */
export interface ProfileDTO {
  prenom: string
  nom: string
  email: string
  telephone: string
  photo_url: string | null
  email_verified: boolean
  address: { adresse: string; ville: string; code_postal: string }
}

/** Element de GET /api/user/sessions */
export interface SessionDTO {
  id: number
  device_name: string | null
  browser: string | null
  location: string | null
  ip: string | null
  last_active: string | null
  is_current: boolean
}

/** GET/PUT /api/user/notifications (NotificationPreferencesDTO) */
export interface NotificationPreferencesDTO {
  email: boolean
  push: boolean
  sms: boolean
  promotions: boolean
  orderUpdates: boolean
  newsletter: boolean
  livraison: boolean
}

/** GET /api/user/bootstrap */
export interface SettingsBootstrapDTO {
  profile: ProfileDTO
  notifications: NotificationPreferencesDTO
  sessions: SessionDTO[]
  /** Solde du Wallet (lu par le checkout). */
  wallet?: import("./checkout").WalletSummaryDTO
}

/** Corps de POST /auth/register (UserRegister). */
export interface RegisterPayload {
  prenom?: string
  nom?: string
  email?: string
  phone?: string
  password: string
  role: "CLIENT"
  code_parrainage?: string
  /** Absents pour l'entree de l'app (e-mail + mot de passe) : l'adresse vient de l'onboarding. */
  latitude?: number
  longitude?: number
  adresse?: string
  ville?: string
}

/**
 * Regles du mot de passe, identiques au site et au back-end (UserRegister.validate_password) :
 * 8 caracteres, une majuscule, un chiffre.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "8 caractères minimum", test: (value: string) => value.length >= 8 },
  { id: "upper", label: "Une lettre majuscule", test: (value: string) => /[A-Z]/.test(value) },
  { id: "digit", label: "Un chiffre", test: (value: string) => /[0-9]/.test(value) },
] as const

export function passwordIsValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value))
}

/** Format d'e-mail du formulaire de connexion du site. */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim())
}

/** Telephone marocain, comme back-end/dto/phone_validator.py : 06/07, +212 ou 00212. */
export function normalizeMoroccanPhone(raw: string): string {
  const value = raw.trim().replace(/[\s-]/g, "")
  if (value.startsWith("+212")) return value
  if (value.startsWith("00212")) return `+${value.slice(2)}`
  if (value.startsWith("0")) return `+212${value.slice(1)}`
  return `+212${value}`
}

export function isValidMoroccanPhone(raw: string): boolean {
  return /^\+212[67]\d{8}$/.test(normalizeMoroccanPhone(raw))
}

// ---------------------------------------------------------------------------
// Zone de service : miroir de apps/client/lib/service-area.ts et
// back-end/services/service_area.py (garder les trois alignes).
// ---------------------------------------------------------------------------

export type Coordinates = { latitude: number; longitude: number }

export const SERVICE_CENTER: Coordinates = { latitude: 34.0331, longitude: -5.0003 }
export const SERVICE_RADIUS_KM = 15

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Distance a vol d'oiseau (haversine), comme services/zone_resolver.py. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function isInServiceArea(point: Coordinates): boolean {
  return distanceKm(point, SERVICE_CENTER) <= SERVICE_RADIUS_KM
}

/** POST /auth/check-email (B12) : l'ecran « Votre e-mail » de l'entree. */
export interface CheckEmailDTO {
  exists: boolean
  /** false : compte cree avec Google, sans mot de passe. */
  has_password: boolean
  providers: string[]
}
