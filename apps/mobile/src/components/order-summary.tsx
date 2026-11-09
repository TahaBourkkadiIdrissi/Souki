import { useEffect, useRef } from "react"
import { View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { CircleAlert } from "lucide-react-native"
import { formatDirhams, PANIER_MINIMUM_DH, type CartTotals } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_BASE } from "@/lib/motion"
import { palette, radius, shadows } from "@/theme"

const MARK_MIN = "\u0001"
const MARK_MISSING = "\u0002"

/**
 * Recapitulatif du panier (OrderSummary, design system 2027) : sous-total, livraison
 * (« Offerte » en market-700 des 300 DH de produits), total qui roule. Sous le minimum
 * (50 DH livraison comprise), une alerte orange dit combien ajouter ; haptique d'avertissement
 * une seule fois quand elle apparait.
 */
export function OrderSummary({ totals }: { totals: CartTotals }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const below = !totals.meetsMinimum
  const warned = useRef(false)

  useEffect(() => {
    if (below && !warned.current) haptics.warning()
    warned.current = below
  }, [below])

  const dh = (amount: number) => t("{price} DH", { price: formatDirhams(amount) })

  return (
    <View
      accessibilityLabel={t("Récapitulatif")}
      style={{ padding: 18, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}
    >
      <Row label={t("Sous-total")} value={dh(totals.subtotal)} />
      <Row label={t("Livraison")} value={totals.deliveryFee === 0 ? t("Offerte") : dh(totals.deliveryFee)} free={totals.deliveryFee === 0} />
      <View style={{ height: 1, borderTopWidth: 1, borderStyle: "dashed", borderColor: palette.line, marginTop: 2 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <Text variant="headline" weight="black" color={palette.ink900}>
          {t("Total")}
        </Text>
        <AnimatedDigits value={dh(totals.total)} variant="title2" weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30, letterSpacing: -0.7 }} />
      </View>
      {below ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.duration(DUR_BASE)}
          accessibilityRole="alert"
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: palette.orange50 }}
        >
          <CircleAlert size={18} color={palette.orange700} strokeWidth={2.4} />
          <Text variant="footnote" weight="semibold" color={palette.orange700} style={{ flex: 1 }}>
            {/* Phrase traduite d'un bloc, puis decoupee autour des deux passages en gras. */}
            {t("{minimum}, livraison comprise. Ajoutez {manque} de produits.", { minimum: MARK_MIN, manque: MARK_MISSING })
              .split(/(\u0001|\u0002)/)
              .map((part, index) =>
                part === MARK_MIN ? (
                  <Text key={index} variant="footnote" weight="heavy" color={palette.ink900}>
                    {t("Minimum de commande : {min} DH", { min: PANIER_MINIMUM_DH })}
                  </Text>
                ) : part === MARK_MISSING ? (
                  <Text key={index} variant="footnote" weight="heavy" numeric color={palette.ink900}>
                    {dh(totals.missingForMinimum)}
                  </Text>
                ) : (
                  part
                ),
              )}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

function Row({ label, value, free = false }: { label: string; value: string; free?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <Text variant="body" color={palette.ink700} style={{ fontSize: 15, lineHeight: 22 }}>
        {label}
      </Text>
      <AnimatedDigits value={value} variant="callout" weight={free ? "black" : "heavy"} color={free ? palette.market700 : palette.ink900} />
    </View>
  )
}
