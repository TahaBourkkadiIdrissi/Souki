import { useState } from "react"
import { Pressable, View } from "react-native"
import Animated, { useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { Image } from "expo-image"
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect"
import { setStatusBarStyle } from "expo-status-bar"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Search, ShoppingBasket } from "lucide-react-native"

import { SOUKI_SYMBOL } from "@/components/home-hero"
import { Text } from "@/components/text"
import { useCart } from "@/contexts/cart-context"
import { useLocale } from "@/contexts/locale-context"
import { EASE_OUT_2027 } from "@/lib/motion"
import { palette, SCREEN_PADDING, sizes } from "@/theme"

type CompactHeaderProps = {
  scrollY: SharedValue<number>
  /** Defilement a partir duquel la barre apparait (la recherche de l'en-tete sort de l'ecran). */
  threshold: number
  onSearch: () => void
}

/** Le verre natif (iOS 26) quand il existe ; sinon un fond creme presque opaque. */
// Meme rendu du verre de l'iPhone en iOS 18 au plus recent (comme le dock du bas) :
// le verre natif d'iOS 26 n'est pas utilise, pour ne pas avoir deux apparences.
const NATIVE_GLASS = false && isGlassEffectAPIAvailable()

/**
 * Barre compacte en verre clair (HomeHeader, design system 2027) : quand la recherche de
 * l'en-tete sort de l'ecran, elle descend en fondu + 8 pt en 200 ms avec le symbole SOUKI,
 * la recherche et le panier. La barre d'etat passe alors en texte sombre.
 */
export function CompactHeader({ scrollY, threshold, onSearch }: CompactHeaderProps) {
  const { t } = useLocale()
  const router = useRouter()
  const { count } = useCart()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const [interactive, setInteractive] = useState(false)
  const shown = useSharedValue(0)

  const onVisibilityChange = (visible: boolean) => {
    setInteractive(visible)
    setStatusBarStyle(visible ? "dark" : "light")
  }

  useAnimatedReaction(
    () => scrollY.get() > threshold,
    (visible, previous) => {
      if (visible === previous) return
      shown.set(withTiming(visible ? 1 : 0, { duration: reducedMotion ? 0 : 200, easing: EASE_OUT_2027 }))
      if (previous !== null) scheduleOnRN(onVisibilityChange, visible)
    },
  )

  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * -8 }],
  }))

  return (
    <Animated.View
      pointerEvents={interactive ? "box-none" : "none"}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? "auto" : "no-hide-descendants"}
      style={[{ position: "absolute", top: 0, left: 0, right: 0, boxShadow: `0 1px 0 ${palette.line}` }, style]}
    >
      {NATIVE_GLASS ? (
        <GlassView glassEffectStyle="regular" colorScheme="light" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(251, 251, 247, 0.97)" }} />
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: insets.top + 6, paddingBottom: 10, paddingHorizontal: SCREEN_PADDING - 4 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.souki900, alignItems: "center", justifyContent: "center" }}>
          <Image source={SOUKI_SYMBOL} style={{ width: 24, height: 24 }} contentFit="contain" tintColor={palette.white} accessibilityLabel="SOUKI" />
        </View>
        <Pressable
          onPress={onSearch}
          accessibilityRole="search"
          accessibilityLabel={t("Rechercher un produit frais")}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: sizes.touchMin,
            borderRadius: 14,
            backgroundColor: palette.white,
            borderWidth: 1,
            borderColor: palette.line,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Search size={17} color={palette.market600} strokeWidth={2.4} />
          <Text variant="callout" weight="medium" color={palette.ink400} numberOfLines={1} style={{ flex: 1 }}>
            {t("Tomates, menthe, oranges…")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.navigate("/panier")}
          accessibilityRole="button"
          accessibilityLabel={t("Voir le panier")}
          style={({ pressed }) => ({ width: sizes.touchMin, height: sizes.touchMin, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
        >
          <ShoppingBasket size={22} color={palette.souki900} strokeWidth={2.2} />
          {count > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 2,
                end: 0,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                paddingHorizontal: 4,
                backgroundColor: palette.orange500,
                borderWidth: 2,
                borderColor: palette.cream,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Pastille du panier : orange a l'encre (5,4:1). */}
              <Text variant="eyebrow" weight="black" numeric color={palette.ink900} style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0 }}>
                {count > 99 ? "99+" : String(count)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </Animated.View>
  )
}
