"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isPwaStandalone } from "@/lib/pwa"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)

  useEffect(() => {
    if (isPwaStandalone()) {
      setIsStandalone(true)
      setIsVisible(false)
      return
    }

    setIsStandalone(false)
    setIsVisible(true)

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

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()

      if (isPwaStandalone()) {
        return
      }

      setInstallPrompt(event as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsVisible(false)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installPrompt) {
      return
    }

    await installPrompt.prompt()
    await installPrompt.userChoice

    setInstallPrompt(null)
    setIsVisible(false)
  }

  const dismiss = () => {
    setIsVisible(false)
  }

  if (!isVisible || !installPrompt) {
    if (!isVisible || isStandalone) {
      return null
    }

    return (
      <div
        className={cn(
          "fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md rounded-lg border border-green-market/20 bg-white p-3 shadow-2xl shadow-black/15",
          "md:bottom-5 md:right-5 md:left-auto md:mx-0",
          "dark:border-green-fresh/25 dark:bg-card",
        )}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-market text-white">
            <Download className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Installer SOUKI</p>
            <p className="text-xs leading-5 text-muted-foreground">
              Ajoutez SOUKI a votre ecran d'accueil pour l'ouvrir comme une application.
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            onClick={dismiss}
            aria-label="Masquer l'installation"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-3 rounded-md bg-green-market/10 px-3 py-2 text-xs font-medium leading-5 text-green-market">
          Si le bouton natif n'apparait pas, ouvrez le menu du navigateur puis choisissez Ajouter a l'ecran d'accueil.
        </p>
      </div>
    )
  }

  if (!isVisible || isStandalone) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md rounded-lg border border-green-market/20 bg-white p-3 shadow-2xl shadow-black/15",
        "md:bottom-5 md:right-5 md:left-auto md:mx-0",
        "dark:border-green-fresh/25 dark:bg-card",
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-green-market text-white">
          <Download className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Installer SOUKI</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Ajoutez SOUKI a votre ecran d'accueil pour l'ouvrir comme une application.
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          onClick={dismiss}
          aria-label="Masquer l'installation"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <Button type="button" className="mt-3 w-full bg-orange-cta text-white hover:bg-orange-cta/90" onClick={installApp}>
        <Download className="size-4" aria-hidden="true" />
        Installer l'application SOUKI
      </Button>
    </div>
  )
}
