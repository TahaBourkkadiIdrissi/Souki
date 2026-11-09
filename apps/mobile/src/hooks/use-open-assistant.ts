import { useCallback } from "react"
import { useRouter } from "expo-router"

import { useAuth } from "@/contexts/auth-context"
import { haptics } from "@/lib/haptics"

export type AssistantMode = "voice" | "smart" | "chat"

const ROUTES = { voice: "/commande-vocale", smart: "/panier-intelligent", chat: "/souki-chat" } as const

/**
 * Ouvre un assistant IA-SOUKI (commande vocale, panier intelligent, discussion avec Souki).
 * Les trois demandent un compte, comme sur le site : un invite passe par la connexion.
 */
export function useOpenAssistant() {
  const router = useRouter()
  const { status } = useAuth()
  return useCallback(
    (mode: AssistantMode) => {
      haptics.medium()
      router.push(status === "signedIn" ? ROUTES[mode] : "/connexion")
    },
    [router, status],
  )
}
