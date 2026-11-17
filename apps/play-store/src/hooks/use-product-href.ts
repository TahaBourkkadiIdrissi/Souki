import { useCallback } from "react"
import { useSegments, type Href } from "expo-router"
import { productPath } from "@souki/shared"

const TAB_GROUPS = ["(marche)", "(produits)", "(panier)", "(compte)"] as const

/**
 * Lien vers la fiche d'un produit dans l'onglet courant : la fiche s'empile dans l'onglet
 * ou l'on se trouve (Marche, Panier ou Compte), sans changer d'onglet.
 */
export function useProductHref() {
  const segments = useSegments() as string[]
  const group = TAB_GROUPS.find((tab) => segments.includes(tab)) ?? "(marche)"
  return useCallback(
    (product: { id: number; name: string }) => `/(tabs)/${group}${productPath(product)}` as Href,
    [group],
  )
}
