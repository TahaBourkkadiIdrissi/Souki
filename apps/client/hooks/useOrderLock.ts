"use client"

import { useEffect, useState } from "react"

import { getOrderHours, ORDER_CLOSED_MESSAGE } from "@/lib/order-hours"

export const isOrderLockedAt = (date = new Date()) => getOrderHours(date).closed
export const getOrderLockState = (date = new Date()) => ({
  isLocked: isOrderLockedAt(date), message: ORDER_CLOSED_MESSAGE,
})

export function useOrderLock() {
  const [state, setState] = useState(() => getOrderLockState())

  useEffect(() => {
    const refreshState = () => setState(getOrderLockState())
    refreshState()

    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      if (document.hidden) return
      refreshState()
      timer = window.setTimeout(schedule, Math.max(1, getOrderHours().nextTransition - Date.now() + 50))
    }
    schedule()
    document.addEventListener("visibilitychange", schedule)
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", schedule) }
  }, [])

  return state
}
