import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

import { useAuth } from "@/contexts/auth-context"
import { addFavorite, fetchFavorites, removeFavorite } from "@/lib/api"
import { getAccessToken } from "@/lib/auth-token"
import { readJson, writeJson } from "@/lib/local-store"

/**
 * Favoris, comme apps/client/hooks/useFavorites.ts : gardes sur le telephone et, quand un
 * compte est connecte (phase 2), synchronises avec /api/user/favorites. Un ajout refuse
 * par le serveur est annule.
 */
const FAVORITES_KEY = "souki_favorites_guest_v1"

/** Comme le site : une liste pour l'invite, une par compte (pas de melange entre comptes). */
function favoritesKey(accountId: number | null) {
  return accountId === null ? FAVORITES_KEY : `souki_favorites_user_${accountId}_v1`
}

function readFavoriteIds(key: string) {
  return readJson<unknown[]>(key, []).filter((id): id is number => typeof id === "number")
}

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

  const { status, user } = useAuth()
  const accountId = status === "signedIn" && user ? user.id : null
  const storageKey = favoritesKey(accountId)
  /** Liste actuellement chargee : on n'ecrit jamais les favoris d'un compte sous la cle d'un autre. */
  const loadedKey = useRef(FAVORITES_KEY)

  useEffect(() => {
    if (loadedKey.current === storageKey) writeJson(storageKey, favoriteIds)
  }, [favoriteIds, storageKey])

  // A chaque connexion, deconnexion ou changement de compte (comme useFavorites.ts du site) :
  // liste gardee sur l'iPhone pour ce compte, puis celle du serveur si un compte est connecte.
  useEffect(() => {
    if (loadedKey.current !== storageKey) {
      loadedKey.current = storageKey
      setFavoriteIds(readFavoriteIds(storageKey))
    }
    if (accountId === null) return
    const controller = new AbortController()
    fetchFavorites(controller.signal)
      .then((products) => {
        if (!controller.signal.aborted) setFavoriteIds(products.map((product) => product.id))
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [accountId, storageKey])

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
