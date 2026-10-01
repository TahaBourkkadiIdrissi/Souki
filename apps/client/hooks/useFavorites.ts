"use client"

import { useCallback, useEffect } from "react"
import { addFavorite, apiCall, removeFavorite, type CatalogueProductDTO } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import { useClientCollection, useClientStorageOwner } from "@/hooks/useClientCollection"
import { readClientCollection } from "@/lib/client-storage"

/** Server-backed favorites; guest and each account have separate local caches. */
export function useFavorites() {
  const { token } = useAuth()
  const owner = useClientStorageOwner()
  const [favorites, setFavorites] = useClientCollection<number>("favorites")

  useEffect(() => {
    if (!token || typeof owner !== "number") return
    const controller = new AbortController()
    void apiCall<CatalogueProductDTO[]>("/api/user/favorites", { token, signal: controller.signal })
      .then((products) => {
        if (!controller.signal.aborted) setFavorites(products.map((product) => product.id))
      })
      .catch(() => { /* Retain only this account's cache when offline. */ })
    return () => controller.abort()
  }, [token, owner, setFavorites])

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites])
  const toggleFavorite = useCallback((id: number) => {
    if (owner === undefined) return false
    const current = readClientCollection<number>("favorites", owner)
    const willAdd = !current.includes(id)
    setFavorites(willAdd ? [...current, id] : current.filter((value) => value !== id))
    if (token && typeof owner === "number") {
      const request = willAdd ? addFavorite(id, token) : removeFavorite(id, token)
      request.catch(() => {
        // This setter captures the originating account, even after switching users.
        setFavorites((latest) => willAdd
          ? latest.filter((value) => value !== id)
          : Array.from(new Set([...latest, id])))
      })
    }
    return willAdd
  }, [token, owner, setFavorites])

  return { favorites, isFavorite, toggleFavorite }
}
