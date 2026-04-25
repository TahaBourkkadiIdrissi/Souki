export interface DeliverySyncQueueItem {
  clientEventId: string
  commandeId: string
  targetStatus: "EN_ROUTE" | "LIVRE" | "ABSENT"
  deviceTimestamp: string
  expectedVersion: number
  createdAt: number
}

const DB_NAME = "souki-livreur-sync"
const STORE_NAME = "sync_queue"
const DB_VERSION = 1

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

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
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = handler(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Erreur IndexedDB."))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error("Transaction IndexedDB echouee."))
    }
  })
}

export async function enqueueDeliverySyncEvent(item: DeliverySyncQueueItem) {
  await runTransaction("readwrite", (store) => store.put(item))
}

export async function removeDeliverySyncEvent(clientEventId: string) {
  await runTransaction("readwrite", (store) => store.delete(clientEventId))
}

export async function getAllDeliverySyncEvents() {
  const events = await runTransaction<DeliverySyncQueueItem[]>("readonly", (store) => store.getAll())
  return [...events].sort((left, right) => left.createdAt - right.createdAt)
}
