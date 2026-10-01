"use client"

import { useCallback, useSyncExternalStore, type SetStateAction } from "react"
import { useAuth } from "@/hooks/useAuth"
import { emptyClientCollection, readClientCollection, writeClientCollection, subscribeClientStorage } from "@/lib/client-storage"

export function useClientStorageOwner() {
  const { user, isLoading, isAuthenticated } = useAuth()
  return isLoading ? undefined : isAuthenticated ? user?.id : user ? undefined : null
}

export function useClientCollection<T>(collection: string) {
  const owner = useClientStorageOwner()
  const getSnapshot = useCallback(() => readClientCollection<T>(collection, owner), [collection, owner])
  const value = useSyncExternalStore(subscribeClientStorage, getSnapshot, emptyClientCollection<T>)
  const setValue = useCallback((update: SetStateAction<T[]>) => {
    if (owner === undefined) return
    const current = readClientCollection<T>(collection, owner)
    writeClientCollection(collection, owner, typeof update === "function" ? update(current) : update)
  }, [collection, owner])
  return [value, setValue] as const
}
