"use client"

import { useEffect, useState } from "react"
import { Download, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { isPwaStandalone } from "@/lib/pwa"
import { useAuth } from "@/hooks/useAuth"

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

// Seul l'admin ne voit PAS la banniere d'installation. Tous les autres profils
// Les clients et les visiteurs anonymes peuvent installer cette PWA.
const EXCLUDED_ROLES = ["ADMIN"]

export function PwaInstallPrompt() {
  const { user } = useAuth()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isStandalone, setIsStandalone] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Detection mobile + standalone (cote client uniquement). Tant que l'effet
  // n'a pas tourne, isMobile=false / isStandalone=true => rien ne s'affiche
  // (pas de flash au rendu serveur).
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)
    updateIsMobile()
    mediaQuery.addEventListener("change", updateIsMobile)

    setIsStandalone(isPwaStandalone())

    return () => mediaQuery.removeEventListener("change", updateIsMobile)
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // On capture l'evenement pour declencher l'installation au clic.
      event.preventDefault()
      if (isPwaStandalone()) return
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setDismissed(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  // Masquee uniquement pour l'admin ; visible pour tous les autres profils.
  const isExcludedUser =
    !!user &&
    [user.role, user.legacy_role, ...(user.roles ?? [])]
      .filter(Boolean)
      .map((role) => String(role).toUpperCase())
      .some((role) => EXCLUDED_ROLES.includes(role))

  const handleDownload = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
      setDismissed(true)
      return
    }
    // Pas de prompt natif disponible (iOS, ou criteres pas encore remplis) :
    // on deplie les instructions manuelles.
    setShowHelp((value) => !value)
  }

  if (isStandalone || !isMobile || isExcludedUser || dismissed) {
    return null
  }

  return (
    <div
      className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md rounded-2xl border border-[#1E8A3C]/20 bg-white p-3 shadow-2xl shadow-black/15"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1E8A3C] text-white">
          <Download className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#264129]">Télécharger SOUKI</p>
          <p className="text-xs leading-5 text-[#6F8070]">
            Installez l&apos;application pour un accès rapide, en plein écran.
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Masquer l'installation"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <Button
        type="button"
        className="mt-3 w-full bg-[#F07C00] text-white hover:bg-[#D66B00]"
        onClick={handleDownload}
      >
        <Download className="size-4" aria-hidden="true" />
        Télécharger l&apos;application
      </Button>

      {showHelp && (
        <p className="mt-3 rounded-xl bg-[#1E8A3C]/10 px-3 py-2 text-xs font-medium leading-5 text-[#1E8A3C]">
          Sur iPhone : appuyez sur <strong>Partager</strong> puis « Sur l&apos;écran d&apos;accueil ».
          Sur Android : menu <strong>⋮</strong> puis « Installer l&apos;application ».
        </p>
      )}
    </div>
  )
}
