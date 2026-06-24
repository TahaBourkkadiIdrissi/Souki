"use client"

import { useEffect } from "react"

/**
 * Enregistre le service worker SOUKI de maniere inconditionnelle (navigateur ET
 * mode standalone). L'enregistrement etait auparavant gere dans PwaInstallPrompt,
 * mais court-circuite des que l'app tournait deja en standalone : l'app installee
 * pouvait donc fonctionner sans service worker controleur (pas d'offline).
 *
 * Ce composant ne rend rien : il se contente d'enregistrer le SW et de pousser les
 * mises a jour (activation immediate du nouveau worker + verification a chaque retour
 * au premier plan).
 */
export function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.update()

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing

          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" })
            }
          })
        })
      })
      .catch(() => undefined)

    const updateWhenVisible = () => {
      if (document.visibilityState === "visible") {
        navigator.serviceWorker.getRegistration().then((registration) => registration?.update())
      }
    }

    document.addEventListener("visibilitychange", updateWhenVisible)

    return () => {
      document.removeEventListener("visibilitychange", updateWhenVisible)
    }
  }, [])

  return null
}
