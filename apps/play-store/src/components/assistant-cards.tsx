import { useState, type ReactNode } from "react"
import { View } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { ArrowLeft, ArrowRight, Mic, ShoppingBasket, Sparkle } from "lucide-react-native"

import { PressableScale } from "@/components/pressable-scale"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { gradients, palette, radius, SCREEN_PADDING, shadows, scene } from "@/theme"

type AssistantCardsProps = {
  onVoice: () => void
  onSmart: () => void
}

const WAVE = {
  "0%": { transform: [{ scaleY: 0.55 }] },
  "50%": { transform: [{ scaleY: 1 }] },
  "100%": { transform: [{ scaleY: 0.55 }] },
} as const

const BREATHE = {
  "0%": { opacity: 0.7, transform: [{ scale: 1 }] },
  "50%": { opacity: 1, transform: [{ scale: 1.08 }] },
  "100%": { opacity: 0.7, transform: [{ scale: 1 }] },
} as const

const RING = {
  "0%": { opacity: 0.9, transform: [{ scale: 1 }] },
  "100%": { opacity: 0, transform: [{ scale: 1.7 }] },
} as const

/** Hauteur relative des 5 barres d'onde (comme l'orbe du site). */
const BARS = [0.4, 0.7, 1, 0.7, 0.4]

/**
 * Les deux assistants de SOUKI, fonctions phares, juste sous l'en-tete de l'accueil
 * (AssistantCards « duo », design system 2027) : commande vocale (carte foret, orbe cyan)
 * et panier intelligent (carte blanche, medaillon vert et etincelle jaune). Les pastilles
 * « 150 DH · 4 pers. · Tajine » sont des exemples d'entree, pas des promesses.
 */
export function AssistantCards({ onVoice, onSmart }: AssistantCardsProps) {
  const { t, isRtl } = useLocale()
  const reducedMotion = useReducedMotion()
  const [voicePressed, setVoicePressed] = useState(false)
  const Arrow = isRtl ? ArrowLeft : ArrowRight
  const voiceTitle = t("Commande vocale")
  const voiceText = t("Dites votre liste, Souki remplit le panier.")
  const smartTitle = t("Panier intelligent")
  const smartText = t("Budget, foyer ou plat marocain")

  return (
    <View style={{ flexDirection: "row", gap: 12, marginHorizontal: SCREEN_PADDING }}>
      <View style={{ flex: 1 }}>
      <PressableScale
        onPress={() => {
          haptics.medium()
          onVoice()
        }}
        onPressIn={() => setVoicePressed(true)}
        onPressOut={() => setVoicePressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`${voiceTitle}. ${voiceText}`}
        containerStyle={{ flex: 1 }}
        style={{ flex: 1, borderRadius: radius.card, borderCurve: "continuous", boxShadow: "0 22px 40px -22px rgba(10, 38, 20, 0.9)" }}
      >
        <LinearGradient
          colors={gradients.voice}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ flex: 1, minHeight: 216, padding: 16, gap: 10, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden", alignItems: "flex-start", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)" }}
        >
          {reducedMotion ? null : (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -30,
                start: -40,
                width: 170,
                height: 170,
                borderRadius: 85,
                backgroundColor: "rgba(80, 220, 230, 0.16)",
                boxShadow: "0 0 60px 30px rgba(80, 220, 230, 0.14)",
                animationName: BREATHE,
                animationDuration: "3600ms",
                animationIterationCount: "infinite",
                animationTimingFunction: "ease-in-out",
              }}
            />
          )}
          <VoiceOrb size={64} animated={!reducedMotion} rings={voicePressed && !reducedMotion} />
          <View style={{ gap: 4 }}>
            <Text variant="headline" weight="black" color={scene.white} style={{ fontSize: 18, lineHeight: 24 }}>
              {voiceTitle}
            </Text>
            <Text variant="footnote" weight="semibold" color={scene.mint300} style={{ lineHeight: 19 }}>
              {voiceText}
            </Text>
          </View>
          <Cta label={t("Dicter ma liste")} background={scene.yellow400} color={scene.ink900} leading={<Mic size={14} color={scene.ink900} strokeWidth={2.6} />} />
        </LinearGradient>
      </PressableScale>
      </View>

      <View style={{ flex: 1 }}>
      <PressableScale
        onPress={() => {
          haptics.add()
          onSmart()
        }}
        accessibilityRole="button"
        accessibilityLabel={`${smartTitle}. ${smartText}`}
        containerStyle={{ flex: 1 }}
        style={{ flex: 1, borderRadius: radius.card, borderCurve: "continuous", boxShadow: shadows.card }}
      >
        <View
          style={{
            flex: 1,
            minHeight: 216,
            padding: 16,
            gap: 10,
            borderRadius: radius.card,
            borderCurve: "continuous",
            overflow: "hidden",
            alignItems: "flex-start",
            backgroundColor: palette.white,
            borderWidth: 1,
            borderColor: palette.green100,
          }}
        >
          <View pointerEvents="none" style={{ position: "absolute", top: -46, end: -46, width: 150, height: 150, borderRadius: 75, backgroundColor: palette.pale50 }} />
          <SmartMedallion />
          <View style={{ gap: 4 }}>
            <Text variant="headline" weight="black" color={palette.ink900} style={{ fontSize: 18, lineHeight: 24 }}>
              {smartTitle}
            </Text>
            <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ lineHeight: 19 }}>
              {smartText}
            </Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {["150 DH", t("4 pers."), t("Tajine")].map((chip, index) => (
              <View key={chip} style={{ minHeight: 22, paddingHorizontal: 8, borderRadius: 999, justifyContent: "center", backgroundColor: palette.pale50 }}>
                <Text variant="eyebrow" numeric={index === 0} color={palette.market700} style={{ letterSpacing: 0, textTransform: "none" }}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>
          <Cta label={t("Composer")} background={palette.souki900} color={palette.white} trailing={<Arrow size={14} color={palette.white} strokeWidth={2.8} />} />
        </View>
      </PressableScale>
      </View>
    </View>
  )
}

/** Bouton capsule en bas de carte (34 pt, zone de toucher etendue par la carte entiere). */
function Cta({ label, background, color, leading, trailing }: { label: string; background: string; color: string; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <View style={{ marginTop: "auto", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: background }}>
      {leading}
      <Text variant="footnote" weight="black" color={color} numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </Text>
      {trailing}
    </View>
  )
}

/**
 * Orbe de la commande vocale : degrade voice-cyan → voice-teal → market-600 et barres
 * d'onde. A l'appui, deux anneaux cyan sortent de l'orbe. Rien ne bouge en mouvement reduit.
 */
export function VoiceOrb({ size, animated, rings = false }: { size: number; animated: boolean; rings?: boolean }) {
  const barWidth = size >= 48 ? 3 : 2
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      {rings
        ? [0, 800].map((delay) => (
            <Animated.View
              key={delay}
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 1.5,
                borderColor: "rgba(80, 220, 230, 0.6)",
                opacity: 0,
                animationName: RING,
                animationDuration: "1600ms",
                animationDelay: `${delay}ms`,
                animationIterationCount: "infinite",
                animationTimingFunction: "ease-out",
              }}
            />
          ))
        : null}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          boxShadow: "0 0 0 1px rgba(80, 220, 230, 0.45), 0 18px 40px -12px rgba(80, 220, 230, 0.6), inset 0 -14px 30px rgba(17, 59, 30, 0.45)",
        }}
      >
        <LinearGradient
          colors={[palette.voiceCyan, palette.voiceTeal, palette.market600]}
          start={{ x: 0.2, y: 0.1 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1, borderRadius: size / 2, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 3 }}
        >
          {BARS.map((height, index) => (
            <Animated.View
              key={index}
              style={[
                { width: barWidth, height: size * 0.4 * height, borderRadius: 2, backgroundColor: palette.forest900 },
                animated
                  ? {
                      animationName: WAVE,
                      animationDuration: "1100ms",
                      animationDelay: `${index * 120}ms`,
                      animationIterationCount: "infinite",
                      animationTimingFunction: "ease-in-out",
                    }
                  : null,
              ]}
            />
          ))}
        </LinearGradient>
      </View>
    </View>
  )
}

