"use client"

import { SoukiLogo } from "@/components/souki/souki-logo"
import { WifiOff, RefreshCw } from "lucide-react"

import { RecolteAvatar } from "@/components/avatar/recolte-avatar"
import { useLocale } from "@/contexts/locale-context"

export default function OfflinePage() {
  const { t, zoneProps } = useLocale()
  const retry = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  return (
    <div {...zoneProps} className="min-h-screen bg-[#F5F5F0] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-3xl border border-[#DDE7DE] bg-white px-8 py-10 text-center shadow-sm">
        <div className="relative mx-auto w-fit">
          <RecolteAvatar size="md" expression="curious" label={t("Récolte cherche le réseau")} />
          <div className="absolute -right-2 -top-1 flex size-8 items-center justify-center rounded-full bg-[#EAF8EC] text-[#1E8A3C] ring-2 ring-white">
            <WifiOff className="size-4" aria-hidden="true" />
          </div>
        </div>
        <SoukiLogo variant="secondary" height={104} className="mb-4" />
        <h1 className="mt-2 text-2xl font-bold text-[#1E8A3C]">{t("Vous etes hors ligne")}</h1>
        <p className="mt-3 text-sm leading-6 text-[#677669]">
          {t("Impossible de joindre le marche pour le moment. Verifiez votre connexion puis reessayez.")}
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1E8A3C] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1E8A3C]/90"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("Reessayer")}
        </button>
      </div>
    </div>
  )
}
