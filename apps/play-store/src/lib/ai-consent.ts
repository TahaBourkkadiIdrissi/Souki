import { readJson, writeJson } from "@/lib/local-store"

/**
 * Accord pour les assistants IA (regle Apple 5.1.2(i) : accord explicite avant d'envoyer des
 * donnees personnelles a une IA externe). Garde sur le telephone, par compte, avec la version du
 * texte accepte : si le texte change (nouveau prestataire), on redemande l'accord.
 */
export const AI_CONSENT_VERSION = 1

type StoredConsent = { version: number; at: string } | null

function consentKey(userId: number | null | undefined) {
  return `souki_ai_consent:${userId ?? "me"}`
}

export function hasAiConsent(userId: number | null | undefined): boolean {
  const stored = readJson<StoredConsent>(consentKey(userId), null)
  return stored !== null && stored.version === AI_CONSENT_VERSION
}

export function giveAiConsent(userId: number | null | undefined): void {
  writeJson(consentKey(userId), { version: AI_CONSENT_VERSION, at: new Date().toISOString() })
}

export function withdrawAiConsent(userId: number | null | undefined): void {
  writeJson(consentKey(userId), null)
}
