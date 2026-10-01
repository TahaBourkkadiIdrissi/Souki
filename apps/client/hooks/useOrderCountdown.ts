"use client"

import { useEffect, useState } from "react"
import { getOrderHours } from "@/lib/order-hours"

/** Owned by small clock components, never by the product-list page. */
export function useOrderCountdown() {
  const [state, setState] = useState<ReturnType<typeof getOrderHours> | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const resume = () => {
      window.clearInterval(timer)
      if (document.hidden) return
      setState(getOrderHours())
      timer = window.setInterval(() => setState(getOrderHours()), 1000)
    }
    resume()
    document.addEventListener("visibilitychange", resume)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", resume) }
  }, [])
  return state
}
