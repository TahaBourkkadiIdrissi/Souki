"use client"

import { useCallback } from "react"
import { useApi } from "@/hooks/useApi"

export interface ActiveSession {
  id: number
  device_name: string | null
  browser: string | null
  location: string | null
  ip: string | null
  last_active: string | null
  is_current: boolean
}

export function useSecurity() {
  const { callApi, loading, error, setError } = useApi()
  const changePassword = useCallback(
    (payload: { current_password: string; new_password: string; confirm_password: string }) =>
      callApi<{ success: boolean }>("/api/user/security/change-password", "POST", payload),
    [callApi]
  )
  const getSessions = useCallback(() => callApi<ActiveSession[]>("/api/user/sessions"), [callApi])
  const disconnectSession = useCallback(
    (sessionId: number) => callApi<{ success: boolean }>(`/api/user/sessions/${sessionId}`, "DELETE"),
    [callApi]
  )
  const disconnectAll = useCallback(() => callApi<{ success: boolean }>("/api/user/sessions", "DELETE"), [callApi])
  const deleteAccount = useCallback(
    (confirmation: string) => callApi<{ success: boolean }>("/api/user/account", "DELETE", { confirmation }),
    [callApi]
  )
  return { callApi, loading, error, setError, changePassword, getSessions, disconnectSession, disconnectAll, deleteAccount }
}
