"use client"

import { useEffect, useRef } from "react"

/**
 * Barre de progression de scroll fixee tout en haut de l'ecran : elle se
 * remplit de gauche a droite (degrade vert -> orange, couleurs du site) au fur
 * et a mesure que l'utilisateur descend, pour situer la fin de page.
 *
 * 100% passif : mise a jour via transform scaleX (compositor only, pas de
 * reflow), listener passive + rAF. Purement decoratif (aria-hidden) et fige
 * sans transition si l'utilisateur prefere moins d'animations.
 */
export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const doc = document.documentElement
      const max = doc.scrollHeight - doc.clientHeight
      const progress = max > 0 ? Math.min(doc.scrollTop / max, 1) : 0
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`
      }
    }

    const onScroll = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 z-[60] h-1 bg-transparent"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left rounded-r-full bg-gradient-to-r from-[#1E8A3C] via-[#4CB84A] to-[#F07C00] shadow-[0_0_8px_rgba(76,184,74,0.55)] transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transform: "scaleX(0)" }}
      />
    </div>
  )
}
