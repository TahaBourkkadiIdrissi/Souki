import { View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowLeft, ArrowRight, CircleAlert, Clock, Moon, type LucideIcon } from "lucide-react-native"
import { formatCountdown } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { BrandButton } from "@/components/brand-button"
import { SMotif } from "@/components/s-motif"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useDeliveryPromise } from "@/hooks/use-delivery-promise"
import { useOrderHours } from "@/hooks/use-order-hours"
import { DUR_SLOW } from "@/lib/motion"
import { gradients, palette, radius, SCREEN_PADDING, shadows, scene } from "@/theme"

/** Derniere heure avant la cloture de 01h00 : la carte passe en ardoise orange. */
const LAST_HOUR_SECONDS = 60 * 60

export type MarketClockState = "open" | "last" | "closed"

type MarketClockProps = {
  /** Etat ouvert ou fermé : composer le panier. */
  onCompose: () => void
  /** Derniere heure : aller valider le panier. */
  onValidate: () => void
}

type StateSpec = {
  chip: string
  Icon: LucideIcon
  chipBackground: string
  chipColor: string
  title: string
  count: string
  cta: string
  ctaTone: "light" | "ink"
  ink: string
  subColor: string
}

const SPECS: Record<MarketClockState, StateSpec> = {
  open: {
    chip: "Marché du jour",
    Icon: Clock,
    chipBackground: scene.orange500,
    chipColor: scene.ink900,
    title: "Clôture à 1h du matin",
    count: "Fermeture dans",
    cta: "Composer mon panier",
    ctaTone: "light",
    ink: scene.white,
    subColor: scene.mint300,
  },
  last: {
    chip: "Dernière heure",
    Icon: CircleAlert,
    chipBackground: scene.ink900,
    chipColor: scene.orange500,
    title: "Dernière heure pour commander",
    count: "Il reste",
    cta: "Valider mon panier",
    ctaTone: "ink",
    ink: scene.ink900,
    subColor: scene.ink900,
  },
  closed: {
    chip: "Fermé · réouverture à 8h",
    Icon: Moon,
    chipBackground: scene.yellow400,
    chipColor: scene.ink900,
    title: "Le marché dort",
    count: "Réouverture dans",
    cta: "Préparer mon panier",
    ctaTone: "light",
    ink: scene.white,
    subColor: scene.mint300,
  },
}

/** Etat de la carte d'apres l'horloge des commandes (serveur, heure du Maroc). */
export function marketClockState(hours: { closed: boolean; hours: number; minutes: number; seconds: number }): MarketClockState {
  if (hours.closed) return "closed"
  return hours.hours * 3600 + hours.minutes * 60 + hours.seconds <= LAST_HOUR_SECONDS ? "last" : "open"
}

/**
 * Carte « Marché du jour » (MarketClock, design system 2027) : l'horloge du service.
 * Ouvert (degrade vert, puce orange), derniere heure (ardoise orange a l'encre), ferme
 * (nuit et lune jaune). Le compte a rebours est le plus gros chiffre de l'ecran et ses
 * chiffres roulent ; le passage d'un etat a l'autre se fait en fondu. Seule cette carte
 * se redessine chaque seconde.
 */
export function MarketClock({ onCompose, onValidate }: MarketClockProps) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const hours = useOrderHours()
  const promise = useDeliveryPromise(hours)
  const state = marketClockState(hours)
  const spec = SPECS[state]
  const countdown = formatCountdown(hours)
  const sub =
    state === "open"
      ? promise
      : state === "last"
        ? t("Après 1h, le panier reste prêt mais la validation attend 8h.")
        : t("Vous pouvez préparer votre panier. Validation dès 8h.")

  return (
    <View style={{ marginHorizontal: SCREEN_PADDING, borderRadius: radius.feature, borderCurve: "continuous", boxShadow: shadows.raised }}>
      <Animated.View
        key={state}
        entering={reducedMotion ? undefined : FadeIn.duration(DUR_SLOW)}
        style={{ borderRadius: radius.feature, borderCurve: "continuous", overflow: "hidden" }}
      >
        <LinearGradient
          colors={state === "open" ? gradients.clock.open : state === "last" ? gradients.clock.lastHour : gradients.clock.closed}
          start={{ x: isRtl ? 1 : 0, y: 0 }}
          end={{ x: isRtl ? 0 : 1, y: 1 }}
          style={{ padding: 20, gap: 14 }}
        >
          {state === "closed" ? (
            <MoonMark style={{ position: "absolute", top: 18, end: 20 }} />
          ) : (
            <SMotif size={200} color={state === "last" ? scene.ink900 : scene.white} opacity={0.14} style={{ top: -30, end: -40 }} />
          )}

          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              minHeight: 28,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: spec.chipBackground,
            }}
          >
            <spec.Icon size={14} color={spec.chipColor} strokeWidth={2.6} />
            <Text variant="eyebrow" color={spec.chipColor}>
              {t(spec.chip)}
            </Text>
          </View>

          <View style={{ gap: 6, paddingEnd: state === "closed" ? 56 : 0 }}>
            <Text accessibilityRole="header" variant="title2" weight="black" color={spec.ink} style={{ fontSize: 22, lineHeight: 26 }}>
              {t(spec.title)}
            </Text>
            <Text variant="footnote" color={spec.subColor}>
              {sub}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <View accessible accessibilityLabel={`${t(spec.count)} ${countdown}`} style={{ gap: 4 }}>
              <Text variant="eyebrow" color={spec.subColor}>
                {t(spec.count)}
              </Text>
              <AnimatedDigits value={countdown} variant="countdown" color={spec.ink} />
            </View>
            <BrandButton
              label={t(spec.cta)}
              icon={isRtl ? ArrowLeft : ArrowRight}
              tone={spec.ctaTone}
              iconPosition="end"
              size="md"
              fill={false}
              onPress={state === "last" ? onValidate : onCompose}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  )
}

/** Lune jaune du mode ferme : disque yellow-400 echancre par un disque de nuit. */
export function MoonMark({ style }: { style?: object }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: 44, height: 44, borderRadius: 22, boxShadow: "0 0 0 10px rgba(245, 196, 0, 0.12), 0 0 0 22px rgba(245, 196, 0, 0.06)" },
        style,
      ]}
    >
      <View style={{ flex: 1, borderRadius: 22, backgroundColor: scene.yellow400, overflow: "hidden" }}>
        <View style={{ position: "absolute", top: -6, start: -10, width: 40, height: 40, borderRadius: 20, backgroundColor: scene.night950 }} />
      </View>
    </View>
  )
}
