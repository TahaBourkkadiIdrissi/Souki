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
  const api = useApi()
  const getNotifications = useCallback(() => api.callApi<NotificationPrefs>("/api/user/notifications"), [api])
  const updateNotifications = useCallback(
    (payload: NotificationPrefs) => api.callApi<{ success: boolean }>("/api/user/notifications", "PUT", payload),
    [api]
  )
  return { ...api, getNotifications, updateNotifications }
}
