import type { ProfileDTO } from "@souki/shared"

import { readItem, writeItem } from "@/lib/device-storage"

/**
 * Onboarding (design system 2027, passation F5 quinquies) : montre une seule fois, juste apres la
 * CREATION d'un compte (code d'inscription valide, ou premiere connexion Google / Apple qui cree le
 * compte), jamais apres une simple connexion. « Vu » est garde sur le telephone.
 */
export const ONBOARDING_KEY = "souki.onboarding.v1"

export type OnboardingInfo = "prenom" | "adresse" | "telephone"

export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await readItem(ONBOARDING_KEY)) === "1"
  } catch {
    return false
  }
}

export async function markOnboardingSeen(): Promise<void> {
  await writeItem(ONBOARDING_KEY, "1").catch(() => undefined)
}

/**
 * Seulement ce qui manque pour livrer. L'inscription par e-mail donne deja prenom, adresse et
 * telephone : rien n'est redemande. Google / Apple ne donnent souvent que l'e-mail (B11).
 */
export function missingInfo(profile: ProfileDTO | null): OnboardingInfo[] {
  if (!profile) return []
  const missing: OnboardingInfo[] = []
  if (!profile.prenom?.trim()) missing.push("prenom")
  if (!profile.address?.adresse?.trim()) missing.push("adresse")
  if (!profile.telephone?.trim()) missing.push("telephone")
  return missing
}

/** Telephone saisi apres « +212 » : 9 chiffres commencant par 6 ou 7. */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0/, "").slice(0, 9)
}

export function isPhoneComplete(raw: string): boolean {
  return /^[67]\d{8}$/.test(phoneDigits(raw))
}

/** « 612345678 » -> « 6 12 34 56 78 » (comme le champ du design). */
export function formatPhoneDigits(raw: string): string {
  const digits = phoneDigits(raw)
  return [digits.slice(0, 1), digits.slice(1, 3), digits.slice(3, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(" ")
}
