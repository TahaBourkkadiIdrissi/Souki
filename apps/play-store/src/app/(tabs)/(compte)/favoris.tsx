import { useMemo } from "react"
import { ScrollView } from "react-native"
import { useRouter } from "expo-router"

import { EmptyState } from "@/components/empty-state"
import { ProductGrid } from "@/components/product-grid"
import { useDockInset } from "@/components/tab-bar"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useCatalogue } from "@/hooks/use-catalogue"

/** Favoris : les produits du jour marques d'un coeur (appui long sur une carte, ou fiche produit). */
export default function FavorisScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const { favoriteIds } = useFavorites()
  const { productsById } = useCatalogue()
  const dockInset = useDockInset()

  const favorites = useMemo(
    () => favoriteIds.map((id) => productsById.get(id)).filter((product) => product !== undefined),
    [favoriteIds, productsById],
  )

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ direction }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: dockInset, flexGrow: 1 }}
    >
      {favorites.length > 0 ? (
        <ProductGrid products={favorites} />
      ) : (
        <EmptyState
          art="favorites"
          title={t("Aucun favori")}
          description={t("Touchez le cœur d'une fiche produit, ou faites un appui long sur un produit, pour le retrouver ici.")}
          action={{ label: t("Voir le marché"), onPress: () => router.navigate("/marche") }}
        />
      )}
    </ScrollView>
  )
}
