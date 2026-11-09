import { useMemo, type ReactNode } from "react"
import { Pressable, View } from "react-native"
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, type SharedValue } from "react-native-reanimated"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChevronDown, Heart, Leaf, MapPin, Search, Truck } from "lucide-react-native"
import { MOROCCO_TIME_ZONE } from "@souki/shared"

import { introHeroOffset } from "@/components/launch-intro"
import { PressableScale } from "@/components/pressable-scale"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useFavorites } from "@/contexts/favorites-context"
import { useLocale } from "@/contexts/locale-context"
import { useDeliveryPromise } from "@/hooks/use-delivery-promise"
import { useOrderHours } from "@/hooks/use-order-hours"
import { palette, radius, SCREEN_PADDING, shadows, sizes } from "@/theme"

/** Hauteur dont l'en-tete descend a la fin de l'intro de lancement. */
const HERO_INTRO_DROP = 420

// Copie recadree et centree de symbol.png (le dessin d'origine est decale de 9 % vers la droite
// dans son image, ce qui le decentrait dans les pastilles rondes de l'en-tete).
export const SOUKI_SYMBOL = require("../../assets/brand/symbol-centered.png")
const MASCOT = require("../../assets/illustrations/recolte-fermier.svg")

/** Ville desservie (apps/client/lib/service-area.ts) ; l'adresse du compte arrive en phase « compte ». */
export const SERVICE_CITY = "Fès"

/** Souki flotte doucement : ±5 pt en 3,2 s (arrete en mouvement reduit). */
const FLOAT = {
  "0%": { transform: [{ translateY: 0 }] },
  "50%": { transform: [{ translateY: -5 }] },
  "100%": { transform: [{ translateY: 0 }] },
} as const

/** Moment de l'en-tete (horloge du marche) : jour, soir ou ferme. */
export type HeaderMoment = "jour" | "soir" | "ferme"

const MOMENT_GRADIENTS: Record<HeaderMoment, readonly [string, string, ...string[]]> = {
  jour: [palette.night950, palette.forest800, palette.market600],
  soir: [palette.night950, palette.green950, palette.souki900],
  ferme: [palette.night950, palette.green950],
}

/** Le soir commence a 18h (heure de l'appareil, comme la salutation). */
const EVENING_HOUR = 18

type HomeHeroProps = {
  scrollY: SharedValue<number>
  onSearch: () => void
  onFavorites: () => void
}

/**
 * En-tete de l'accueil (HomeHeader, design system 2027) : degrade qui suit l'horloge du
 * marche (jour, soir, ferme), « S » du sac en filigrane a 9 %, boutons en verre sur le vert,
 * etat du marche, salutation, Souki dans son medaillon et recherche blanche.
 * Tire vers le bas, le fond s'etire (1 + y/500) ; au defilement, le contenu s'efface.
 */
