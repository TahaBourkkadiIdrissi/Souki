import { View } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowLeft, ArrowRight, Clock, Flame } from "lucide-react-native"
import { formatCountdown } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useDeliveryPromise } from "@/hooks/use-delivery-promise"
import { useOrderHours } from "@/hooks/use-order-hours"
import { palette, radius, SCREEN_PADDING, shadows } from "@/theme"

/** Meme photo d'etal que la carte « marche » de l'accueil PWA. */
const MARKET_PHOTO = "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900&q=80"

/** Derniere heure avant la cloture : la pastille passe en mode urgence. */
const URGENT_SECONDS = 60 * 60

const PULSE = {
  "0%": { transform: [{ scale: 1 }] },
  "50%": { transform: [{ scale: 1.06 }] },
  "100%": { transform: [{ scale: 1 }] },
} as const

/**
 * Carte « marche du jour » : photo d'etal sous un voile vert, cloture a 01h00 (ou reouverture
 * a 08h00) et compte a rebours dont les chiffres roulent. Dans la derniere heure, la pastille
 * devient « Derniere heure » et bat doucement. Seule cette carte se redessine chaque seconde.
 */
export function OrderStatusCard({ onCompose }: { onCompose: () => void }) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const hours = useOrderHours()
  const promise = useDeliveryPromise(hours)
  const remaining = hours.hours * 3600 + hours.minutes * 60 + hours.seconds
  const urgent = !hours.closed && remaining <= URGENT_SECONDS

  return (
    <View style={{ marginHorizontal: SCREEN_PADDING, borderRadius: radius.feature, borderCurve: "continuous", boxShadow: shadows.raised }}>
      <View style={{ borderRadius: radius.feature, borderCurve: "continuous", overflow: "hidden" }}>
        <Image source={{ uri: MARKET_PHOTO }} style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }} contentFit="cover" transition={200} />
        <LinearGradient
          colors={["rgba(11, 42, 21, 0.95)", "rgba(17, 59, 30, 0.85)", "rgba(17, 59, 30, 0.25)"]}
          start={{ x: isRtl ? 1 : 0, y: 0.5 }}
          end={{ x: isRtl ? 0 : 1, y: 0.5 }}
          style={{ padding: 20, gap: 14 }}
        >
          <Animated.View
            style={[
              { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: urgent ? palette.red600 : palette.orange500 },
              urgent && !reducedMotion
                ? { animationName: PULSE, animationDuration: "1400ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }
                : null,
            ]}
          >
            {/* 2027 : encre sur orange (5,4:1), blanc seulement sur rouge. */}
            {urgent ? <Flame size={14} color={palette.white} strokeWidth={2.6} /> : <Clock size={14} color={palette.ink900} strokeWidth={2.6} />}
            <Text variant="eyebrow" color={urgent ? palette.white : palette.ink900}>
              {urgent ? t("Dernière heure pour commander") : t("Marché du jour")}
            </Text>
          </Animated.View>
          <View style={{ gap: 4 }}>
            <Text variant="title" weight="heavy" color={palette.white} style={{ fontSize: 22, lineHeight: 27 }}>
              {hours.closed ? t("Les commandes rouvrent à 8h") : t("Clôture à 1h du matin")}
            </Text>
            <Text variant="footnote" color={palette.mint300} style={{ maxWidth: 260 }}>
              {promise}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="eyebrow" color={palette.mint300}>
              {hours.closed ? t("Réouverture dans") : t("Clôture dans")}
            </Text>
            <View style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: "rgba(255, 255, 255, 0.15)" }}>
              <AnimatedDigits value={formatCountdown(hours)} variant="headline" weight="heavy" color={palette.white} />
            </View>
          </View>
          <BrandButton label={t("Composer mon panier")} icon={isRtl ? ArrowLeft : ArrowRight} tone="light" fill={false} onPress={onCompose} />
        </LinearGradient>
      </View>
    </View>
  )
}
