export const MOROCCO_TIME_ZONE = "Africa/Casablanca"
export const ORDER_OPEN_HOUR = 8
export const ORDER_CLOSE_HOUR = 20
export const ORDER_CLOSED_MESSAGE = "Les commandes sont fermées pour préparer les livraisons. Réouverture à 08h00 (heure du Maroc). Votre commande n’a pas été enregistrée."

// Same transition as backend tzdata 2026.4; older mobile ICU databases still
// predict GMT+1 after this date. Keep their order window aligned with the API.
const GMT_SINCE = Date.parse("2026-09-20T01:00:00Z")

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: MOROCCO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
})

function localParts(date: Date) {
  if (date.getTime() >= GMT_SINCE) return {
    year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
    hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds(),
  }
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, Number(p.value)]))
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second }
}

export function getOrderHours(now = new Date()) {
  const p = localParts(now)
  const closed = p.hour < ORDER_OPEN_HOUR || p.hour >= ORDER_CLOSE_HOUR
  const hour = closed ? ORDER_OPEN_HOUR : ORDER_CLOSE_HOUR
  const wallTarget = Date.UTC(p.year, p.month - 1, p.day + (p.hour >= ORDER_CLOSE_HOUR ? 1 : 0), hour)
  // Convert the next Moroccan wall-clock boundary to an instant, including DST changes.
  let target = wallTarget
  for (let i = 0; i < 3; i++) {
    const t = localParts(new Date(target))
    const localAsUtc = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
    target += wallTarget - localAsUtc
  }
  const remaining = Math.max(0, Math.ceil((target - now.getTime()) / 1000))
  return { closed, nextTransition: target, hours: Math.floor(remaining / 3600), minutes: Math.floor(remaining % 3600 / 60), seconds: remaining % 60 }
}
