import { ScrollView, View } from "react-native"
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated"
import { Link } from "expo-router"
import { Carrot, ShoppingBasket, Sprout, Store, Truck, type LucideIcon } from "lucide-react-native"
import { formatDirhams, productName, type CatalogueProduct } from "@souki/shared"

import { LEVELS, type ProductLevel } from "@/components/level-tag"
import { PressableScale } from "@/components/pressable-scale"
import { PriceTag } from "@/components/price-tag"
import { ProductImage } from "@/components/product-image"
import { QuickAdd } from "@/components/quick-add"
import { Text } from "@/components/text"
import { useCartQuantity } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useProductHref } from "@/hooks/use-product-href"
import { DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { palette, radius, shadows } from "@/theme"

const LEVEL_ICONS: Record<ProductLevel, LucideIcon> = { 1: ShoppingBasket, 2: Carrot, 3: Sprout }
const MINI_WIDTH = 132

export type LevelGroup = { level: ProductLevel; products: CatalogueProduct[] }

type LevelSuggestionsProps = {
  groups: LevelGroup[]
  /** DH de produits qui manquent pour la livraison offerte. */
  remaining: number
  title: string
}

/**
 * L'etal a trois etageres (LevelSuggestions, design system 2027) : une etagere par niveau de
 * produit (1 souki-900, 2 orange-500, 3 yellow-400), mini-cartes a ajout rapide. Un produit
 * ajoute reste visible (contour vert, bulle de quantite) : l'ecran fige la liste tant qu'il
 * est affiche. Pastille « Offerte » quand un pas du produit suffit a la livraison offerte.
 */
export function LevelSuggestions({ groups, remaining, title }: LevelSuggestionsProps) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const visible = groups.filter((group) => group.products.length > 0)
  if (visible.length === 0) return null
  const [before, after] = t("Plus que {montant} pour la livraison offerte.", { montant: "\u0000" }).split("\u0000")

  return (
    <View style={{ paddingTop: 16, paddingBottom: 6, gap: 14, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 }}>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 18, lineHeight: 22 }}>
            {title}
          </Text>
          <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ marginTop: 3 }}>
            {remaining > 0 ? (
              <>
                {before}
                <Text variant="footnote" weight="black" numeric color={palette.market700}>
                  {t("{price} DH", { price: formatDirhams(remaining) })}
                </Text>
                {after}
              </>
            ) : (
              t("Livraison offerte : il ne manque rien.")
            )}
          </Text>
        </View>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: palette.pale50, alignItems: "center", justifyContent: "center" }}>
          <Store size={20} color={palette.souki900} strokeWidth={2.2} />
        </View>
      </View>

      {visible.map((group, index) => (
        <Animated.View
          key={group.level}
          entering={reducedMotion ? undefined : FadeInDown.duration(DUR_SLOW).delay(index * 40).easing(EASE_OUT_2027)}
        >
          <Shelf group={group} remaining={remaining} />
        </Animated.View>
      ))}
    </View>
  )
}

function Shelf({ group, remaining }: { group: LevelGroup; remaining: number }) {
  const { t, direction } = useLocale()
  const spec = LEVELS[group.level]
  const Icon = LEVEL_ICONS[group.level]
  return (
    <View style={{ gap: 10, paddingTop: 12, paddingBottom: 14, backgroundColor: spec.background }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
        <View style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: spec.color, alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color={spec.ink} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="callout" weight="heavy" color={palette.ink900}>
            {t(spec.title)}
          </Text>
          <Text variant="footnote" weight="semibold" color={palette.ink500} numberOfLines={1} style={{ fontSize: 11, lineHeight: 14 }}>
            {t(spec.subtitle)}
          </Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ direction }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
        {group.products.map((product) => (
          <MiniCard key={product.id} product={product} remaining={remaining} />
        ))}
      </ScrollView>
      {/* Bord de l'etagere */}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 6, height: 4, borderRadius: 2, backgroundColor: spec.color, opacity: 0.35 }} />
    </View>
  )
}

function MiniCard({ product, remaining }: { product: CatalogueProduct; remaining: number }) {
  const { t, locale } = useLocale()
  const quantity = useCartQuantity(product.id)
  const productHref = useProductHref()
  const inCart = quantity > 0
  const name = productName(product, locale)
  const reaches = remaining > 0 && product.price * product.quantityStep >= remaining

  return (
    <View
      style={{
        width: MINI_WIDTH,
        paddingTop: 5,
        paddingHorizontal: 5,
        paddingBottom: 10,
        gap: 4,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: palette.white,
        borderWidth: 2,
        borderColor: inCart ? palette.market600 : "transparent",
        boxShadow: "0 8px 18px -12px rgba(10, 40, 20, 0.35)",
      }}
    >
      <Link href={productHref(product)} asChild>
        <PressableScale accessibilityRole="button" accessibilityLabel={name} style={{ gap: 4 }}>
          <View style={{ borderRadius: 15, borderCurve: "continuous", overflow: "hidden" }}>
            <ProductImage uri={product.image} variant="inset" style={{ width: "100%", aspectRatio: 1 }} />
          </View>
          <View style={{ paddingHorizontal: 5, paddingTop: 2 }}>
            <PriceTag price={product.price} unit={product.displayUnit} size="compact" />
          </View>
          <Text variant="footnote" weight="bold" color={palette.ink900} numberOfLines={2} style={{ paddingHorizontal: 5, lineHeight: 16 }}>
            {name}
          </Text>
        </PressableScale>
      </Link>
      {reaches ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 10, start: 10, flexDirection: "row", alignItems: "center", gap: 3, minHeight: 20, paddingHorizontal: 7, borderRadius: 999, backgroundColor: palette.souki900 }}
        >
          <Truck size={12} color={palette.white} strokeWidth={2.6} />
          <Text variant="eyebrow" weight="heavy" color={palette.white} style={{ fontSize: 10, letterSpacing: 0, textTransform: "none" }}>
            {t("Offerte")}
          </Text>
        </View>
      ) : null}
      {/* Ajout rapide pose en bas de la photo */}
      <View pointerEvents="box-none" style={{ position: "absolute", top: 5, left: 5, right: 5, aspectRatio: 1, padding: 5, alignItems: "flex-start", justifyContent: "flex-end" }}>
        <QuickAdd product={product} expandedWidth={MINI_WIDTH - 20} />
      </View>
    </View>
  )
}
