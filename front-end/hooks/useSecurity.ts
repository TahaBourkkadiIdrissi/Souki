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
  const api = useApi()
  const changePassword = useCallback(
    (payload: { current_password: string; new_password: string; confirm_password: string }) =>
      api.callApi<{ success: boolean }>("/api/user/security/change-password", "POST", payload),
    [api]
  )
  const getSessions = useCallback(() => api.callApi<ActiveSession[]>("/api/user/sessions"), [api])
  const disconnectSession = useCallback(
    (sessionId: number) => api.callApi<{ success: boolean }>(`/api/user/sessions/${sessionId}`, "DELETE"),
    [api]
  )
  const disconnectAll = useCallback(() => api.callApi<{ success: boolean }>("/api/user/sessions", "DELETE"), [api])
  const deleteAccount = useCallback(
    (confirmation: string) => api.callApi<{ success: boolean }>("/api/user/account", "DELETE", { confirmation }),
    [api]
  )
  return { ...api, changePassword, getSessions, disconnectSession, disconnectAll, deleteAccount }
}
