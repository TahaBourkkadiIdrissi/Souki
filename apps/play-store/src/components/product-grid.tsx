import { View } from "react-native"
import type { CatalogueProduct } from "@souki/shared"

import { ProductCard } from "@/components/product-card"
import { SCREEN_PADDING } from "@/theme"

export const GRID_GAP = 12

/**
 * Grille de 2 colonnes pour une petite liste dans un ScrollView (accueil, resultats).
 * Le catalogue complet utilise une FlatList virtualisee avec les memes cartes.
 */
export function ProductGrid({ products }: { products: CatalogueProduct[] }) {
  const rows: CatalogueProduct[][] = []
  for (let index = 0; index < products.length; index += 2) rows.push(products.slice(index, index + 2))
  return (
    <View style={{ paddingHorizontal: SCREEN_PADDING, gap: GRID_GAP }}>
      {rows.map((row) => (
        <View key={row.map((product) => product.id).join("-")} style={{ flexDirection: "row", gap: GRID_GAP }}>
          {row.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  )
}
