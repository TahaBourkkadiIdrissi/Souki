export interface DeliverySyncQueueItem {
  clientEventId: string
  commandeId: string
  targetStatus: "EN_ROUTE" | "LIVRE" | "ABSENT" | "REFUS"
  deviceTimestamp: string
  expectedVersion: number
  createdAt: number
}

const DB_NAME = "souki-livreur-sync"
const STORE_NAME = "sync_queue"
const DB_VERSION = 1

export function clearLegacyDeliverySyncStorage() {
  if (typeof window === "undefined") return
  window.indexedDB.deleteDatabase(DB_NAME)
}

function openDatabase(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Session livreur requise.")
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(`${DB_NAME}-${userId}`, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "clientEventId" })
        store.createIndex("createdAt", "createdAt", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir IndexedDB."))
  })
}

async function runTransaction<T>(
  userId: number,
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase(userId)

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = handler(store)

    request.onerror = () => reject(request.error ?? new Error("Erreur IndexedDB."))
    transaction.oncomplete = () => { database.close(); resolve(request.result) }
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("Transaction IndexedDB annulee.")) }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Transaction IndexedDB echouee."))
    }
  })
}

export async function enqueueDeliverySyncEvent(userId: number, item: DeliverySyncQueueItem) {
  await runTransaction(userId, "readwrite", (store) => store.put(item))
}

export async function removeDeliverySyncEvent(userId: number, clientEventId: string) {
  await runTransaction(userId, "readwrite", (store) => store.delete(clientEventId))
}

export async function getAllDeliverySyncEvents(userId: number) {
  const events = await runTransaction<DeliverySyncQueueItem[]>(userId, "readonly", (store) => store.getAll())
  return [...events].sort((left, right) => left.createdAt - right.createdAt)
}
