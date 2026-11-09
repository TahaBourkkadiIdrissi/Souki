import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-token"
import { readJson, writeJson } from "@/lib/local-store"

/**
 * Favoris, comme apps/client/hooks/useFavorites.ts : gardes sur le telephone et, quand un
 * compte est connecte (phase 2), synchronises avec /api/user/favorites. Un ajout refuse
 * par le serveur est annule.
 */
const FAVORITES_KEY = "souki_favorites_guest_v1"

type FavoritesContextValue = {
  favoriteIds: number[]
  isFavorite: (productId: number) => boolean
  /** Renvoie true si le produit vient d'etre ajoute. */
  toggleFavorite: (productId: number) => boolean
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() =>
    readJson<unknown[]>(FAVORITES_KEY, []).filter((id): id is number => typeof id === "number"),
  )

  useEffect(() => {
    writeJson(FAVORITES_KEY, favoriteIds)
  }, [favoriteIds])

  useEffect(() => {
    const controller = new AbortController()
    getAccessToken().then((token) => {
      if (!token) return
      fetchFavorites(controller.signal)
        .then((products) => setFavoriteIds(products.map((product) => product.id)))
        .catch(() => undefined)
    })
    return () => controller.abort()
  }, [])

  const isFavorite = useCallback((productId: number) => favoriteIds.includes(productId), [favoriteIds])

  const toggleFavorite = useCallback(
    (productId: number) => {
      const willAdd = !favoriteIds.includes(productId)
      setFavoriteIds((current) => (willAdd ? [...current, productId] : current.filter((id) => id !== productId)))
      getAccessToken().then((token) => {
        if (!token) return
        const request = willAdd ? addFavorite(productId) : removeFavorite(productId)
        request.catch(() =>
          setFavoriteIds((current) =>
            willAdd ? current.filter((id) => id !== productId) : Array.from(new Set([...current, productId])),
          ),
        )
      })
      return willAdd
    },
    [favoriteIds],
  )

  const value = useMemo(() => ({ favoriteIds, isFavorite, toggleFavorite }), [favoriteIds, isFavorite, toggleFavorite])
  return <FavoritesContext value={value}>{children}</FavoritesContext>
}

export function useFavorites() {
  const value = use(FavoritesContext)
  if (!value) throw new Error("useFavorites doit etre utilise dans FavoritesProvider")
  return value
}
