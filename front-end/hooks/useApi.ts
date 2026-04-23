"use client"

import { useCallback, useState } from "react"
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

  return { callApi, loading, error, setError }
}
