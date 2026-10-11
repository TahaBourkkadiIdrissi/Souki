/** undefined = session unresolved; null = guest. Never infer an owner from old caches. */
export type StorageOwner = number | null | undefined

export const CLIENT_STORAGE_EVENT = "souki:client-storage-updated"
const EMPTY: never[] = []
const snapshots = new Map<string, { raw: string | null; value: unknown[]; memoryOnly?: boolean }>()

export function clientStorageKey(collection: string, owner: StorageOwner) {
  if (owner === undefined) return null
  if (owner !== null && (!Number.isSafeInteger(owner) || owner <= 0)) return null
  return `souki:v2:${owner === null ? "guest" : `user:${owner}`}:${collection}`
}

export function readClientCollection<T>(collection: string, owner: StorageOwner): T[] {
  const key = clientStorageKey(collection, owner)
  if (!key || typeof window === "undefined") return EMPTY as T[]
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    return (snapshots.get(key)?.value ?? EMPTY) as T[]
  }
  const previous = snapshots.get(key)
  if (previous?.memoryOnly) return previous.value as T[]
  if (previous?.raw === raw) return previous.value as T[]
  let value: T[] = []
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (Array.isArray(parsed)) value = parsed
  } catch { /* A corrupt cache must not prevent opening the app. */ }
  snapshots.set(key, { raw, value })
  return value
}

export function writeClientCollection<T>(collection: string, owner: StorageOwner, value: T[]) {
  const key = clientStorageKey(collection, owner)
  if (!key || typeof window === "undefined") return
  const raw = JSON.stringify(value)
  let memoryOnly = false
  try { window.localStorage.setItem(key, raw) } catch { memoryOnly = true }
  snapshots.set(key, { raw, value, memoryOnly })
  window.dispatchEvent(new Event(CLIENT_STORAGE_EVENT))
}

export function subscribeClientStorage(listener: () => void) {
  window.addEventListener(CLIENT_STORAGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(CLIENT_STORAGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

export function emptyClientCollection<T>(): T[] { return EMPTY as T[] }

/** Import only anonymous cart items, once, before exposing the authenticated session. */
export async function adoptGuestCart(owner: number) {
  if (!Number.isSafeInteger(owner) || owner <= 0 || typeof window === "undefined") return
  const transfer = () => {
    type Item = { id: number; quantity: number; [key: string]: unknown }
    const guest = readClientCollection<Item>("cart", null)
    if (!guest.length) return
    const merged = [...readClientCollection<Item>("cart", owner)]
    for (const item of guest) {
      if (!Number.isSafeInteger(item.id) || !Number.isFinite(item.quantity) || item.quantity <= 0) continue
      const index = merged.findIndex(current => current.id === item.id)
      if (index < 0) merged.push(item)
      else merged[index] = { ...merged[index], quantity: Math.round((merged[index].quantity + item.quantity) * 1000) / 1000 }
    }
    // No await between these writes. The browser lock serializes simultaneous tab logins.
    writeClientCollection("cart", owner, merged)
    writeClientCollection("cart", null, [])
  }
  if (navigator.locks) await navigator.locks.request("souki-guest-cart-transfer", transfer)
  else transfer()
}
