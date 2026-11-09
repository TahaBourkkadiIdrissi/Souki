import { ScrollView, View } from "react-native"
import { LinearGradient } from "expo-linear-gradient"
import { ShoppingBasket } from "lucide-react-native"
import { sectionName, type CatalogueProduct, type CatalogueSection } from "@souki/shared"

import { PressableScale } from "@/components/pressable-scale"
import { ProductImage } from "@/components/product-image"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { categoryIcon } from "@/lib/category-icons"
import { palette, SCREEN_PADDING } from "@/theme"

/**
 * Degrades des tuiles (design system 2027, CategoryTile) : icone blanche sur souki, market
 * et trust ; souki-900 sur herb ; ink-900 sur orange et yellow. Les rayons admin recoivent
 * les degrades dans l'ordre.
 */
type TileGradient = { from: string; to: string; icon: string }
const ALL_MARKET: TileGradient = { from: palette.souki900, to: palette.tileSoukiTo, icon: palette.white }
const TILE_GRADIENTS: TileGradient[] = [
  { from: palette.market600, to: palette.fresh500, icon: palette.white },
  { from: palette.orange500, to: palette.tileOrangeTo, icon: palette.ink900 },
  { from: palette.tileHerbFrom, to: palette.tileHerbTo, icon: palette.souki900 },
  { from: palette.yellow400, to: palette.tileYellowTo, icon: palette.ink900 },
  { from: palette.trust700, to: palette.tileTrustTo, icon: palette.white },
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
 * Rail de rayons (CategoryTile, design system 2027) : tuiles degradees facon icone d'app,
 * icone Lucide ou photo du produit phare choisi dans l'admin ; la tuile active porte un
 * anneau market-600 et un libelle souki-900.
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
          style={{ width: 84, alignItems: "center", gap: 8 }}
        >
          {/* Anneau 3 pt market-600 decale de 3 pt autour de la tuile active (transparent sinon). */}
          <View style={{ padding: 3, borderRadius: 28, borderCurve: "continuous", borderWidth: 3, borderColor: active ? palette.market600 : "transparent" }}>
          <View style={{ borderRadius: 22, borderCurve: "continuous", boxShadow: `0 14px 26px -12px ${gradient.from}A6` }}>
            <LinearGradient
              colors={[gradient.from, gradient.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.5)",
              }}
            >
              {image ? (
                <ProductImage uri={image} style={{ width: 72, height: 72 }} />
              ) : (
                <Icon size={32} color={gradient.icon} strokeWidth={2.2} />
              )}
              {/* Reflet en haut, comme une vraie icone d'app */}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255, 255, 255, 0.4)", "rgba(255, 255, 255, 0)"]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 36 }}
              />
            </LinearGradient>
          </View>
          </View>
          <Text
            variant="footnote"
            weight={active ? "black" : "bold"}
            color={active ? palette.souki900 : palette.ink700}
            align="center"
            numberOfLines={2}
            style={{ fontSize: 12, lineHeight: 15 }}
          >
            {label}
          </Text>
        </PressableScale>
        )
      })}
    </ScrollView>
  )
}