export function HomeHero({ scrollY, onSearch, onFavorites }: HomeHeroProps) {
  const { t, dateLocale } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const { favoriteIds } = useFavorites()

  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? t("Bonjour") : hour >= 12 && hour < EVENING_HOUR ? t("Bon après-midi") : t("Bonsoir")

  const todayLabel = useMemo(() => {
    try {
      return new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", timeZone: MOROCCO_TIME_ZONE })
    } catch {
      return ""
    }
  }, [dateLocale])

  // Fond : etirement quand on tire vers le bas, parallaxe quand on monte.
  // Fin de l'intro de lancement : l'en-tete vert descend du haut (420 ms, LaunchIntro).
  const introStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -introHeroOffset.get() * HERO_INTRO_DROP }] }))

  const backgroundStyle = useAnimatedStyle(() => {
    const y = scrollY.get()
    if (reducedMotion) return {}
    return y < 0 ? { transform: [{ translateY: y / 2 }, { scale: 1 + -y / 500 }] } : { transform: [{ translateY: y * 0.4 }] }
  })
  // Contenu : s'efface et remonte un peu en quittant l'ecran.
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 180], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: reducedMotion ? 0 : interpolate(scrollY.get(), [0, 180], [0, 40], Extrapolation.CLAMP) }],
  }))

  return (
    <Animated.View style={[{ borderBottomLeftRadius: radius.hero, borderBottomRightRadius: radius.hero, overflow: "hidden" }, introStyle]}>
      <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, backgroundStyle]}>
        <MomentGradient />
        <SMotif size={300} opacity={0.09} style={{ end: -70, bottom: -40 }} />
      </Animated.View>

      <Animated.View style={[{ paddingTop: insets.top + 8, paddingHorizontal: SCREEN_PADDING + 4, paddingBottom: 26, gap: 16 }, contentStyle]}>
        {/* Ligne 1 : symbole, ville de livraison, favoris */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <GlassCircle>
            <Image source={SOUKI_SYMBOL} style={{ width: 26, height: 26 }} contentFit="contain" tintColor={palette.white} accessibilityLabel="SOUKI" />
          </GlassCircle>
          <View
            accessible
            accessibilityLabel={t("Livraison à {ville}", { ville: SERVICE_CITY })}
            style={{
              flex: 1,
              minHeight: sizes.touchMin,
              borderRadius: radius.pill,
              backgroundColor: palette.glassOnDark,
              borderWidth: 1,
              borderColor: palette.glassStroke,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
            }}
          >
            <MapPin size={16} color={palette.mint300} strokeWidth={2.4} />
            <View style={{ flex: 1 }}>
              <Text variant="footnote" weight="semibold" color={palette.mint300} style={{ fontSize: 10, lineHeight: 12 }}>
                {t("Livraison à")}
              </Text>
              <Text variant="footnote" weight="heavy" color={palette.white} numberOfLines={1} style={{ lineHeight: 16 }}>
                {SERVICE_CITY}
              </Text>
            </View>
            <ChevronDown size={14} color={palette.white} />
          </View>
          <Pressable onPress={onFavorites} accessibilityRole="button" accessibilityLabel={t("Mes favoris")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <GlassCircle>
              <Heart size={20} color={palette.white} strokeWidth={2.2} />
            </GlassCircle>
            {favoriteIds.length > 0 ? (
              <View
                style={{
                  position: "absolute",
                  top: -4,
                  end: -4,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  paddingHorizontal: 4,
                  backgroundColor: palette.pink500,
                  borderWidth: 2,
                  borderColor: palette.night950,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text variant="eyebrow" weight="black" numeric color={palette.white} style={{ fontSize: 10, lineHeight: 12, letterSpacing: 0 }}>
                  {favoriteIds.length > 9 ? "9+" : String(favoriteIds.length)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <MarketStatusChip todayLabel={todayLabel} />

        {/* Salutation, promesse ; medaillon de la mascotte */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1, gap: 10 }}>
            {/* Rendu du prototype : 32 pt ExtraBold, interligne 44 (place pour le prenom une fois connecte). */}
            <Text accessibilityRole="header" variant="heroGreeting" weight="heavy" color={palette.white} style={{ fontSize: 32, lineHeight: 44, letterSpacing: 0 }}>
              {greeting} 👋
            </Text>
            <DeliveryLine />
          </View>
          <View
            style={{
              width: 86,
              height: 86,
              borderRadius: 43,
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.28)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View
              style={
                reducedMotion
                  ? undefined
                  : { animationName: FLOAT, animationDuration: "3200ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }
              }
            >
              <Image source={MASCOT} style={{ width: 70, height: 80, marginTop: 6 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
            </Animated.View>
            <View
              style={{
                position: "absolute",
                bottom: 2,
                end: 2,
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: palette.leaf500,
                borderWidth: 3,
                borderColor: palette.night950,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Leaf size={13} color={palette.white} strokeWidth={2.4} />
            </View>
          </View>
        </View>

        {/* Recherche blanche */}
        <PressableScale
          onPress={onSearch}
          accessibilityRole="search"
          accessibilityLabel={t("Rechercher un produit frais")}
          style={{
            minHeight: sizes.controlLg,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: palette.white,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 18,
            boxShadow: shadows.search,
          }}
        >
          <Search size={20} color={palette.market600} strokeWidth={2.4} />
          <Text variant="callout" weight="medium" color={palette.ink500} numberOfLines={1} style={{ flex: 1 }}>
            {t("Tomates, menthe, oranges…")}
          </Text>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  )
}

/**
 * Fond de l'en-tete selon le moment. Isole dans son propre composant : l'horloge se met a
 * jour chaque seconde sans redessiner tout l'en-tete.
 */
function MomentGradient() {
  const { closed } = useOrderHours()
  const hour = new Date().getHours()
  const moment: HeaderMoment = closed ? "ferme" : hour >= EVENING_HOUR || hour < 1 ? "soir" : "jour"
  return <LinearGradient colors={MOMENT_GRADIENTS[moment]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1.1 }} style={{ flex: 1 }} />
}

/** Etat du marche : ouvert (point frais qui pulse) ou ferme (point jaune). */
function MarketStatusChip({ todayLabel }: { todayLabel: string }) {
  const { t } = useLocale()
  const { closed } = useOrderHours()
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 28,
        paddingStart: 10,
        paddingEnd: 12,
        borderRadius: radius.pill,
        backgroundColor: palette.glassOnDark,
        borderWidth: 1,
        borderColor: palette.glassStroke,
      }}
    >
      <LiveDot color={closed ? palette.yellow400 : palette.fresh500} />
      <Text variant="footnote" weight="heavy" color={palette.white} numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
        {closed ? t("Fermé · réouverture à 8h") : t("Marché ouvert")}
        {todayLabel && !closed ? ` · ${todayLabel}` : ""}
      </Text>
    </View>
  )
}

/** Bouton rond en verre pose sur l'en-tete vert (44 pt). */
function GlassCircle({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        width: sizes.touchMin,
        height: sizes.touchMin,
        borderRadius: sizes.touchMin / 2,
        backgroundColor: palette.glassOnDark,
        borderWidth: 1,
        borderColor: palette.glassStroke,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  )
}

const PING = {
  from: { transform: [{ scale: 1 }], opacity: 0.7 },
  to: { transform: [{ scale: 2.6 }], opacity: 0 },
} as const

/** Point « en direct » qui pulse (1,8 s), immobile en mouvement reduit. */
export function LiveDot({ color }: { color: string }) {
  const reducedMotion = useReducedMotion()
  return (
    <View style={{ width: 8, height: 8, alignItems: "center", justifyContent: "center" }}>
      {reducedMotion ? null : (
        <Animated.View
          style={{ position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: color, animationName: PING, animationDuration: "1800ms", animationIterationCount: "infinite", animationTimingFunction: "ease-out" }}
        />
      )}
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  )
}

function DeliveryLine() {
  const hours = useOrderHours()
  const promise = useDeliveryPromise(hours)
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <Truck size={16} color={palette.mint300} strokeWidth={2.2} style={{ marginTop: 1 }} />
      <Text variant="footnote" color={palette.mint300} style={{ flex: 1 }}>
        {promise}
      </Text>
    </View>
  )
}
