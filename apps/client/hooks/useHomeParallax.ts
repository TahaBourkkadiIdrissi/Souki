"use client"

import { useEffect, type RefObject } from "react"

/** Paint transforms directly; scrolling never rerenders the product lists. */
export function useHomeParallax(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const hero = ref.current
    if (!enabled || !hero) return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let frame = 0
    const paint = () => {
      frame = 0
      const offset = reduced.matches ? 0 : Math.min(window.scrollY, hero.offsetHeight)
      hero.style.setProperty("--hero-slow", `${offset * 0.14}px`)
      hero.style.setProperty("--hero-fast", `${offset * 0.3}px`)
      hero.style.setProperty("--hero-header", `${offset * 0.12}px`)
      hero.style.setProperty("--hero-opacity", String(reduced.matches ? 1 : Math.max(1 - offset / 700, 0.55)))
    }
    const onScroll = () => {
      if (!document.hidden && !reduced.matches && !frame) frame = window.requestAnimationFrame(paint)
    }
    const refresh = () => {
      window.cancelAnimationFrame(frame)
      frame = 0
      const main = hero.closest("main")
      if (main) main.dataset.motionPaused = String(document.hidden || reduced.matches)
      if (!document.hidden) paint()
    }
    refresh()
    window.addEventListener("scroll", onScroll, { passive: true })
    document.addEventListener("visibilitychange", refresh)
    reduced.addEventListener("change", refresh)
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", refresh); reduced.removeEventListener("change", refresh) }
  }, [ref, enabled])
}
