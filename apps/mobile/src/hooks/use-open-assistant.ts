import { useCallback } from "react"
import { useRouter } from "expo-router"

import { useAuth } from "@/contexts/auth-context"
import { hasAiConsent } from "@/lib/ai-consent"
import { haptics } from "@/lib/haptics"

export type AssistantMode = "voice" | "smart" | "chat"

export const ASSISTANT_ROUTES = { voice: "/commande-vocale", smart: "/panier-intelligent", chat: "/souki-chat" } as const

/**
 * Ouvre un assistant IA-SOUKI (commande vocale, panier intelligent, discussion avec Souki).
 * Les trois demandent un compte, comme sur le site : un invite passe par la connexion. Avant le
 * premier usage, l'accord pour l'IA est demande (feuille « accord-ia », regle Apple 5.1.2(i)).
 */
export function useOpenAssistant() {
  const router = useRouter()
  const { status, user } = useAuth()
  return useCallback(
    (mode: AssistantMode) => {
      haptics.medium()
      if (status !== "signedIn") return router.push("/connexion")
      if (!hasAiConsent(user?.id)) return router.push({ pathname: "/accord-ia", params: { next: mode } })
      router.push(ASSISTANT_ROUTES[mode])
    },
    [router, status, user?.id],
  )
}
