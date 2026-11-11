import { memo } from "react"
import { Pressable, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated"
import { Link } from "expo-router"
import { Heart } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, productName, type CatalogueProduct } from "@souki/shared"

import { AvailabilityBadge } from "@/components/availability-badge"
import { PressableScale } from "@/components/pressable-scale"
import { PriceTag } from "@/components/price-tag"
import { ProductImage } from "@/components/product-image"
import { QuickAdd } from "@/components/quick-add"
import { Text } from "@/components/text"
import { useCartActions, useCartQuantity } from "@/contexts/cart-context"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useProductHref } from "@/hooks/use-product-href"
import { haptics } from "@/lib/haptics"
import { SPRING_POP } from "@/lib/motion"
import { shareProduct } from "@/lib/share"
import { palette, radius, shadows } from "@/theme"

/**
 * Carte produit SOUKI, au niveau des grandes apps de livraison :
 * - photo carree, « + » d'ajout rapide pose dessus (se deroule en selecteur) ;
 * - prix du jour en premier (c'est ce que l'on compare), puis le nom ;
 * - contour vert quand le produit est dans le panier, coeur qui rebondit ;
 * - toucher : la photo « zoome » vers la fiche (iOS 18+) ; appui long : apercu + menu.
 */
export const ProductCard = memo(function ProductCard({ product }: { product: CatalogueProduct }) {
  const { t, locale } = useLocale()
  // Abonne a la seule quantite de ce produit : un ajout ailleurs ne redessine pas la carte.
  const quantity = useCartQuantity(product.id)
  const { add } = useCartActions()
  const { isFavorite, toggleFavorite } = useFavorites()
  const productHref = useProductHref()
  const heartScale = useSharedValue(1)
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.get() }] }))

  const name = productName(product, locale)
  const inCart = quantity > 0
  const favorite = isFavorite(product.id)
  const soldOut = product.availability === "out_of_stock"
  const unit = formatPriceUnit(product.displayUnit, locale)
  const price = t("{price} DH", { price: formatDirhams(product.price) })

  const toggle = () => {
    toggleFavorite(product.id)
    haptics.selection()
    heartScale.set(withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, SPRING_POP)))
  }

  return (
    <Animated.View
      style={{
        flex: 1,
        paddingTop: 6,
        paddingHorizontal: 6,
        paddingBottom: 12,
        borderRadius: radius.card,
        borderCurve: "continuous",
        backgroundColor: palette.white,
        borderWidth: 2,
        // Contour « dans le panier » = couleur du mouvement (market-600).
        borderColor: inCart ? palette.market600 : "transparent",
        boxShadow: shadows.card,
        transitionProperty: "borderColor",
        transitionDuration: 200,
      }}
    >
      <Link href={productHref(product)} asChild>
        <Link.Trigger>
          <PressableScale accessibilityRole="button" accessibilityLabel={`${name}, ${price} / ${unit}`} style={{ gap: 8 }}>
            <View style={{ borderRadius: radius.photo, borderCurve: "continuous", overflow: "hidden" }}>
              <Link.AppleZoom>
                <ProductImage uri={product.image} variant="inset" style={{ width: "100%", aspectRatio: 1, opacity: soldOut ? 0.45 : 1 }} />
              </Link.AppleZoom>
              <View pointerEvents="none" style={{ position: "absolute", top: 8, start: 8 }}>
                <AvailabilityBadge availability={product.availability} />
              </View>
            </View>
            {/* Le prix du jour passe AVANT le nom ; la darija latine en dessous (francais seulement). */}
            <View style={{ paddingHorizontal: 6, gap: 2 }}>
              <PriceTag price={product.price} unit={product.displayUnit} soldOut={soldOut} />
              <Text
                variant="callout"
                weight={locale === "ar" ? "heavy" : "bold"}
                color={palette.ink900}
                numberOfLines={2}
                style={locale === "ar" ? { fontSize: 17 } : undefined}
              >
                {name}
              </Text>
              {locale === "fr" && product.alias ? (
                <Text variant="footnote" color={palette.ink500} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
                  {product.alias}
                </Text>
              ) : null}
            </View>
          </PressableScale>
        </Link.Trigger>
        <Link.Preview />
        <Link.Menu>
          <Link.MenuAction
            title={t("Ajouter au panier")}
            icon="cart.badge.plus"
            disabled={soldOut}
            onPress={() => {
              add(product)
              haptics.add()
            }}
          />
          <Link.MenuAction title={favorite ? t("Retirer des favoris") : t("Ajouter aux favoris")} icon={favorite ? "heart.slash" : "heart"} onPress={toggle} />
          <Link.MenuAction title={t("Partager")} icon="square.and.arrow.up" onPress={() => shareProduct(product, name)} />
        </Link.Menu>
      </Link>

      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={favorite ? t("Retirer des favoris") : t("Ajouter aux favoris")}
        accessibilityState={{ selected: favorite }}
        // Zone de toucher 44 pt, pastille visible de 34 pt.
        style={{ position: "absolute", top: 6, end: 6, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Animated.View
          style={[
            { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.86)" },
            heartStyle,
          ]}
        >
          <Heart size={18} color={favorite ? palette.pink500 : palette.ink500} fill={favorite ? palette.pink500 : "transparent"} strokeWidth={2.4} />
        </Animated.View>
      </Pressable>

      {soldOut ? null : (
        // Calque carre pose sur la photo : l'ajout rapide se place dans son coin bas.
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", top: 6, left: 6, right: 6, aspectRatio: 1, padding: 8, alignItems: "flex-end", justifyContent: "flex-end" }}
        >
          <QuickAdd product={product} />
        </View>
      )}
    </Animated.View>
  )
})
