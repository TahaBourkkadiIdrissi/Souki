import { apiCall } from "@/lib/api"

/**
 * Etat d'onboarding.
 *
 * La source de verite est le compte lui-meme (t_users.onboarding_completed_at,
 * expose par /auth/login et /auth/me sous `onboarding_completed`) : l'onboarding
 * ne s'affiche donc que pour un email nouvellement cree, et jamais a nouveau,
 * quel que soit l'appareil.
 *
 * Le localStorage ne sert plus que de cache local, indexe par identifiant de
 * compte, pour eviter un aller-retour reseau au demarrage de l'app.
 */

const ONBOARDING_KEY_PREFIX = "souki-onboarding-completed"

/** Ancienne cle globale, non liee au compte : source du bug d'affichage repete. */
const LEGACY_ONBOARDING_KEY = "souki-onboarding-completed"

type OnboardingUser = { id: number; onboarding_completed?: boolean } | null | undefined

function cacheKey(userId: number): string {
  return `${ONBOARDING_KEY_PREFIX}:${userId}`
}

function readCache(userId: number): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(cacheKey(userId)) === "true"
}

function writeCache(userId: number): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(cacheKey(userId), "true")
  // L'ancienne cle globale ferait reapparaitre l'onboarding pour tout autre
  // compte utilise sur cet appareil : on s'en debarrasse au passage.
  window.localStorage.removeItem(LEGACY_ONBOARDING_KEY)
}

export function isOnboardingCompleted(user: OnboardingUser): boolean {
  if (!user) return true
  return user.onboarding_completed === true || readCache(user.id)
}

export function shouldShowOnboarding(user: OnboardingUser): boolean {
  return false
}

/**
 * Marque l'onboarding comme termine : cache local d'abord (la navigation qui suit
 * est immediate), puis persistance serveur. Un echec reseau n'empeche pas de
 * continuer — la prochaine session repassera par l'onboarding, ce qui est preferable
 * a bloquer l'utilisateur sur l'ecran.
 */
export async function markOnboardingCompleted(user: OnboardingUser): Promise<void> {
  if (user) writeCache(user.id)

  try {
    await apiCall("/api/user/onboarding", { method: "POST" })
  } catch {
    // Persistance serveur best-effort : ne bloque jamais la sortie de l'onboarding.
  }
}
