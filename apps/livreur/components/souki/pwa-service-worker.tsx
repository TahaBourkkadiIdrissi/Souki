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

    const updateRegistration = async (registration: ServiceWorkerRegistration) => {
      try {
        await registration.update()
      } catch {
        // Une indisponibilite temporaire du worker ne doit jamais casser l'UI.
      }
    }

    // Un service worker en mode `next dev` peut conserver d'anciens bundles,
    // perturber le HMR et produire une erreur si /sw.js est momentanement absent.
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        )
        .catch(() => undefined)
      return
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        void updateRegistration(registration)

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
        void navigator.serviceWorker
          .getRegistration()
          .then((registration) => {
            if (registration) {
              return updateRegistration(registration)
            }
          })
          .catch(() => undefined)
      }
    }

    document.addEventListener("visibilitychange", updateWhenVisible)

    return () => {
      document.removeEventListener("visibilitychange", updateWhenVisible)
    }
  }, [])

  return null
}
