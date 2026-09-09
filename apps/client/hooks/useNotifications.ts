"use client"

import { useCallback } from "react"
import { useApi } from "@/hooks/useApi"

export interface NotificationPrefs {
  email: boolean
  push: boolean
  sms: boolean
  promotions: boolean
  orderUpdates: boolean
  newsletter: boolean
  livraison: boolean
}

export function useNotifications() {
  const { callApi, loading, error, setError } = useApi()
  const getNotifications = useCallback(() => callApi<NotificationPrefs>("/api/user/notifications"), [callApi])
  const updateNotifications = useCallback(
    (payload: NotificationPrefs) => callApi<{ success: boolean }>("/api/user/notifications", "PUT", payload),
    [callApi]
  )
  return { callApi, loading, error, setError, getNotifications, updateNotifications }
}
