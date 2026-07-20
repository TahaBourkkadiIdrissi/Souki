"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHaptic } from "@/hooks/useHaptic"

/**
 * En-tete d'ecran mobile natif. Gere la safe-area haute (`env(safe-area-inset-top)`),
 * un chevron de retour optionnel (48px, portee de pouce, haptique), un titre
 * centre et un slot d'action a droite.
 *
 * Deux variantes :
 *   - "solid" (defaut) : barre blanche sticky, facon barre de navigation iOS.
 *   - "hero"           : bandeau degrade vert nature (comme l'accueil PWA), pour
 *                        les ecrans d'ouverture. Non sticky.
 */
export function PwaHeader({
  title,
  subtitle,
  onBack,
  showBack = true,
  action,
  variant = "solid",
  className,
  children,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  /** Handler retour ; par defaut `router.back()`. */
  onBack?: () => void
  showBack?: boolean
  /** Element aligne a droite (bouton profil, action…). */
  action?: ReactNode
  variant?: "solid" | "hero"
  className?: string
  /** Contenu additionnel sous la barre de titre (recherche, segments…). */
  children?: ReactNode
}) {
  const router = useRouter()
  const haptic = useHaptic()

  const handleBack = () => {
    haptic("light")
    if (onBack) {
      onBack()
      return
    }
    router.back()
  }

  const isHero = variant === "hero"

  return (
    <header
      className={cn(
        "px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3",
        isHero
          ? "relative overflow-hidden rounded-b-[32px] bg-gradient-to-br from-[#113B1E] via-[#1A4F2C] to-[#2DA050] text-white shadow-[0_18px_40px_-20px_rgba(17,59,30,0.7)]"
          : "sticky top-0 z-30 border-b border-[#E7F0E8] bg-white/95 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex min-h-11 items-center gap-2">
        {showBack ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:scale-90",
              isHero ? "bg-white/15 text-white" : "text-[#1A4F2C] hover:bg-[#F0FAF1]",
            )}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <span className="h-11 w-11 shrink-0" aria-hidden />
        )}

        <div className="min-w-0 flex-1 text-center">
          {title && (
            <h1
              className={cn(
                "truncate text-[17px] font-black leading-tight",
                isHero ? "text-white drop-shadow-sm" : "text-[#264129]",
              )}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p
              className={cn(
                "truncate text-[12px] font-medium leading-tight",
                isHero ? "text-[#D3EEDB]" : "text-[#8A8A8A]",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-end">{action}</div>
      </div>

      {children}
    </header>
  )
}