/** Medaillon du panier intelligent : panier blanc sur vert, etincelle jaune a l'encre. */
function SmartMedallion({ size = 64 }: { size?: number }) {
  const small = size < 48
  const corner = small ? 12 : 22
  const spark = small ? 16 : 22
  return (
    <View style={{ width: size, height: size, borderRadius: corner, borderCurve: "continuous", boxShadow: small ? undefined : "0 12px 22px -10px rgba(0, 91, 67, 0.7)" }}>
      <LinearGradient
        colors={[palette.market600, palette.souki900]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: corner, borderCurve: "continuous", alignItems: "center", justifyContent: "center" }}
      >
        <ShoppingBasket size={small ? 18 : 28} color={palette.white} strokeWidth={2.2} />
      </LinearGradient>
      <View
        style={{
          position: "absolute",
          top: small ? -4 : -5,
          end: small ? -4 : -5,
          width: spark,
          height: spark,
          borderRadius: spark / 2,
          borderWidth: small ? 2 : 3,
          borderColor: palette.white,
          backgroundColor: palette.yellow400,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkle size={small ? 8 : 10} color={scene.ink900} fill={scene.ink900} strokeWidth={2} />
      </View>
    </View>
  )
}

/**
 * Variante compacte (catalogue, panier vide) : deux capsules de meme poids, orbe vocal
 * a gauche et medaillon du panier intelligent a droite.
 */
export function AssistantPills({ onVoice, onSmart }: AssistantCardsProps) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const pill = { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingStart: 6, paddingEnd: 14, borderRadius: 999 } as const
  return (
    <View style={{ flexDirection: "row", gap: 8, marginHorizontal: SCREEN_PADDING }}>
      <View style={{ flex: 1 }}>
        <PressableScale
          onPress={() => {
            haptics.medium()
            onVoice()
          }}
          accessibilityRole="button"
          accessibilityLabel={t("Commande vocale")}
          containerStyle={{ flex: 1 }}
          style={{ flex: 1 }}
        >
          {/* Meme contour de 1 pt que la pastille blanche : les deux ont exactement la meme taille. */}
          <LinearGradient colors={gradients.voice} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[pill, { borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.08)" }]}>
            <VoiceOrb size={40} animated={!reducedMotion} />
            <Text variant="footnote" weight="heavy" color={scene.white} numberOfLines={2} style={{ flex: 1, fontSize: 14, lineHeight: 17 }}>
              {t("Commande vocale")}
            </Text>
          </LinearGradient>
        </PressableScale>
      </View>
      <View style={{ flex: 1 }}>
        <PressableScale
          onPress={() => {
            haptics.add()
            onSmart()
          }}
          accessibilityRole="button"
          accessibilityLabel={t("Panier intelligent")}
          containerStyle={{ flex: 1 }}
          style={{ flex: 1 }}
        >
          <View style={[pill, { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.green100 }]}>
            <View style={{ padding: 2 }}>
              <SmartMedallion size={36} />
            </View>
            <Text variant="footnote" weight="heavy" color={palette.ink900} numberOfLines={2} style={{ flex: 1, fontSize: 14, lineHeight: 17 }}>
              {t("Panier intelligent")}
            </Text>
          </View>
        </PressableScale>
      </View>
    </View>
  )
}
