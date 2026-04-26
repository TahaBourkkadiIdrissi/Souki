"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
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
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (loginId: string, password: string, role?: string) => Promise<User>
  adminLogin: (loginId: string, password: string) => Promise<User>
  googleLogin: (googleToken: string, role?: string) => Promise<User>
  logout: () => void
  validateToken: () => Promise<boolean>
  hasRole: (role: string) => boolean
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_REQUEST_TIMEOUT_MS = 10000
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
    try {
      const rawText = await response.text()
      const compactText = rawText.replace(/\s+/g, " ").trim()
      return compactText ? compactText.slice(0, 180) : null
    } catch {
      return null
    }
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
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const validateTokenWithBackend = async (
    tok: string
  ): Promise<{ user: User | null; networkError: boolean }> => {
    try {
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS)
      const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
        },
        mode: "cors",
        credentials: "omit",
      }, NETWORK_TIMEOUT_MS)

      if (!response.ok) {
        return { user: null, networkError: false }
      }

      const userData = normalizeUser(await response.json())
      setUser(userData)
      return { user: userData, networkError: false }
    } catch (error) {
      if (isRequestTimeoutError(error)) {
        console.warn(buildRequestTimeoutMessage())
        return { user: null, networkError: true }
      }
      if (isNetworkFetchError(error)) {
        console.warn(buildApiUnavailableMessage())
        return { user: null, networkError: true }
      }
      console.warn(
        "Token validation error:",
        error instanceof Error ? error.message : String(error)
      )
      return { user: null, networkError: false }
    }
  }

  const syncAuthState = async (nextToken: string | null): Promise<User | null> => {
    if (!nextToken) {
      localStorage.removeItem("token")
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
      return null
    }

    localStorage.setItem("token", nextToken)
    setToken(nextToken)

    const { user: nextUser, networkError } = await validateTokenWithBackend(nextToken)
    if (nextUser) {
      setIsAuthenticated(true)
      return nextUser
    }

    // Ne pas supprimer la session si le backend est simplement indisponible temporairement.
    if (networkError) {
      setIsAuthenticated(false)
      return null
    }

    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    return null
  }

  useEffect(() => {
    const retryTokenSync = async (storedToken: string) => {
      for (let attempt = 1; attempt <= NETWORK_RETRY_ATTEMPTS; attempt += 1) {
        const nextUser = await syncAuthState(storedToken)
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
      const storedToken = localStorage.getItem("token")

      if (storedToken) {
        await retryTokenSync(storedToken)
      } else {
        setIsAuthenticated(false)
      }

      setIsLoading(false)
    }

    const handleStorageChange = async (e: StorageEvent) => {
      if (e.key === "token") {
        await syncAuthState(e.newValue)
      }
    }

    const handleAuthTokenChanged = async (event: Event) => {
      const customEvent = event as CustomEvent<{ token: string | null }>
      await syncAuthState(customEvent.detail?.token ?? null)
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
    if (!token) return false
    return Boolean(await syncAuthState(token))
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
            mode: "cors",
            credentials: "omit",
          }, NETWORK_TIMEOUT_MS)
          break
        } catch (error) {
          const isTimeout = isRequestTimeoutError(error)
          if ((isTimeout || isNetworkFetchError(error)) && attempt < NETWORK_RETRY_ATTEMPTS) {
            await wait(NETWORK_RETRY_DELAY_MS)
            continue
          }

          if (isTimeout || isNetworkFetchError(error)) {
            throw new Error("Le serveur backend ne repond pas encore. Attends 2 a 3 secondes puis reessaie.")
          }

          throw error
        }
      }

      if (!response) {
        throw new Error("Le serveur backend est indisponible.")
      }

      if (!response.ok) {
        const errorDetail = await readErrorDetail(response)
        throw new Error(
          errorDetail || `Erreur de connexion (${response.status} ${response.statusText || "HTTP"})`
        )
      }

      const data = await response.json()
      const newToken = data.access_token

      const nextUser = await syncAuthState(newToken)
      if (!nextUser) {
        throw new Error("Validation du token echouee")
      }
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

  const logout = () => {
    void syncAuthState(null)
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
