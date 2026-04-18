"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
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
  login: (loginId: string, password: string) => Promise<void>
  logout: () => void
  validateToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Valider le token au démarrage
  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      const storedToken = localStorage.getItem("token")
      
      if (storedToken) {
        setToken(storedToken)
        const isValid = await validateTokenWithBackend(storedToken)
        
        if (isValid) {
          setIsAuthenticated(true)
        } else {
          // Token invalide, le supprimer
          localStorage.removeItem("token")
          setToken(null)
          setIsAuthenticated(false)
        }
      } else {
        setIsAuthenticated(false)
      }
      
      setIsLoading(false)
    }

    initializeAuth()

    // Ajouter un listener pour les changements de localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "token") {
        if (e.newValue) {
          setToken(e.newValue)
          setIsAuthenticated(true)
        } else {
          setToken(null)
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const validateTokenWithBackend = async (tok: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${tok}`,
          "Content-Type": "application/json"
        },
        mode: "cors",
        credentials: "omit"
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        return true
      }
      return false
    } catch (error) {
      console.error("Token validation error:", error)
      return false
    }
  }

  const validateToken = async (): Promise<boolean> => {
    if (!token) return false
    const isValid = await validateTokenWithBackend(token)
    if (isValid) {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
    return isValid
  }

  const login = async (loginId: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_id: loginId,
          password: password
        }),
        mode: "cors",
        credentials: "omit"
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Erreur de connexion")
      }

      const data = await response.json()
      const newToken = data.access_token
      
      // Sauvegarder token AVANT de valider
      localStorage.setItem("token", newToken)
      setToken(newToken)

      // Valider et charger les données utilisateur
      const isValid = await validateTokenWithBackend(newToken)
      if (isValid) {
        setIsAuthenticated(true)
      } else {
        // Si la validation échoue, nettoyer
        localStorage.removeItem("token")
        setToken(null)
        setIsAuthenticated(false)
        throw new Error("Validation du token échouée")
      }
    } catch (error) {
      console.error("Login error:", error)
      // Nettoyage en cas d'erreur
      localStorage.removeItem("token")
      setToken(null)
      setUser(null)
      setIsAuthenticated(false)
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated, login, logout, validateToken }}>
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
