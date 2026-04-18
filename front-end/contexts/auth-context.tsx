"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { API_BASE_URL } from "@/lib/api"

export interface User {
  id: number
  email?: string
  phone?: string
  role: string
  is_verified: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (loginId: string, password: string, role?: string) => Promise<void>
  logout: () => void
  validateToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const validateTokenWithBackend = async (tok: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/json",
        },
        mode: "cors",
        credentials: "omit",
      })

      if (!response.ok) {
        return false
      }

      const userData = await response.json()
      setUser(userData)
      return true
    } catch (error) {
      console.error("Token validation error:", error)
      return false
    }
  }

  const syncAuthState = async (nextToken: string | null): Promise<boolean> => {
    if (!nextToken) {
      localStorage.removeItem("token")
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
      return false
    }

    localStorage.setItem("token", nextToken)
    setToken(nextToken)

    const isValid = await validateTokenWithBackend(nextToken)
    if (isValid) {
      setIsAuthenticated(true)
      return true
    }

    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
    return false
  }

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      const storedToken = localStorage.getItem("token")

      if (storedToken) {
        await syncAuthState(storedToken)
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
    return syncAuthState(token)
  }

  const login = async (loginId: string, password: string, role = "CLIENT") => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: loginId,
          password,
          role,
        }),
        mode: "cors",
        credentials: "omit",
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Erreur de connexion")
      }

      const data = await response.json()
      const newToken = data.access_token

      const isValid = await syncAuthState(newToken)
      if (!isValid) {
        throw new Error("Validation du token echouee")
      }
    } catch (error) {
      console.error("Login error:", error)
      await syncAuthState(null)
      throw error
    }
  }

  const logout = () => {
    void syncAuthState(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, isAuthenticated, login, logout, validateToken }}
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
