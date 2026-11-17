import { View } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { Truck } from "lucide-react-native"
import { cartTotals, formatDirhams, FREE_DELIVERY_THRESHOLD_DH } from "@souki/shared"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { DUR_BASE } from "@/lib/motion"
import { m3, palette, radius, SCREEN_PADDING } from "@/theme"

/**
 * Jauge « livraison offerte » (fiche FreeDeliveryGauge) : phrase avec le montant qui manque,
 * camion, jauge linéaire `motion` sur `motion-track` (8 dp). Montants de `cartTotals()`
 * (@souki/shared), jamais d'un calcul local. TalkBack lit la phrase et la progression.
 */
export function FreeDeliveryGauge({ subtotal }: { subtotal: number }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const totals = cartTotals(subtotal)
  const reached = totals.missingForFreeDelivery <= 0
  const label = reached
    ? t("Livraison offerte")
    : t("Encore {montant} DH pour la livraison offerte", { montant: formatDirhams(totals.missingForFreeDelivery) })
  const percent = Math.round(totals.freeDeliveryProgress * 100)

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: FREE_DELIVERY_THRESHOLD_DH, now: Math.min(subtotal, FREE_DELIVERY_THRESHOLD_DH) }}
      style={{
        marginHorizontal: SCREEN_PADDING,
        padding: 16,
        gap: 12,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: m3.outlineVariant,
        backgroundColor: reached ? m3.secondaryContainer : palette.white,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text variant="titleSmall" color={reached ? m3.onSecondaryContainer : m3.onSurface} style={{ flex: 1 }}>
          {label}
        </Text>
        <Truck size={22} color={reached ? m3.onSecondaryContainer : m3.onSurface} strokeWidth={2} />
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: m3.motionTrack, overflow: "hidden", flexDirection: "row" }}>
        <Animated.View
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 4,
            backgroundColor: m3.motion,
            transitionProperty: reducedMotion ? undefined : "width",
            transitionDuration: DUR_BASE,
            transitionTimingFunction: "ease-out",
          }}
        />
      </View>
    </View>
  )
}
