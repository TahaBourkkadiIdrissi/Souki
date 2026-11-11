import { View } from "react-native"
import type { ProductAvailability } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette } from "@/theme"

/** Pastille posee sur la photo, comme la PWA : « Rupture » en rouge, « Précommande » en orange. */
export function AvailabilityBadge({ availability }: { availability: ProductAvailability }) {
  const { t } = useLocale()
  if (availability === "in_stock") return null
  const soldOut = availability === "out_of_stock"
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: soldOut ? palette.red600 : palette.orange500,
      }}
    >
      {/* 2027 : l'orange porte de l'encre (5,4:1) ; le rouge garde le blanc (4,8:1). */}
      <Text variant="eyebrow" color={soldOut ? palette.white : palette.ink900}>
        {soldOut ? t("Rupture") : t("En précommande")}
      </Text>
    </View>
  )
}
