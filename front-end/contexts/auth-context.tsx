"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { toast } from "sonner"
import { API_BASE_URL } from "@/lib/api"

export interface User {
  id: number
  email?: string
  phone?: string
  role: string
  legacy_role?: string | null
  roles: string[]
  permissions: string[]
  is_verified: boolean
  is_active: boolean
  default_dashboard: string
  profiles?: {
    client?: { code_parrainage?: string | null; is_blacklisted?: boolean }
    [key: string]: any
  }
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (loginId: string, password: string, role?: string) => Promise<User>
  adminLogin: (loginId: string, password: string) => Promise<User>
  googleLogin: (googleToken: string, role?: string) => Promise<User>
  logout: () => Promise<void>
  validateToken: () => Promise<boolean>
  hasRole: (role: string) => boolean
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_REQUEST_TIMEOUT_MS = 10000
// Cle de synchronisation inter-onglets (valeur = horodatage, jamais le token).
const AUTH_SYNC_STORAGE_KEY = "souki-auth-sync"
// Marqueur de session non secret expose via useAuth().token quand l'utilisateur est
// connecte. Le vrai JWT vit exclusivement dans le cookie httpOnly.
const COOKIE_SESSION_SENTINEL = "cookie-session"
const NETWORK_RETRY_ATTEMPTS = 3
const NETWORK_RETRY_DELAY_MS = 1200
const NETWORK_TIMEOUT_MS = 5000

const isNetworkFetchError = (error: unknown) =>
  error instanceof TypeError && error.message.toLowerCase().includes("fetch")

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })

const isRequestTimeoutError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError"

function buildApiUnavailableMessage() {
  return `Impossible de joindre l'API (${API_BASE_URL}). Verifiez que le back-end est demarre et accessible depuis le front.`
}

function buildRequestTimeoutMessage() {
  return `L'API met trop de temps a repondre (${API_BASE_URL}). Verifiez que le back-end et la base de donnees sont bien disponibles.`
}

async function readErrorDetail(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    // Reponse non-JSON (page d'erreur HTML d'un proxy/CDN, 5xx, tunnel KO...) :
    // ne JAMAIS exposer ce contenu brut a l'utilisateur. On renvoie null pour que
    // l'appelant affiche un message generique propre.
    return null
  }

  try {
    const payload = await response.json()
    return payload?.detail ? String(payload.detail) : null
  } catch {
    return null
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS
) {
  const controller = new AbortController()
  const timeoutHandle = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timeoutHandle)
  }
}

