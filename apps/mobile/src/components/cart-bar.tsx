import { Platform, Pressable, View } from "react-native"
import Animated, { FadeInDown, FadeOut, useReducedMotion } from "react-native-reanimated"
import { useRouter } from "expo-router"
import { NativeTabs } from "expo-router/native-tabs"
import { ShoppingBasket, ChevronRight, ChevronLeft } from "lucide-react-native"
import { formatDirhams } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { useCartSummary } from "@/hooks/use-cart-summary"
import { DUR_BASE, EASE_OUT_2027 } from "@/lib/motion"
import { palette, shadows, sizes } from "@/theme"

/** Marqueur remplace par le montant en gras dans la phrase traduite. */
const SLOT = "\u0000"

/**
 * Mini-barre panier au-dessus des onglets, comme le mini-lecteur d'Apple Musique (CartBar,
 * design system 2027). Le verre vient de l'accessoire natif d'iOS 26. Grand format :
 * icone souki-900 et pastille orange a l'encre, « Plus que X DH → livraison offerte »,
 * jauge fine market-600 et total qui roule. Format reduit : icone et total.
 */
export function CartBar() {
  const router = useRouter()
  const { t } = useLocale()
  const { totals } = useCartSummary()
  const placement = NativeTabs.BottomAccessory.usePlacement()
  const totalLabel = t("{price} DH", { price: formatDirhams(totals.total) })
  const openCart = () => router.navigate("/panier")

  if (placement === "inline") {
    return (
      <Pressable onPress={openCart} accessibilityRole="button" accessibilityLabel={t("Voir le panier")} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 }}>
        <ShoppingBasket size={18} color={palette.souki900} strokeWidth={2.2} />
        <Text variant="callout" weight="black" numeric color={palette.souki900}>
          {totalLabel}
        </Text>
      </Pressable>
    )
  }

  return <CartBarContent />
}

/** Contenu grand format de la mini-barre (accessoire natif d'iOS 26 ou bulle dessinee). */
function CartBarContent() {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const { count } = useCart()
  const { lines, totals } = useCartSummary()
  const Chevron = isRtl ? ChevronLeft : ChevronRight
  const totalLabel = t("{price} DH", { price: formatDirhams(totals.total) })
  const openCart = () => router.navigate("/panier")

  const missing = totals.missingForFreeDelivery
  // Phrase traduite coupee autour du montant (ou du mot « Livraison offerte ») pour le mettre en gras.
  const [before, after] = (missing > 0
    ? t("Plus que {montant} → livraison offerte", { montant: SLOT })
    : t("{offerte} · prêt à valider", { offerte: SLOT })
  ).split(SLOT)
  const strong = missing > 0 ? t("{price} DH", { price: formatDirhams(missing) }) : t("Livraison offerte")

  return (
    <Pressable
      onPress={openCart}
      accessibilityRole="button"
      accessibilityLabel={`${t("Voir le panier")}, ${t(lines.length === 1 ? "{n} produit" : "{n} produits", { n: lines.length })}, ${totalLabel}`}
      style={({ pressed }) => ({ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, borderCurve: "continuous", backgroundColor: palette.souki900, alignItems: "center", justifyContent: "center" }}>
        <ShoppingBasket size={20} color={palette.white} strokeWidth={2.2} />
        {count > 0 ? (
          <View
            style={{
              position: "absolute",
              top: -5,
              end: -5,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              paddingHorizontal: 4,
              backgroundColor: palette.orange500,
              borderWidth: 2,
              borderColor: palette.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text variant="eyebrow" weight="black" numeric color={palette.ink900} style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0 }}>
              {count > 99 ? "99+" : String(count)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="footnote" weight="bold" color={palette.ink700} numberOfLines={1} style={{ fontSize: 12, lineHeight: 15 }}>
          {before}
          <Text variant="footnote" weight="black" numeric={missing > 0} color={palette.market700} style={{ fontSize: 12, lineHeight: 15 }}>
            {strong}
          </Text>
          {after}
        </Text>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.green100, overflow: "hidden" }}>
          <Animated.View
            style={{
              width: `${totals.freeDeliveryProgress * 100}%`,
              height: "100%",
              borderRadius: 2,
              // Jauge = couleur du mouvement (market-600).
              backgroundColor: palette.market600,
              transitionProperty: "width",
              transitionDuration: 240,
              transitionTimingFunction: "ease-out",
            }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, paddingEnd: 6, direction: "ltr" }}>
        <AnimatedDigits value={formatDirhams(totals.total)} variant="headline" weight="black" color={palette.souki900} />
        <Text variant="priceUnit" weight="black" color={palette.souki900} style={{ marginStart: 3 }}>
          DH
        </Text>
      </View>
      <Chevron size={18} color={palette.souki900} />
    </Pressable>
  )
}

/** L'accessoire natif de la barre d'onglets n'existe qu'a partir d'iOS 26. */
export const NATIVE_CART_ACCESSORY = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 26

/**
 * La mini-barre dessinee en bulle de verre (CartBar, design system 2027 : verre clair,
 * coins 22 pt, ombre `shadow-float`), posee dans le dock 8 pt au-dessus des onglets.
 * Entree : glisse de 16 pt et fondu en 240 ms.
 */
export function FloatingCartBar() {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_OUT_2027).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] })}
      exiting={reducedMotion ? undefined : FadeOut.duration(160)}
      style={{
        height: sizes.cartBar,
        borderRadius: 22,
        borderCurve: "continuous",
        boxShadow: shadows.float,
      }}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          borderRadius: 22,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: "rgba(251, 251, 247, 0.96)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.7)",
        }}
      >
        <CartBarContent />
      </View>
    </Animated.View>
  )
}
