"use client"

import { useCallback } from "react"

/**
 * Retour haptique natif (Vibration API), centralise pour toute la PWA.
 *
 * Remplace les `navigator.vibrate?.(20)` disperses inline. SSR-safe (garde
 * `typeof navigator`), silencieux quand l'API n'existe pas (desktop, iOS Safari
 * qui n'expose pas encore `vibrate`) et respecte `prefers-reduced-motion` :
 * un utilisateur qui coupe les animations ne veut pas non plus de vibrations.
 *
 * Patterns calibres facon iOS Haptic (leger/moyen + sequences de feedback) :
 *   - light   : tap discret (quick-add, selection)
 *   - medium  : action confirmee (ajout panier, validation d'etape)
 *   - heavy   : action lourde / destructive
 *   - success : sequence courte de reussite (checkout, OTP valide)
 *   - warning : double impulsion d'alerte
 *   - error   : triple impulsion d'echec
 */
export type HapticPattern = "light" | "medium" | "heavy" | "success" | "warning" | "error"

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  success: [15, 40, 15],
  warning: [20, 60, 20],
  error: [30, 40, 30, 40, 30],
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function useHaptic() {
  return useCallback((pattern: HapticPattern = "light") => {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
      return
    }
    if (prefersReducedMotion()) {
      return
    }
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      // Certains navigateurs jettent si l'appel n'est pas issu d'un geste
      // utilisateur : on ignore silencieusement.
    }
  }, [])
}
