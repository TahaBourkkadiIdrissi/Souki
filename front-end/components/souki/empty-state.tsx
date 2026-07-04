"use client"

import type { CSSProperties, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface SoukiEmptyStateProps {
  /** Icone lucide de secours tant qu'aucune illustration n'est fournie. */
  icon?: LucideIcon
  /** Illustration de marque (mascotte Recolte) — chargee en lazy, jamais bloquante. */
  illustrationSrc?: string
  illustrationAlt?: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/**
 * Etat vide SOUKI : meme carte blanche arrondie que les etats vides existants,
 * avec une entree douce et un emplacement pour l'illustration de la mascotte.
 * L'illustration est decorative : le texte porte toujours l'information.
 */
export function SoukiEmptyState({
  icon: Icon,
  illustrationSrc,
  illustrationAlt = "",
  title,
  description,
  action,
  className,
}: SoukiEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-[#E6EFE7] bg-white p-8 text-center animate-fade-in-up",
        className
      )}
    >
      {illustrationSrc ? (
        <img
          src={illustrationSrc}
          alt={illustrationAlt}
          loading="lazy"
          decoding="async"
          width={160}
          height={160}
          className="mx-auto mb-4 h-40 w-40 object-contain animate-gentle-float"
          aria-hidden={illustrationAlt === ""}
        />
      ) : (
        Icon && <Icon className="mx-auto mb-3 h-10 w-10 text-[#B8C9BA]" />
      )}
      <p className="font-semibold text-[#264129]">{title}</p>
      {description && (
        <p
          className="mx-auto mt-2 max-w-xs text-sm text-[#8A8A8A] animate-fade-in-up-delay-1"
          style={{ animationFillMode: "both" } as CSSProperties}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
