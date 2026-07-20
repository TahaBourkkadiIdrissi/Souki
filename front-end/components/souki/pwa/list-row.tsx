"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHaptic } from "@/hooks/useHaptic"

/**
 * Ligne de liste native (facon reglages iOS) : icone teintee optionnelle,
 * titre + sous-titre, valeur/slot a droite, chevron. Hauteur >= 56px (portee de
 * pouce). Rendue en `<Link>` si `href`, sinon en `<button>` si `onClick`, sinon
 * en `<div>` statique.
 *
 * Utilisee pour Parametres, Wallet (transactions), Historique, menus.
 */
export function ListRow({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  value,
  href,
  onClick,
  showChevron = true,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  /** Classe de la pastille d'icone (fond + couleur). */
  iconClassName?: string
  title: ReactNode
  subtitle?: ReactNode
  /** Contenu aligne a droite avant le chevron. */
  value?: ReactNode
  href?: string
  onClick?: () => void
  showChevron?: boolean
  className?: string
}) {
  const haptic = useHaptic()
  const interactive = Boolean(href || onClick)

  const inner = (
    <>
      {Icon && (
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E8A3C]/10 text-[#1E8A3C]",
            iconClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-bold text-[#264129]">{title}</span>
        {subtitle && (
          <span className="mt-0.5 block truncate text-[13px] font-medium text-[#8A8A8A]">{subtitle}</span>
        )}
      </span>
      {value && <span className="shrink-0 text-[14px] font-bold text-[#3D3D3D]">{value}</span>}
      {interactive && showChevron && <ChevronRight className="h-5 w-5 shrink-0 text-gray-300" />}
    </>
  )

  const base = cn(
    "flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm shadow-gray-200/50 border border-gray-100",
    interactive && "transition active:scale-[0.98]",
    className,
  )

  if (href) {
    return (
      <Link href={href} className={base} onClick={() => haptic("light")}>
        {inner}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={base}
        onClick={() => {
          haptic("light")
          onClick()
        }}
      >
        {inner}
      </button>
    )
  }

  return <div className={base}>{inner}</div>
}
