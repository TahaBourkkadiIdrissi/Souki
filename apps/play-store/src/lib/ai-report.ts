import { Linking } from "react-native"
import { soukiWhatsAppUrl } from "@souki/shared"

import { apiCall } from "@/lib/api"
import { AI_REPORT_ENDPOINT_ENABLED } from "@/lib/features"

/**
 * Signalement d'un contenu généré par l'IA (règle Google Play « AI-Generated Content » : l'utilisateur
 * doit pouvoir signaler une réponse choquante sans quitter l'app). La réponse est masquée tout de
 * suite à l'écran ; le signalement part au back-end (`POST /api/assistant/signalements`, tâche A4)
 * quand la route existe, sinon par WhatsApp à l'équipe SOUKI, message pré-rempli que l'utilisateur
 * confirme.
 */
export type AiSurface = "discussion" | "commande-vocale" | "panier-intelligent"
export type AiReportReason = "choquant" | "faux" | "autre"

export const AI_REPORT_REASONS: { id: AiReportReason; label: string }[] = [
  { id: "choquant", label: "Contenu choquant ou inapproprié" },
  { id: "faux", label: "Information fausse ou dangereuse" },
  { id: "autre", label: "Autre problème" },
]

export async function reportAiContent(surface: AiSurface, reason: AiReportReason, content: string): Promise<"sent" | "whatsapp"> {
  const excerpt = content.trim().slice(0, 600)
  if (AI_REPORT_ENDPOINT_ENABLED) {
    await apiCall("/api/assistant/signalements", { method: "POST", body: { surface, motif: reason, contenu: excerpt } })
    return "sent"
  }
  const message = `Signalement d'une réponse de l'assistant SOUKI (${surface}, motif : ${reason}).\n\n« ${excerpt} »`
  await Linking.openURL(soukiWhatsAppUrl(message))
  return "whatsapp"
}