function normalizeUser(payload: any): User {
  const roles = Array.isArray(payload?.roles) ? payload.roles.map((value: string) => String(value).toUpperCase()) : []
  const permissions = Array.isArray(payload?.permissions)
    ? payload.permissions.map((value: string) => String(value))
    : []

  return {
    id: Number(payload?.id ?? 0),
    email: payload?.email ?? undefined,
    phone: payload?.phone ?? undefined,
    role: String(payload?.role || payload?.legacy_role || roles[0] || "CLIENT").toUpperCase(),
    legacy_role: payload?.legacy_role ? String(payload.legacy_role).toUpperCase() : null,
    roles,
    permissions,
    is_verified: Boolean(payload?.is_verified),
    is_active: payload?.is_active !== false,
    default_dashboard: String(payload?.default_dashboard || "/"),
    profiles: payload?.profiles && typeof payload.profiles === "object" ? payload.profiles : undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Source de verite = cookie httpOnly. On interroge /auth/me avec credentials:"include"
  // (le navigateur joint le cookie automatiquement) ; aucun token n'est requis cote JS.
  const fetchCurrentUser = async (): Promise<{ user: User | null; networkError: boolean }> => {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }, NETWORK_TIMEOUT_MS)

      if (!response.ok) {
        return { user: null, networkError: false }
      }

      const userData = normalizeUser(await response.json())
      setUser(userData)
      return { user: userData, networkError: false }
    } catch (error) {
      if (isRequestTimeoutError(error)) {
        // Feedback UX propre (et non plus un simple message console), dedoublonne par id.
        toast.error("Le serveur met trop de temps à répondre. Réessayez dans un instant.", {
          id: "auth-network",
        })
        return { user: null, networkError: true }
      }
      if (isNetworkFetchError(error)) {
        toast.error("Service momentanément indisponible. Vérifiez votre connexion.", {
          id: "auth-network",
        })
        return { user: null, networkError: true }
      }
      console.warn(
        "Session refresh error:",
        error instanceof Error ? error.message : String(error)
      )
      return { user: null, networkError: false }
    }
  }

  const clearLocalSession = () => {
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  // Declenche un evenement "storage" dans les autres onglets pour resynchroniser la session.
  const notifyAuthSync = () => {
    try {
      localStorage.setItem(AUTH_SYNC_STORAGE_KEY, String(Date.now()))
    } catch {
      // localStorage indisponible (mode prive) : la synchro inter-onglets est juste ignoree.
    }
  }

  // Recharge l'utilisateur courant depuis le cookie httpOnly (seule source de verite).
  // nextToken sert uniquement de signal "connexion" (non-null) vs "deconnexion" (null) ;
  // sa valeur reelle est ignoree : le vrai JWT n'est JAMAIS conserve cote JS (anti-XSS).
  const syncAuthState = async (nextToken: string | null): Promise<User | null> => {
    if (nextToken === null) {
      clearLocalSession()
      return null
    }

    const { user: nextUser, networkError } = await fetchCurrentUser()
    if (nextUser) {
      // Marqueur de session NON secret. Les pages qui conditionnent leurs appels sur
      // `token` (ex: supplier, livreur) continuent de fonctionner, et l'en-tete
      // "Authorization: Bearer cookie-session" eventuellement envoye est ignore par le
      // backend (il privilegie le cookie). Le JWT reel reste dans le cookie httpOnly.
      setToken(COOKIE_SESSION_SENTINEL)
      setIsAuthenticated(true)
      return nextUser
    }

    // Ne pas effacer la session si le backend est simplement indisponible temporairement.
    if (networkError) {
      setIsAuthenticated(false)
      return null
    }

    clearLocalSession()
    return null
  }

  // Verifie la session via le cookie, sans token en memoire (init, autres onglets).
  const refreshSession = (): Promise<User | null> => syncAuthState("")

  useEffect(() => {
    const retrySessionRefresh = async () => {
      for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
        const nextUser = await refreshSession()
        if (nextUser) {
          return
        }
        if (attempt < NETWORK_RETRY_ATTEMPTS) {
          await wait(NETWORK_RETRY_DELAY_MS)
        }
      }
    }

    const initializeAuth = async () => {
      setIsLoading(true)
      // On tente toujours une reprise de session via le cookie httpOnly.
      await retrySessionRefresh()
      setIsLoading(false)
    }

    // Synchronisation inter-onglets : on relaie un signal non sensible (jamais le token).
    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === AUTH_SYNC_STORAGE_KEY) {
        await refreshSession()
      }
    }

    const handleAuthTokenChanged = async (event: Event) => {
      const customEvent = event as CustomEvent<{ token: string | null }>
      await syncAuthState(customEvent.detail?.token ?? "")
    }

    void initializeAuth()
    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("auth-token-changed", handleAuthTokenChanged as EventListener)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("auth-token-changed", handleAuthTokenChanged as EventListener)
    }
  }, [])

  const validateToken = async (): Promise<boolean> => {
    return Boolean(await refreshSession())
  }

  const authenticate = async (endpoint: string, payload: Record<string, unknown>) => {
    try {
      let response: Response | null = null

      for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
        try {
          response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            // credentials:"include" pour que le navigateur stocke le cookie httpOnly renvoye.
            credentials: "include",
          }, NETWORK_TIMEOUT_MS)
          break
        } catch (error) {
          const isTimeout = isRequestTimeoutError(error)
          if ((isTimeout || isNetworkFetchError(error)) && attempt < NETWORK_RETRY_ATTEMPTS) {
            await wait(NETWORK_RETRY_DELAY_MS)
            continue
          }

          if (isTimeout || isNetworkFetchError(error)) {
            throw new Error("Le serveur backend ne répond pas encore. Attendez 2 à 3 secondes puis réessayez.")
          }

          throw error
        }
      }

      if (!response) {
        throw new Error("Le serveur backend est indisponible.")
      }

      if (!response.ok) {
        const errorDetail = await readErrorDetail(response)
        const fallback =
          response.status >= 500
            ? "Le service est momentanément indisponible. Réessayez dans quelques instants."
            : "Identifiants incorrects ou requête invalide. Vérifiez vos informations."
        throw new Error(errorDetail || fallback)
      }

      const data = await response.json()

      // Chemin rapide : le backend renvoie desormais l'utilisateur complet dans la
      // reponse de login. On evite ainsi un second aller-retour /auth/me (cause du
      // "gel" ressenti pendant plusieurs secondes a la connexion).
      if (data?.user) {
        const nextUser = normalizeUser(data.user)
        setUser(nextUser)
        setToken(COOKIE_SESSION_SENTINEL)
        setIsAuthenticated(true)
        notifyAuthSync()
        return nextUser
      }

      // Repli compatibilite (ancienne API sans champ "user") : on valide via /auth/me.
      const nextUser = await syncAuthState(data.access_token)
      if (!nextUser) {
        throw new Error("Validation du token echouee")
      }
      notifyAuthSync()
      return nextUser
    } catch (error) {
      console.warn(
        "Authentication error:",
        error instanceof Error ? error.message : String(error)
      )
      await syncAuthState(null)
      if (isRequestTimeoutError(error)) {
        throw new Error(buildRequestTimeoutMessage())
      }
      if (isNetworkFetchError(error) || error instanceof TypeError) {
        throw new Error(buildApiUnavailableMessage())
      }
      throw error
    }
  }

  const login = async (loginId: string, password: string, role = "CLIENT") => {
    return authenticate("/auth/login", {
      login_id: loginId,
      password,
      role,
    })
  }

  const adminLogin = async (loginId: string, password: string) => {
    return authenticate("/auth/admin/login", {
      login_id: loginId,
      password,
    })
  }

  const googleLogin = async (googleToken: string, role = "CLIENT") => {
    return authenticate("/auth/google", {
      token: googleToken,
      role,
    })
  }

  const logout = async () => {
    // Invalide la session serveur et supprime le cookie httpOnly.
    try {
      await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      }, NETWORK_TIMEOUT_MS)
    } catch {
      // On nettoie l'etat local meme si l'appel reseau echoue.
    }
    await syncAuthState(null)
    notifyAuthSync()
  }

  const hasRole = (role: string) => Boolean(user?.roles.includes(role.toUpperCase()))
  const can = (permission: string) => Boolean(user?.permissions.includes(permission))

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        adminLogin,
        googleLogin,
        logout,
        validateToken,
        hasRole,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuthContext must be used within AuthProvider")
  }
  return context
}
