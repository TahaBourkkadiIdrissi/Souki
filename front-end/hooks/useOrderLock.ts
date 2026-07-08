"use client"

import { useEffect, useState } from "react"

// Verrou frontend de commande (BUG-004) : restaure et aligne sur le cutoff
// backend (ORDER_CUTOFF_START/END dans checkout_service.py, 20h00 -> 08h00,
// heure du Maroc). Le backend reste la source de verite (403 apres cutoff).
const MOROCCO_TIME_ZONE = "Africa/Casablanca"
const LOCK_START_MINUTES = 20 * 60
const LOCK_END_MINUTES = 8 * 60
const LOCK_MESSAGE =
  "Les commandes sont fermees pour preparer les livraisons. Reouverture a 08h00."

type OrderLockState = {
  isLocked: boolean
  message: string
}

const getMoroccoMinutes = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fr-MA", {
    timeZone: MOROCCO_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  return hour * 60 + minute
}

export const isOrderLockedAt = (date = new Date()) => {
  const minutes = getMoroccoMinutes(date)
  return minutes >= LOCK_START_MINUTES || minutes < LOCK_END_MINUTES
}

export const getOrderLockState = (date = new Date()): OrderLockState => ({
  isLocked: isOrderLockedAt(date),
  message: LOCK_MESSAGE,
})

export function useOrderLock() {
  const [state, setState] = useState<OrderLockState>(() => getOrderLockState())

  useEffect(() => {
    const refreshState = () => setState(getOrderLockState())
    refreshState()

    const intervalId = window.setInterval(refreshState, 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  return state
}
