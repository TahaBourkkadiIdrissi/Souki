import { useEffect, useState } from "react"
import { AppState } from "react-native"
import { orderHoursFromSchedule, parseOrderSchedule, type OrderHours, type OrderScheduleDTO } from "@souki/shared"

import { fetchOrderSchedule } from "@/lib/api"

/**
 * Horloge des commandes, comme apps/client/lib/order-schedule-client.ts : le serveur donne
 * l'etat et l'heure de bascule, l'appareil decompte (avec le decalage d'horloge mesure).
 * Sans reseau, l'appareil calcule seul ; l'API revalide de toute facon chaque commande.
 */
let snapshot: OrderScheduleDTO | null = null
let clockOffset = 0
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()

function currentOrderHours(): OrderHours {
  return orderHoursFromSchedule(snapshot, Date.now() + clockOffset)
}

function refreshOrderSchedule(): Promise<void> {
  if (pending) return pending
  const startedAt = Date.now()
  pending = fetchOrderSchedule()
    .then((value) => {
      const schedule = parseOrderSchedule(value)
      if (!schedule) return
      snapshot = schedule
      clockOffset = Date.parse(schedule.server_time) - (startedAt + Date.now()) / 2
      listeners.forEach((listener) => listener())
    })
    .catch(() => undefined)
    .finally(() => {
      pending = null
    })
  return pending
}

/**
 * Etat de la fenetre de commande, mis a jour chaque seconde. A n'utiliser que dans un petit
 * composant (compte a rebours) : l'ecran parent ne doit pas se redessiner chaque seconde.
 */
export function useOrderHours(): OrderHours {
  const [hours, setHours] = useState(currentOrderHours)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => {
      const next = currentOrderHours()
      setHours(next)
      if (next.hours === 0 && next.minutes === 0 && next.seconds === 0) void refreshOrderSchedule()
    }
    const start = () => {
      clearInterval(timer)
      void refreshOrderSchedule()
      tick()
      timer = setInterval(tick, 1000)
    }
    start()
    listeners.add(tick)
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start()
      else clearInterval(timer)
    })
    return () => {
      clearInterval(timer)
      listeners.delete(tick)
      subscription.remove()
    }
  }, [])

  return hours
}
