"use client"

import { useEffect, useRef, useState } from "react"
import { RefreshCw } from "lucide-react"

export function MobilePullToRefresh() {
  const [distance, setDistance] = useState(0)
  // La distance courante est aussi tenue dans un ref : le handler touchend en a
  // besoin sans que `distance` figure dans les dépendances de l'effet. Sinon
  // l'effet se ré-exécute — et ré-abonne les 3 listeners tactiles globaux — à
  // CHAQUE frame de setDistance pendant un tirage. On abonne une seule fois.
  const distanceRef = useRef(0)

  useEffect(() => {
    let startY = 0
    let isTracking = false

    const setDistanceBoth = (value: number) => {
      distanceRef.current = value
      setDistance(value)
    }

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false
      }
      return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
    }

    const onTouchStart = (event: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches || window.scrollY > 0 || isEditableTarget(event.target)) {
        isTracking = false
        return
      }
      startY = event.touches[0]?.clientY ?? 0
      isTracking = true
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!isTracking) {
        return
      }
      const nextY = event.touches[0]?.clientY ?? 0
      const pullDistance = Math.max(0, Math.min(96, nextY - startY))
      setDistanceBoth(pullDistance)
    }

    const onTouchEnd = () => {
      if (isTracking && distanceRef.current > 72) {
        window.location.reload()
        return
      }
      isTracking = false
      setDistanceBoth(0)
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true })
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend", onTouchEnd, { passive: true })

    return () => {
      window.removeEventListener("touchstart", onTouchStart)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [])

  if (distance <= 0) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-3 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#D7EBD9] bg-white/95 px-4 py-2 text-xs font-bold text-[#1E8A3C] shadow-[0_12px_28px_-18px_rgba(30,65,41,0.4)] backdrop-blur md:hidden"
      style={{ transform: `translate(-50%, ${Math.min(28, distance / 3)}px)` }}
    >
      <RefreshCw className="h-4 w-4" />
      {distance > 72 ? "Relacher pour actualiser" : "Tirer pour actualiser"}
    </div>
  )
}
