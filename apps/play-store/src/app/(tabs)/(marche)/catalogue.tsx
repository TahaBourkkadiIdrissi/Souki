import { Redirect, useLocalSearchParams } from "expo-router"

/**
 * Ancienne adresse du catalogue : il vit desormais dans l'onglet Produits
 * (src/screens/products-screen.tsx). Les liens existants y sont renvoyes avec leurs filtres.
 */
export default function CatalogueRedirect() {
  const params = useLocalSearchParams<{ rayon?: string; focus?: string }>()
  return <Redirect href={{ pathname: "/produits", params }} />
}
