"use client"

import { useCallback, useEffect, useState } from "react"

import { addFavorite, apiCall, removeFavorite } from "@/lib/api"
import type { CatalogueProductDTO } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"

/**
 * Favoris produits.
 *
 * - Utilisateur connecté : la **source de vérité est le serveur**
 *   (`/api/user/favorites`, cross-device). localStorage sert de cache optimiste
 *   / offline. Chaque toggle est optimiste et confirmé par un appel API ;
 *   en cas d'échec, on revient en arrière.
 * - Invité (sans token) : localStorage uniquement.
 *
 * Le contrat (`favorites`, `isFavorite`, `toggleFavorite`) est inchangé, donc
 * la fiche détail et le catalogue continuent de fonctionner sans modification.
 */
const STORAGE_KEY = "souki_favorites"
const EVENT_NAME = "souki:favorites-updated"

function readFavorites(): number[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "number") : []
  } catch {
    return []
  }
}

function writeFavorites(ids: number[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export function useFavorites() {
  const { token } = useAuth()
  const [favorites, setFavorites] = useState<number[]>([])

  // Synchronisation entre instances du hook (même onglet + autres onglets).
  useEffect(() => {
    setFavorites(readFavorites())
    const sync = () => setFavorites(readFavorites())
    window.addEventListener(EVENT_NAME, sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener(EVENT_NAME, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  // Chargement serveur quand connecté : le serveur fait foi. On n'écrase le cache
  // local QUE si l'appel réussit (un échec réseau ne doit pas vider les favoris).
  useEffect(() => {
    if (!token) return
    let isMounted = true
    void (async () => {
      try {
        const products = await apiCall<CatalogueProductDTO[]>("/api/user/favorites", { token })
        if (!isMounted) return
        const ids = products.map((product) => product.id)
        writeFavorites(ids)
        setFavorites(ids)
      } catch {
        // hors-ligne / session : on garde le cache local
      }
    })()
    return () => {
      isMounted = false
    }
  }, [token])

  const isFavorite = useCallback((id: number) => favorites.includes(id), [favorites])

  const toggleFavorite = useCallback(
    (id: number) => {
      const current = readFavorites()
      const willAdd = !current.includes(id)
      const next = willAdd ? [...current, id] : current.filter((value) => value !== id)

      // Optimiste : maj immédiate du cache + de l'état.
      writeFavorites(next)
      setFavorites(next)

      if (token) {
        const request = willAdd ? addFavorite(id, token) : removeFavorite(id, token)
        request.catch(() => {
          // Rollback en cas d'échec serveur.
          const rolledBack = willAdd
            ? readFavorites().filter((value) => value !== id)
            : [...readFavorites(), id]
          writeFavorites(rolledBack)
          setFavorites(rolledBack)
        })
      }

      return willAdd
    },
    [token],
  )

  return { favorites, isFavorite, toggleFavorite }
}
