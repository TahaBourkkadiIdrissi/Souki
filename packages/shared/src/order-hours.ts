import { MOROCCO_TIME_ZONE, ORDER_CLOSE_HOUR, ORDER_OPEN_HOUR } from "./rules"
import type { OrderScheduleDTO } from "./types"

/**
 * Fenetre de commande (08h00 -> 01h00, heure du Maroc) calculee sur l'appareil, comme
 * apps/client/lib/order-hours.ts. Le serveur reste l'autorite : `orderHoursFromSchedule`
 * reprend sa reponse (GET /api/order-schedule) des qu'elle est disponible.
 */
export interface OrderHours {
  closed: boolean
  /** Date de livraison (AAAA-MM-JJ) si l'on commande maintenant ; null quand c'est ferme. */
  deliveryDate: string | null
  /** Instant (ms) de la prochaine ouverture ou fermeture. */
  nextTransition: number
  hours: number
  minutes: number
  seconds: number
}

// Le Maroc reste a GMT depuis le 20/09/2026 (tzdata 2026.4, comme le back-end) ;
// les anciennes bases ICU des telephones prevoient encore GMT+1 apres cette date.
const GMT_SINCE = Date.parse("2026-09-20T01:00:00Z")

let formatter: Intl.DateTimeFormat | null = null

function localParts(date: Date) {
  if (date.getTime() >= GMT_SINCE) {
    return {
      year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
      hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
    }
  }
  formatter ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: MOROCCO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, Number(part.value)]))
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second }
}

function withCountdown(closed: boolean, deliveryDate: string | null, nextTransition: number, now: number): OrderHours {
  const remaining = Math.max(0, Math.ceil((nextTransition - now) / 1000))
  return {
    closed,
    deliveryDate,
    nextTransition,
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
  }
}

export function getOrderHours(now = new Date()): OrderHours {
  const p = localParts(now)
  const closed = p.hour >= ORDER_CLOSE_HOUR && p.hour < ORDER_OPEN_HOUR
  const hour = closed ? ORDER_OPEN_HOUR : ORDER_CLOSE_HOUR
  const deliveryDay = p.day + (p.hour >= ORDER_OPEN_HOUR ? 1 : 0)
  const deliveryDate = closed ? null : new Date(Date.UTC(p.year, p.month - 1, deliveryDay)).toISOString().slice(0, 10)
  const wallTarget = Date.UTC(p.year, p.month - 1, closed ? p.day : deliveryDay, hour)
  // Convertit la prochaine heure murale marocaine en instant, changements d'heure compris.
  let target = wallTarget
  for (let i = 0; i < 3; i++) {
    const t = localParts(new Date(target))
    target += wallTarget - Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  }
  return withCountdown(closed, deliveryDate, target, now.getTime())
}

/** Reponse du serveur valide (forme attendue) ; sinon null et l'appareil calcule seul. */
export function parseOrderSchedule(value: unknown): OrderScheduleDTO | null {
  const schedule = value as Partial<OrderScheduleDTO> | null
  if (!schedule || typeof schedule.closed !== "boolean") return null
  if (!(schedule.delivery_date === null || /^\d{4}-\d{2}-\d{2}$/.test(schedule.delivery_date ?? ""))) return null
  if (!Number.isFinite(Date.parse(schedule.server_time ?? "")) || !Number.isFinite(Date.parse(schedule.next_transition ?? ""))) return null
  return schedule as OrderScheduleDTO
}

/** `now` est l'heure du serveur estimee (horloge locale + decalage mesure). */
export function orderHoursFromSchedule(schedule: OrderScheduleDTO | null, now: number): OrderHours {
  const nextTransition = schedule ? Date.parse(schedule.next_transition) : Number.NaN
  if (!schedule || !(now < nextTransition)) return getOrderHours(new Date(now))
  return withCountdown(schedule.closed, schedule.delivery_date, nextTransition, now)
}

/** "jeudi 5 novembre" / "الخميس 5 نوفمبر" ; null si la date manque. */
export function formatDeliveryDate(value: string | null | undefined, dateLocale: string): string | null {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat(dateLocale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })
      .format(new Date(`${value}T12:00:00Z`))
  } catch {
    return value
  }
}

/** "03:12:45" pour un compte a rebours. */
export function formatCountdown(hours: Pick<OrderHours, "hours" | "minutes" | "seconds">): string {
  return [hours.hours, hours.minutes, hours.seconds].map((part) => String(part).padStart(2, "0")).join(":")
}
