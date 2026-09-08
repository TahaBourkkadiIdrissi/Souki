"use client"

import { useEffect, useState, type ReactNode } from "react"
import { isPwaStandalone } from "@/lib/pwa"
import { cn } from "@/lib/utils"

/**
 * Barre d'action fixee en bas d'ecran (CTA principal du parcours : "Commander",
 * "Payer", "Ajouter au panier"…). Place les actions primaires dans la zone la
 * plus accessible au pouce (heatmap basse).
 *
 * Gere la safe-area basse et, quand `aboveNav` est vrai, se positionne au-dessus
 * de `MobileBottomNav` (~5rem) — uniquement en PWA installee : sur le web la
 * navigation est desormais en haut de page, la barre se colle donc en bas.
 * Visible en mobile uniquement (`md:hidden`) pour ne pas alterer la mise en
 * page web desktop.
 */
export function StickyBottomBar({
  children,
  className,
  aboveNav = false,
}: {
  children: ReactNode
  className?: string
  /** Remonte la barre au-dessus de la barre de navigation mobile (PWA). */
  aboveNav?: boolean
}) {
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    setIsStandalone(isPwaStandalone())
  }, [])

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-t border-[#E7F0E8] bg-white/95 px-4 pt-3 backdrop-blur-md md:hidden",
        "shadow-[0_-8px_28px_-16px_rgba(17,59,30,0.35)]",
        aboveNav && isStandalone
          ? "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] pb-3"
          : "bottom-0 pb-[max(env(safe-area-inset-bottom),0.75rem)]",
        className,
      )}
    >
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  )
}
