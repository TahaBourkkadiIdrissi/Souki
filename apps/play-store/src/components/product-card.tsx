import { memo } from "react"
import { Pressable, View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { useRouter } from "expo-router"
import { Plus } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, productName, type CatalogueProduct } from "@souki/shared"

import { showActionSheetWithOptions } from "@/components/action-sheet"
import { AvailabilityBadge } from "@/components/availability-badge"
import { PressableScale } from "@/components/pressable-scale"
import { PriceTag } from "@/components/price-tag"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { showSnackbar } from "@/components/snackbar"
import { Text } from "@/components/text"
import { useCartActions, useCartQuantity } from "@/contexts/cart-context"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useProductHref } from "@/hooks/use-product-href"
import { haptics } from "@/lib/haptics"
import { DUR_FAST } from "@/lib/motion"
import { shareProduct } from "@/lib/share"
import { m3, palette, radius, states, withAlpha } from "@/theme"

/**
 * Carte produit Android (fiche ProductCard du design system) :
 * - photo carrée sur `photo-bg`, bouton « + » carré posé dans son coin ;
 * - nom (title-small), darija latine et arabe, prix du jour en chiffres tabulaires ;
 * - dans le panier : contour `motion` de 2 dp et sélecteur rempli à la place du prix ;
 * - bordure de 1 dp, pas d'ombre au repos (élévation par la surface) ;
 * - appui long : menu (ajouter, favori, partager), avec le retour haptique LONG_PRESS.
 */
export const ProductCard = memo(function ProductCard({ product }: { product: CatalogueProduct }) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  // Abonnée à la seule quantité de ce produit : un ajout ailleurs ne redessine pas la carte.
  const quantity = useCartQuantity(product.id)
  const { add, setQuantity } = useCartActions()
  const { isFavorite, toggleFavorite } = useFavorites()
  const productHref = useProductHref()

  const name = productName(product, locale)
  const inCart = quantity > 0
  const soldOut = product.availability === "out_of_stock"
  const unit = formatPriceUnit(product.displayUnit, locale)
  const price = t("{price} DH", { price: formatDirhams(product.price) })
  // Darija : nom latin puis nom arabe en français ; nom latin en arabe (le nom affiché est déjà en arabe).
  const darija = locale === "ar" ? [product.alias, product.name].filter(Boolean).join(" · ") : [product.alias, product.nameAr].filter(Boolean).join(" · ")

  const addOne = () => {
    add(product)
    haptics.add()
  }

  const openMenu = () => {
    haptics.longPress()
    const favorite = isFavorite(product.id)
    const options = [soldOut ? null : t("Ajouter au panier"), favorite ? t("Retirer des favoris") : t("Ajouter aux favoris"), t("Partager"), t("Annuler")].filter(
      (option): option is string => option !== null,
    )
    showActionSheetWithOptions({ title: name, options, cancelButtonIndex: options.length - 1 }, (index) => {
      const choice = options[index]
      if (choice === t("Ajouter au panier")) addOne()
      else if (choice === t("Ajouter aux favoris") || choice === t("Retirer des favoris")) {
        toggleFavorite(product.id)
        showSnackbar({ message: favorite ? t("Retiré des favoris") : t("Ajouté aux favoris") })
      } else if (choice === t("Partager")) void shareProduct(product, name)
    })
  }

  return (
    <View
      style={{
        flex: 1,
        padding: 8,
        gap: 8,
        borderRadius: radius.photo,
        backgroundColor: palette.white,
        borderWidth: inCart ? 2 : 1,
        borderColor: inCart ? m3.motion : m3.outlineVariant,
        // Garde la même taille intérieure avec un contour de 1 ou 2 dp.
        margin: inCart ? 0 : 1,
      }}
    >
      <PressableScale
        onPress={() => router.push(productHref(product))}
        onLongPress={openMenu}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${price} / ${unit}${soldOut ? `, ${t("Rupture")}` : ""}`}
        accessibilityHint={t("Appui long pour plus d'actions")}
        style={{ gap: 8 }}
      >
        <View style={{ borderRadius: radius.control, overflow: "hidden" }}>
          <ProductImage uri={product.image} variant="inset" style={{ width: "100%", aspectRatio: 1, opacity: soldOut ? states.disabledContent : 1 }} />
          <View pointerEvents="none" style={{ position: "absolute", top: 8, start: 8 }}>
            <AvailabilityBadge availability={product.availability} />
          </View>
        </View>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text variant="titleSmall" color={m3.onSurface} numberOfLines={2}>
            {name}
          </Text>
          {darija ? (
            <Text variant="bodySmall" color={m3.onSurfaceVariant} numberOfLines={1}>
              {darija}
            </Text>
          ) : null}
        </View>
      </PressableScale>

      {inCart ? (
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(DUR_FAST)}>
          <QuantityStepper size="card" quantity={quantity} step={product.quantityStep} unit={product.displayUnit} onChange={(next) => setQuantity(product.id, next)} />
        </Animated.View>
      ) : (
        <View style={{ paddingHorizontal: 4, minHeight: 28, justifyContent: "center" }}>
          <PriceTag price={product.price} unit={product.displayUnit} soldOut={soldOut} />
        </View>
      )}

      {soldOut || inCart ? null : (
        <View pointerEvents="box-none" style={{ position: "absolute", top: 16, end: 16 }}>
          <Pressable
            onPress={addOne}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("Ajouter {name}", { name })}
            android_ripple={{ color: withAlpha(m3.primary, states.pressed + 0.06), borderless: false }}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.control,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.white,
              borderWidth: 1,
              borderColor: m3.outlineVariant,
            }}
          >
            <Plus size={22} color={m3.primary} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </View>
  )
})
