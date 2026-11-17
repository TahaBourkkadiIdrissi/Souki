import { ScrollView, View } from "react-native"
import type { CatalogueProduct } from "@souki/shared"

import { ProductCard } from "@/components/product-card"
import { useLocale } from "@/contexts/locale-context"
import { SCREEN_PADDING } from "@/theme"

/** Carrousel horizontal de cartes de 158 pt (design system 2027), aimante carte par carte. */
const CARD_WIDTH = 158
export function ProductRail({ products }: { products: CatalogueProduct[] }) {
  const { direction } = useLocale()
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + 12}
      snapToAlignment="start"
      style={{ direction }}
      contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 4, paddingBottom: 14, gap: 12 }}
    >
      {products.map((product) => (
        <View key={product.id} style={{ width: CARD_WIDTH }}>
          <ProductCard product={product} />
        </View>
      ))}
    </ScrollView>
  )
}
