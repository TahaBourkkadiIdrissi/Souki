import { Platform, Pressable, View } from "react-native"
import Animated, { FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated"
import { useRouter } from "expo-router"
import { ChevronLeft, ChevronRight, ShoppingBasket } from "lucide-react-native"
import { formatDirhams } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCartSummary } from "@/hooks/use-cart-summary"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, DUR_FAST, EASE_EMPHASIZED_DECELERATE } from "@/lib/motion"
import { m3, radius, shadows, sizes, states, withAlpha } from "@/theme"

/**
 * Contenu de la mini-barre panier (fiche NavigationBar > CartBar) : nombre de produits dans un
 * carré `on-primary`, « Voir le panier », total qui roule (gauche à droite même en arabe).
 */
export function CartBar() {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const { count } = useCart()
  const { lines, totals } = useCartSummary()
  const Chevron = isRtl ? ChevronLeft : ChevronRight
  const totalLabel = t("{price} DH", { price: formatDirhams(totals.total) })

  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        router.navigate("/panier")
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t("Voir le panier")}, ${t(lines.length === 1 ? "{n} produit" : "{n} produits", { n: lines.length })}, ${totalLabel}`}
      android_ripple={{ color: withAlpha(m3.onPrimary, states.pressed + 0.06) }}
      style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingStart: 8, paddingEnd: 12 }}
    >
      <View style={{ minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: radius.control, backgroundColor: m3.onPrimary, alignItems: "center", justifyContent: "center" }}>
        {count > 0 ? (
          <Text variant="titleMedium" weight="bold" numeric color={m3.primary} maxFontSizeMultiplier={1.3}>
            {count > 99 ? "99+" : String(count)}
          </Text>
        ) : (
          <ShoppingBasket size={20} color={m3.primary} strokeWidth={2.2} />
        )}
      </View>
      <Text variant="labelLarge" color={m3.onPrimary} numberOfLines={1} style={{ flex: 1 }} maxFontSizeMultiplier={1.4}>
        {t("Voir le panier")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, direction: "ltr" }}>
        <AnimatedDigits value={formatDirhams(totals.total)} variant="priceCard" color={m3.onPrimary} />
        <Text variant="priceUnit" color={m3.onPrimary} maxFontSizeMultiplier={1.4}>
          DH
        </Text>
      </View>
      <Chevron size={20} color={m3.onPrimary} strokeWidth={2.2} />
    </Pressable>
  )
}

/** Accessoire natif de la barre d'onglets (iOS 26) : jamais sur Android. */
export const NATIVE_CART_ACCESSORY = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26

/**
 * Mini-barre panier posée 8 dp au-dessus de la barre de navigation, à 16 dp des bords :
 * `primary`, coins 20 dp, ombre `shadow-float` (seul élément flottant avec le FAB).
 * Entrée : montée de 16 dp et fondu (emphasized decelerate).
 */
export function FloatingCartBar() {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_EMPHASIZED_DECELERATE).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] })}
      exiting={reducedMotion ? undefined : FadeOut.duration(DUR_FAST)}
      style={{ marginHorizontal: 16, marginBottom: 8, minHeight: sizes.cartBar, borderRadius: radius.card, boxShadow: shadows.float }}
    >
      <View style={{ flex: 1, flexDirection: "row", borderRadius: radius.card, overflow: "hidden", backgroundColor: m3.primary }}>
        <CartBar />
      </View>
    </Animated.View>
  )
}
