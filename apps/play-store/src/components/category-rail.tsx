import { ScrollView, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { ShoppingBasket } from "lucide-react-native"
import { sectionName, type CatalogueProduct, type CatalogueSection } from "@souki/shared"

import { PressableScale } from "@/components/pressable-scale"
import { ProductImage } from "@/components/product-image"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { categoryIcon } from "@/lib/category-icons"
import { m3, radius, scene, SCREEN_PADDING } from "@/theme"

/**
 * Degrades des tuiles (design system 2027, CategoryTile) : icone blanche sur souki, market
 * et trust ; souki-900 sur herb ; ink-900 sur orange et yellow. Les rayons admin recoivent
 * les degrades dans l'ordre.
 */
type TileGradient = { from: string; to: string; icon: string }
const ALL_MARKET: TileGradient = { from: scene.souki900, to: scene.tileSoukiTo, icon: scene.white }
const TILE_GRADIENTS: TileGradient[] = [
  { from: scene.market600, to: scene.fresh500, icon: scene.white },
  { from: scene.orange500, to: scene.tileOrangeTo, icon: scene.ink900 },
  { from: scene.tileHerbFrom, to: scene.tileHerbTo, icon: scene.souki900 },
  { from: scene.yellow400, to: scene.tileYellowTo, icon: scene.ink900 },
  { from: scene.trust700, to: scene.tileTrustTo, icon: scene.white },
]
const LEGACY_GRADIENTS: Record<string, TileGradient> = {
  legumes: TILE_GRADIENTS[0],
  fruits: TILE_GRADIENTS[1],
  herbes: TILE_GRADIENTS[2],
}

type CategoryRailProps = {
  sections: CatalogueSection[]
  products: CatalogueProduct[]
  /** `null` = tout le marche. */
  onSelect: (section: CatalogueSection | null) => void
  /** Tuile mise en avant (anneau market-600) : `tous` ou le slug d'un rayon. */
  activeKey?: string
}

/**
 * Rail de rayons (tuiles de l'accueil) : tuiles en dégradé de 72 dp, coins de 16 dp, icône Lucide
 * ou photo du produit phare choisi dans l'admin, libellé label-medium ; contour `motion` sur la
 * tuile active. Les dégradés sont des couleurs de scène, identiques dans les deux thèmes.
 */
export function CategoryRail({ sections, products, onSelect, activeKey }: CategoryRailProps) {
  const { t, locale, direction } = useLocale()
  const visible = sections.filter((section) => products.some((product) => product.categories.includes(section.slug)))

  const tiles = [
    { key: "tous", label: t("Tout le marché"), gradient: ALL_MARKET, Icon: ShoppingBasket, image: undefined, section: null },
    ...visible.map((section, index) => ({
      key: section.slug,
      label: sectionName(section, locale),
      gradient: LEGACY_GRADIENTS[section.slug] ?? TILE_GRADIENTS[index % TILE_GRADIENTS.length],
      Icon: categoryIcon(section.icone, section.slug),
      image: products.find((product) => product.id === section.produitVedetteId)?.image,
      section,
    })),
  ]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ direction }}
      contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING - 4, paddingTop: 4, paddingBottom: 8, gap: 4 }}
    >
      {tiles.map(({ key, label, gradient, Icon, image, section }) => {
        const active = key === activeKey
        return (
        <PressableScale
          key={key}
          onPress={() => onSelect(section)}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: active }}
          style={{ width: 80, alignItems: "center", gap: 8 }}
        >
          <LinearGradient
            colors={[gradient.from, gradient.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.tile,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderWidth: active ? 2 : 0,
              borderColor: m3.motion,
            }}
          >
            {image ? <ProductImage uri={image} style={{ width: 72, height: 72 }} /> : <Icon size={30} color={gradient.icon} strokeWidth={2} />}
          </LinearGradient>
          <Text variant="labelMedium" color={active ? m3.onSurface : m3.onSurfaceVariant} align="center" numberOfLines={2}>
            {label}
          </Text>
        </PressableScale>
        )
      })}
    </ScrollView>
  )
}
