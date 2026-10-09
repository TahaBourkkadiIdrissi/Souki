"use client"

import { getOrderHours } from "./order-hours"
import { getOrderSchedule, type OrderScheduleDTO } from "./api"

let snapshot: OrderScheduleDTO | null = null
let offset = 0
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()

export function getCurrentOrderHours() {
  const now = Date.now() + offset
  if (!snapshot || now >= Date.parse(snapshot.next_transition)) return getOrderHours(new Date(now))
  const nextTransition = Date.parse(snapshot.next_transition)
  const seconds = Math.max(0, Math.ceil((nextTransition - now) / 1000))
  return { closed: snapshot.closed, deliveryDate: snapshot.delivery_date, nextTransition,
    hours: Math.floor(seconds / 3600), minutes: Math.floor(seconds % 3600 / 60), seconds: seconds % 60 }
}

export function refreshOrderSchedule() {
  if (pending) return pending
  const started = Date.now()
  pending = getOrderSchedule()
    .then(value => {
      if (typeof value.closed !== "boolean" ||
          !(value.delivery_date === null || /^\d{4}-\d{2}-\d{2}$/.test(value.delivery_date)) ||
          !Number.isFinite(Date.parse(value.server_time)) || !Number.isFinite(Date.parse(value.next_transition))) return
      snapshot = value
      offset = Date.parse(value.server_time) - (started + Date.now()) / 2
      listeners.forEach(listener => listener())
    }).catch(() => { /* API still validates every write; keep the local clock offline. */ })
    .finally(() => { pending = null })
  return pending
}

export function subscribeOrderSchedule(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function millisecondsToOrderTransition() {
  return Math.max(1, getCurrentOrderHours().nextTransition - (Date.now() + offset) + 50)
}
