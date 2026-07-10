"use client"

import { useCallback, useMemo, useState } from "react"
import { API_BASE_URL } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"

export function useApi() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callApi = useCallback(
    async <T,>(path: string, method: HttpMethod = "GET", body?: unknown, isFormData = false): Promise<T> => {
      setLoading(true)
      setError(null)
      try {
        // VULN-010 : l'authentification passe par le cookie httpOnly
        // (credentials: "include" ci-dessous). Plus aucun JWT dans le localStorage.
        const headers: Record<string, string> = {}
        if (!isFormData) {
          headers["Content-Type"] = "application/json"
        }
        if (token) {
          headers.Authorization = `Bearer ${token}`
        }
        const res = await fetch(`${API_BASE_URL}${path}`, {
          method,
          headers,
          // Envoie le cookie httpOnly d'authentification (proxy same-origin /backend).
          credentials: "include",
          body: body ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const detail = data?.detail || "Erreur API"
          throw new Error(detail)
        }
        return data as T
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue"
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  return useMemo(
    () => ({ callApi, loading, error, setError }),
    [callApi, loading, error]
  )
}
