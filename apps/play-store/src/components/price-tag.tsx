import { View } from "react-native"
import { formatDirhams, formatPriceUnit } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { m3 } from "@/theme"

type PriceTagProps = {
  price: number
  /** Unite d'affichage du produit (kg, lot, piece, 250g). */
  unit: string
  /** `card` (21 pt, carte produit), `compact` (16 pt, mini-cartes), `hero` (48 pt, fiche). */
  size?: "card" | "compact" | "hero"
  soldOut?: boolean
}

const NUMBER_SIZES = {
  card: { fontSize: 20, lineHeight: 24 },
  compact: { fontSize: 16, lineHeight: 20 },
  hero: { fontSize: 48, lineHeight: 52 },
} as const

/**
 * Le prix du jour comme voix (PriceTag, design system 2027) : chiffre en Poppins Black
 * tabulaire, puis « DH » en gras et l'unite en ink-500. Toujours en LTR, meme en arabe.
 */
export function PriceTag({ price, unit, size = "card", soldOut = false }: PriceTagProps) {
  const { t, locale } = useLocale()
  const unitLabel = formatPriceUnit(unit, locale)
  const amount = formatDirhams(price)
  const numberColor = soldOut ? m3.onSurfaceVariant : m3.secondary
  const unitSize = size === "hero" ? 14 : 12

  return (
    <View
      accessible
      accessibilityLabel={t("{price} DH / {unit}", { price: amount, unit: unitLabel })}
      style={{ flexDirection: "row", alignItems: "baseline", gap: size === "hero" ? 6 : 4, direction: "ltr", alignSelf: "flex-start" }}
    >
      <Text variant={size === "hero" ? "priceHero" : "priceCard"} color={numberColor} style={NUMBER_SIZES[size]}>
        {amount}
      </Text>
      <Text variant="priceUnit" color={numberColor} style={{ fontSize: unitSize }}>
        {`DH / ${unitLabel}`}
      </Text>
    </View>
  )
}
