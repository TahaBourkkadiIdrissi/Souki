import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react"

import { adminLoginUser, loginUser, validateUserToken } from "@/services/api/endpoints"
import { deleteSecureItem, getSecureItem, setSecureItem, TOKEN_KEY } from "@/services/secureStorage"
import type { User } from "@/types/api"

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (loginId: string, password: string, role?: string) => Promise<User>
  adminLogin: (loginId: string, password: string) => Promise<User>
  logout: () => Promise<void>
  validateToken: () => Promise<boolean>
  hasRole: (role: string) => boolean
  can: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeUser(payload: User): User {
  const roles = Array.isArray(payload.roles) ? payload.roles.map((value) => value.toUpperCase()) : []
  const permissions = Array.isArray(payload.permissions) ? payload.permissions.map(String) : []
  return {
    id: Number(payload.id ?? 0),
    email: payload.email ?? undefined,
    phone: payload.phone ?? undefined,
    role: String(payload.role || payload.legacy_role || roles[0] || "CLIENT").toUpperCase(),
    legacy_role: payload.legacy_role ? String(payload.legacy_role).toUpperCase() : null,
    roles,
    permissions,
    is_verified: Boolean(payload.is_verified),
    is_active: payload.is_active !== false,
    default_dashboard: String(payload.default_dashboard || "/")
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const syncAuthState = async (nextToken: string | null) => {
    if (!nextToken) {
      await deleteSecureItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      return null
    }

    await setSecureItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    const nextUser = normalizeUser(await validateUserToken(nextToken))
    setUser(nextUser)
    return nextUser
  }

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      try {
        const storedToken = await getSecureItem(TOKEN_KEY)
        if (storedToken) {
          await syncAuthState(storedToken)
        }
      } catch {
        await syncAuthState(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initializeAuth()
  }, [])

  const login = async (loginId: string, password: string, role = "CLIENT") => {
    const response = await loginUser(loginId, password, role)
    const nextUser = await syncAuthState(response.access_token)
    if (!nextUser) throw new Error("Validation du token echouee")
    return nextUser
  }

  const adminLogin = async (loginId: string, password: string) => {
    const response = await adminLoginUser(loginId, password)
    const nextUser = await syncAuthState(response.access_token)
    if (!nextUser) throw new Error("Validation du token echouee")
    return nextUser
  }

  const logout = async () => {
    await syncAuthState(null)
  }

  const validateToken = async () => {
    if (!token) return false
    try {
      await syncAuthState(token)
      return true
    } catch {
      await syncAuthState(null)
      return false
    }
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: Boolean(user && token),
      login,
      adminLogin,
      logout,
      validateToken,
      hasRole: (role: string) => Boolean(user?.roles.includes(role.toUpperCase())),
      can: (permission: string) => Boolean(user?.permissions.includes(permission))
    }),
    [isLoading, token, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
