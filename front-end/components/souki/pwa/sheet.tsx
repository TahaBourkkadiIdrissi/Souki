"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHaptic } from "@/hooks/useHaptic"

/**
 * Bottom-sheet (drawer) natif reutilisable. Extrait du drawer inline de
 * `mobile-bottom-nav.tsx` et generalise pour filtres, adresses, options…
 *
 * - Overlay assombri + backdrop-blur, fermeture au tap sur le fond.
 * - Poignee de glissement + fermeture au swipe vers le bas.
 * - Slide-up (`animate-slide-up`, deja definie et gardee reduced-motion).
 * - Verrouille le scroll du body tant que la feuille est ouverte.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  className?: string
}) {
  const haptic = useHaptic()
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)

  // Verrou du scroll de fond pendant l'ouverture.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Fermeture au clavier (Echap) pour l'accessibilite / preview desktop.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const handleClose = () => {
    haptic("light")
    onClose()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0]?.clientY ?? null
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const delta = (e.touches[0]?.clientY ?? 0) - startY.current
    setDragY(Math.max(0, delta))
  }
  const onTouchEnd = () => {
    if (dragY > 90) {
      handleClose()
    }
    startY.current = null
    setDragY(0)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-[#122018]/45 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "animate-slide-up rounded-t-[28px] bg-white/98 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-8px_32px_rgba(0,0,0,0.12)]",
          className,
        )}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Poignee de glissement */}
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#DDE7DD]" aria-hidden />

        {(title || subtitle) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && <p className="text-[17px] font-black leading-tight text-[#264129]">{title}</p>}
              {subtitle && <p className="mt-0.5 text-[13px] font-semibold text-[#7B8B7D]">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Fermer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#DDEBDD] text-[#607061] active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
