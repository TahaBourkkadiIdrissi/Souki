"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Conteneur d'ecran mobile natif (PWA). Standardise le fond, la hauteur pleine
 * (`min-h-dvh`, robuste face aux barres d'URL mobiles) et le padding bas qui
 * degage la barre de navigation + la safe-area (`.mobile-native-surface`).
 *
 * Neutre sur le web : ce wrapper n'est cense envelopper que le rendu `< md`
 * d'une page. La version desktop (`md:`+) garde sa propre structure inchangee.
 */
export function PwaScreen({
  children,
  className,
  background = "bg-[#F2F6F3]",
  withNav = true,
}: {
  children: ReactNode
  className?: string
  /** Couleur/te de fond de l'ecran (classe Tailwind). */
  background?: string
  /** Reserve l'espace bas pour `MobileBottomNav` + safe-area. */
  withNav?: boolean
}) {
  return (
    <main
      className={cn(
        "min-h-dvh text-[#3D3D3D] font-sans",
        background,
        withNav && "mobile-native-surface",
        className,
      )}
    >
      {children}
    </main>
  )
}
