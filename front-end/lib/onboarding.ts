const ONBOARDING_KEY = "souki-onboarding-completed"

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true
  return localStorage.getItem(ONBOARDING_KEY) === "true"
}

export function markOnboardingCompleted(): void {
  localStorage.setItem(ONBOARDING_KEY, "true")
}

export function shouldShowOnboarding(): boolean {
  return !isOnboardingCompleted()
}
