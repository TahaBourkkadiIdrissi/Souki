"use client"

import { useEffect, useState } from "react"

const HINTS = ["Tomates fraîches…", "Pommes de terre…", "Menthe & coriandre…", "Oranges de saison…", "Courgettes du jour…"]

export function SearchHint() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    let timer: number | undefined
    const resume = () => {
      window.clearInterval(timer)
      if (document.hidden || reduced.matches) return
      timer = window.setInterval(() => setIndex((current) => (current + 1) % HINTS.length), 2600)
    }
    resume()
    document.addEventListener("visibilitychange", resume)
    reduced.addEventListener("change", resume)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume); reduced.removeEventListener("change", resume) }
  }, [])
  return <span key={index} aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[15px] font-medium text-gray-400 animate-fade-in">{HINTS[index]}</span>
}
