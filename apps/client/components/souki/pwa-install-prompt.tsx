"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Download, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { isPwaStandalone } from "@/lib/pwa"
import { useAuth } from "@/hooks/useAuth"

import { chromeIntent, installPlatform, type InstallPromptEvent } from "@/lib/pwa-install"
import { IosInstallGuide } from "@/components/souki/pwa/ios-install-guide"

// Seul l'admin ne voit PAS la banniere d'installation. Tous les autres profils
// Les clients et les visiteurs anonymes peuvent installer cette PWA.
const EXCLUDED_ROLES = ["ADMIN"]

export function PwaInstallPrompt() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Hide until the installed display mode is known, on every screen size.
  useEffect(() => {
    setIsStandalone(isPwaStandalone())
    setInstallPrompt(window.soukiInstallPrompt ?? null)
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // On capture l'evenement pour declencher l'installation au clic.
      event.preventDefault()
      if (isPwaStandalone()) return
      setInstallPrompt(event as InstallPromptEvent)
    }

    const handleAppInstalled = () => {
      window.soukiInstallPrompt = null
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
    const platform = installPlatform()
    if (platform.embedded && platform.android) {
      window.location.href = chromeIntent(window.location.href)
      setShowHelp(true)
      return
    }
    const prompt = installPrompt ?? window.soukiInstallPrompt
    try {
      if (prompt) {
        await prompt.prompt()
        const choice = await prompt.userChoice
        window.soukiInstallPrompt = null
        setInstallPrompt(null)
        if (choice.outcome === "accepted") setDismissed(true)
        return
      }
      const installer = navigator as Navigator & { install?: () => Promise<unknown> }
      if (typeof installer.install === "function") {
        await installer.install()
        return
      }
    } catch { /* Unsupported or rejected: retain the manual installation guide. */ }
    setShowHelp(true)
  }

  if (isStandalone || isExcludedUser || dismissed || /^\/commandes\/[^/]+\/modifier\/?$/.test(pathname)) {
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

      {showHelp && (installPlatform().ios
        ? <IosInstallGuide onClose={() => setShowHelp(false)} />
        : <p className="mt-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900">Ouvrez le menu <strong>⋮</strong> du navigateur, puis « Installer l’application ». Si cette option manque, ouvrez Souki dans Chrome ou Edge.</p>)}
    </div>
  )
}
