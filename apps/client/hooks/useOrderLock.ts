"use client"

import { useEffect, useState } from "react"

import { getOrderHours, ORDER_CLOSED_MESSAGE } from "@/lib/order-hours"
import { getCurrentOrderHours, refreshOrderSchedule, subscribeOrderSchedule, millisecondsToOrderTransition } from "@/lib/order-schedule-client"

export const isOrderLockedAt = (date = new Date()) => getOrderHours(date).closed
export const getOrderLockState = (date = new Date()) => ({
  isLocked: isOrderLockedAt(date), message: ORDER_CLOSED_MESSAGE, deliveryDate: getOrderHours(date).deliveryDate,
})

export function useOrderLock() {
  const [state, setState] = useState(() => getOrderLockState())

  useEffect(() => {
    const refreshState = () => {
      const current = getCurrentOrderHours()
      setState({ isLocked: current.closed, message: ORDER_CLOSED_MESSAGE, deliveryDate: current.deliveryDate })
    }
    refreshState()

    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      if (document.hidden) return
      refreshState()
      void refreshOrderSchedule()
      timer = window.setTimeout(schedule, millisecondsToOrderTransition())
    }
    schedule()
    document.addEventListener("visibilitychange", schedule)
    const unsubscribe = subscribeOrderSchedule(() => {
      refreshState()
      window.clearTimeout(timer)
      timer = window.setTimeout(schedule, millisecondsToOrderTransition())
    })
    return () => { unsubscribe(); window.clearTimeout(timer); document.removeEventListener("visibilitychange", schedule) }
  }, [])

  return state
}
