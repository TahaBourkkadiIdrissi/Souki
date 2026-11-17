import { ANDROID_APP_ID } from "@/lib/store-apps"

/** Drapeau de session pose au lancement de l'app Google Play (script inline de app/layout.tsx). */
export const PLAY_APP_FLAG = "souki-play-app"

/**
 * Vrai dans l'app Google Play SOUKI (la PWA emballee, apps/play-store-pwa) : Android ouvre le
 * site avec le referent `android-app://io.souki.app`, retenu pour la session par le script
 * inline du <head>. On n'y propose jamais d'installer ni de telecharger l'app.
 */
export function isPlayStoreApp() {
  if (typeof window === "undefined") {
    return false
  }
  if (document.referrer.startsWith(`android-app://${ANDROID_APP_ID}`)) {
    return true
  }
  try {
    return sessionStorage.getItem(PLAY_APP_FLAG) === "1"
  } catch {
    return false
  }
}

export type NavigatorWithStandalone = Navigator & {
  standalone?: boolean
}

export function isPwaStandalone() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as NavigatorWithStandalone).standalone === true ||
    isPlayStoreApp()
  )
}
