import { View } from "react-native"
import type { ProductAvailability } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { m3, radius } from "@/theme"

/**
 * Pastille posée sur la photo (fiche ProductCard) : tonale, coins de 4 dp, label-small.
 * « Épuisé aujourd'hui » sur `error-container`, « En précommande » sur `warning-container`.
 * Rien quand le produit est en stock.
 */
export function AvailabilityBadge({ availability }: { availability: ProductAvailability }) {
  const { t } = useLocale()
  if (availability === "in_stock") return null
  const soldOut = availability === "out_of_stock"
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radius.xxs,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: soldOut ? m3.errorContainer : m3.warningContainer,
      }}
    >
      <Text variant="labelSmall" color={soldOut ? m3.onErrorContainer : m3.onWarningContainer} maxFontSizeMultiplier={1.5}>
        {soldOut ? t("Épuisé aujourd'hui") : t("En précommande")}
      </Text>
    </View>
  )
}
