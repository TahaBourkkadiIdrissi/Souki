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
  keyboardAware = false,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  className?: string
  keyboardAware?: boolean
}) {
  const haptic = useHaptic()
  const [dragY, setDragY] = useState(0)
  const startY = useRef<number | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    if (!open || !keyboardAware) return
    const visual = window.visualViewport
    const update = () => setViewport({ top: visual?.offsetTop ?? 0, height: visual?.height ?? window.innerHeight })
    update()
    visual?.addEventListener("resize", update)
    visual?.addEventListener("scroll", update)
    return () => { visual?.removeEventListener("resize", update); visual?.removeEventListener("scroll", update) }
  }, [open, keyboardAware])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const elements = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')
      if (!elements?.length) { event.preventDefault(); return }
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus() }
    }
    window.addEventListener("keydown", trap)
    return () => { window.removeEventListener("keydown", trap); previous?.focus() }
  }, [open])

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
      aria-label={typeof title === "string" ? title : "Dialogue Souki"}
      style={keyboardAware && viewport ? { top: viewport.top, height: viewport.height, bottom: "auto" } : undefined}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={cn(
          "animate-slide-up rounded-t-[28px] bg-white/98 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-8px_32px_rgba(0,0,0,0.12)]",
          className,
        )}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poignee de glissement */}
        <div className="mx-auto mb-3 flex h-5 w-16 shrink-0 items-center justify-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} aria-hidden><span className="h-1.5 w-11 rounded-full bg-[#DDE7DD]" /></div>

        {(title || subtitle) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && <div className="text-[17px] font-black leading-tight text-[#264129]">{title}</div>}
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
