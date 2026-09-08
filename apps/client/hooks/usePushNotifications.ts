"use client"

import { useCallback, useEffect, useState } from "react"
import { useApi } from "@/hooks/useApi"
import {
  getExistingSubscription,
  getPushPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermission,
} from "@/lib/push"

interface PushPublicKeyResponse {
  publicKey: string
  configured: boolean
}

export interface PushNotificationsState {
  /** Le navigateur expose l'API Push (faux sur iOS hors PWA installee). */
  supported: boolean
  /** Le serveur a des cles VAPID : sans elles, le canal push est indisponible. */
  configured: boolean
  permission: PushPermission
  subscribed: boolean
  busy: boolean
  error: string | null
}

export function usePushNotifications() {
  const { callApi } = useApi()
  const [state, setState] = useState<PushNotificationsState>({
    supported: false,
    configured: false,
    permission: "unsupported",
    subscribed: false,
    busy: false,
    error: null,
  })

  const refresh = useCallback(async () => {
    const supported = isPushSupported()
    if (!supported) {
      setState((current) => ({ ...current, supported: false, permission: "unsupported" }))
      return
    }

    const subscription = await getExistingSubscription()
    let configured = false
    try {
      configured = (await callApi<PushPublicKeyResponse>("/api/user/push/public-key")).configured
    } catch {
      configured = false
    }

    setState((current) => ({
      ...current,
      supported: true,
      configured,
      permission: getPushPermission(),
      subscribed: Boolean(subscription),
    }))

    // Cicatrisation : si l'appareil est abonne cote navigateur, on re-declare
    // l'abonnement au serveur. Cela rattrape un `pushsubscriptionchange` perdu
    // ou une revocation serveur apres expiration, sans action de l'utilisateur.
    if (subscription) {
      try {
        await callApi("/api/user/push/subscriptions", "POST", subscription.toJSON())
      } catch {
        // Sans session valide, la resynchronisation se refera au prochain montage.
      }
    }
  }, [callApi])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const enable = useCallback(async (): Promise<boolean> => {
    setState((current) => ({ ...current, busy: true, error: null }))
    try {
      const { publicKey, configured } = await callApi<PushPublicKeyResponse>(
        "/api/user/push/public-key",
      )
      if (!configured || !publicKey) {
        throw new Error("Les notifications push ne sont pas encore activees sur SOUKI.")
      }

      const subscription = await subscribeToPush(publicKey)
      await callApi("/api/user/push/subscriptions", "POST", subscription)

      setState((current) => ({
        ...current,
        busy: false,
        configured: true,
        permission: getPushPermission(),
        subscribed: true,
      }))
      return true
    } catch (err) {
      setState((current) => ({
        ...current,
        busy: false,
        permission: getPushPermission(),
        error: err instanceof Error ? err.message : "Activation des notifications impossible.",
      }))
      return false
    }
  }, [callApi])

  const disable = useCallback(async (): Promise<boolean> => {
    setState((current) => ({ ...current, busy: true, error: null }))
    try {
      const endpoint = await unsubscribeFromPush()
      if (endpoint) {
        await callApi("/api/user/push/subscriptions", "DELETE", { endpoint })
      }
      setState((current) => ({ ...current, busy: false, subscribed: false }))
      return true
    } catch (err) {
      setState((current) => ({
        ...current,
        busy: false,
        error: err instanceof Error ? err.message : "Desactivation impossible.",
      }))
      return false
    }
  }, [callApi])

  const sendTest = useCallback(async (): Promise<boolean> => {
    setState((current) => ({ ...current, busy: true, error: null }))
    try {
      await callApi("/api/user/push/test", "POST")
      setState((current) => ({ ...current, busy: false }))
      return true
    } catch (err) {
      setState((current) => ({
        ...current,
        busy: false,
        error: err instanceof Error ? err.message : "Envoi du test impossible.",
      }))
      return false
    }
  }, [callApi])

  return { ...state, enable, disable, sendTest, refresh }
}
