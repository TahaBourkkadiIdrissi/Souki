"use client"

import { useEffect, useState } from "react"
import { getOrderHours } from "@/lib/order-hours"
import { getCurrentOrderHours, refreshOrderSchedule, subscribeOrderSchedule } from "@/lib/order-schedule-client"

/** Owned by small clock components, never by the product-list page. */
export function useOrderCountdown() {
  const [state, setState] = useState<ReturnType<typeof getOrderHours> | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const resume = () => {
      window.clearInterval(timer)
      if (document.hidden) return
      void refreshOrderSchedule()
      setState(getCurrentOrderHours())
      timer = window.setInterval(() => {
        const current = getCurrentOrderHours()
        setState(current)
        if (current.seconds === 0 && current.minutes === 0) void refreshOrderSchedule()
      }, 1000)
    }
    resume()
    document.addEventListener("visibilitychange", resume)
    const unsubscribe = subscribeOrderSchedule(() => setState(getCurrentOrderHours()))
    return () => { unsubscribe(); window.clearInterval(timer); document.removeEventListener("visibilitychange", resume) }
  }, [])
  return state
}
