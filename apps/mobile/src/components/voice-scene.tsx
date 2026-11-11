import { useMemo, type ReactNode } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, Keyframe, useReducedMotion, ZoomIn } from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import { AlertTriangle, Check, ChevronDown, Info, Trash2, X } from "lucide-react-native"

import { AnimatedDigits } from "@/components/animated-digits"
import { RoundIcon } from "@/components/ai-parts"
import { VoiceOrb } from "@/components/assistant-cards"
import { LiveDot } from "@/components/home-hero"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, radius, shadows } from "@/theme"

/*
 * Scene de la commande vocale (VoiceListening + VoiceAnalysis, design system 2027) : une seule vue
 * pour l'ecoute, l'analyse « Du mot au panier », la liste prete et « pas compris ». Les blocs
 * restent en place d'un etat a l'autre : seules l'etape active, la vedette et le plateau changent.
 * `compact` : iPhone SE (375 x 667), tailles reduites comme la page EcranPetit.
 */

const SPIN = { from: { transform: [{ rotate: "0deg" }] }, to: { transform: [{ rotate: "360deg" }] } } as const
const BLINK = { "0%": { opacity: 1 }, "50%": { opacity: 0.35 }, "100%": { opacity: 1 } } as const
const BREATHE = { "0%": { opacity: 1, transform: [{ scale: 1 }] }, "50%": { opacity: 0.6, transform: [{ scale: 1.12 }] }, "100%": { opacity: 1, transform: [{ scale: 1 }] } } as const
const BREATHE_SOFT = { "0%": { transform: [{ scale: 1 }] }, "50%": { transform: [{ scale: 1.04 }] }, "100%": { transform: [{ scale: 1 }] } } as const
const WAVE = { "0%": { transform: [{ scaleY: 0.55 }] }, "50%": { transform: [{ scaleY: 1 }] }, "100%": { transform: [{ scaleY: 0.55 }] } } as const

const CYAN_SOFT = "rgba(80, 220, 230, 0.16)"
const WHITE_DIM = "rgba(255, 255, 255, 0.38)"
const WHITE_SEEN = "rgba(255, 255, 255, 0.86)"

/** Fond plein ecran : vert foret, plus clair en haut (radial du design rendu en lineaire). */
export function VoiceBackdrop() {
  return (
    <LinearGradient
      colors={[palette.forest700, palette.forest900]}
      locations={[0.05, 0.75]}
      start={{ x: 0.5, y: 0.1 }}
      end={{ x: 0.5, y: 1 }}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    />
  )
}

export function VoiceTopBar({ onClose }: { onClose: () => void }) {
  const { t } = useLocale()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <RoundIcon dark icon={X} label={t("Fermer")} onPress={onClose} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LiveDot color={palette.mint300} />
        <Text variant="callout" weight="heavy" color={palette.white} style={{ fontSize: 16 }}>
          {t("IA-SOUKI Vocal")}
        </Text>
      </View>
      <View style={{ width: 44 }} />
    </View>
  )
}

export type StepState = "done" | "now" | "live" | "ready" | "err" | "next"

/** Trois etapes : Ecoute, Comprehension, Panier. */
export function VoiceSteps({ states }: { states: [StepState, StepState, StepState] }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  // « Analyse » plutot que « Compréhension » : le mot tient dans la pastille, meme sur iPhone SE.
  const labels = [t("Écoute"), t("Analyse"), t("Panier")]
  return (
    <View accessibilityRole="list" style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
      {states.map((state, index) => {
        const active = state === "now" || state === "live" || state === "ready"
        const background = active ? CYAN_SOFT : state === "err" ? "rgba(240, 124, 0, 0.2)" : "rgba(255, 255, 255, 0.08)"
        const color = state === "done" ? palette.mint300 : active || state === "err" ? palette.white : "rgba(255, 255, 255, 0.5)"
        return (
          <View
            key={labels[index]}
            accessible
            accessibilityLabel={`${labels[index]}${state === "done" ? `, ${t("terminé")}` : active ? `, ${t("en cours")}` : ""}`}
            style={{ flex: 1, minWidth: 0, minHeight: 28, paddingVertical: 4, paddingHorizontal: 6, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: background }}
          >
            {state === "done" ? (
              <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.mint300 }}>
                <Check size={11} color={palette.forest900} strokeWidth={3.4} />
              </View>
            ) : state === "err" ? (
              <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: palette.orange500 }}>
                <Text variant="footnote" weight="black" color={palette.ink900} style={{ fontSize: 10, lineHeight: 12 }}>
                  !
                </Text>
              </View>
            ) : state === "live" || state === "ready" ? (
              <Animated.View
                style={[
                  { width: 10, height: 10, marginHorizontal: 3, borderRadius: 5, backgroundColor: palette.voiceCyan, boxShadow: "0 0 0 4px rgba(80, 220, 230, 0.25)" },
                  reducedMotion || state === "ready" ? null : { animationName: BLINK, animationDuration: "1200ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
                ]}
              />
            ) : state === "now" ? (
              <Animated.View
                style={[
                  { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "rgba(255, 255, 255, 0.3)", borderTopColor: palette.voiceCyan },
                  reducedMotion ? null : { animationName: SPIN, animationDuration: "800ms", animationIterationCount: "infinite", animationTimingFunction: "linear" },
                ]}
              />
            ) : (
              <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: color }} />
            )}
            <Text variant="footnote" weight="heavy" color={color} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2} style={{ flexShrink: 1, fontSize: 11, lineHeight: 14 }}>
              {labels[index]}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export type SaidWord = { text: string; tone: "dim" | "seen" | "cur" | "miss" }

/** « Vous avez dit » : la phrase en texte calme, sans aucune etiquette ; une lumiere la parcourt. */
export function VoiceSaid({ words, placeholder, caret = false, compact, minHeight }: { words: SaidWord[]; placeholder?: string; caret?: boolean; compact: boolean; minHeight?: number }) {
  const { t, locale } = useLocale()
  const reducedMotion = useReducedMotion()
  const visible = words.filter((word) => word.text)
  return (
    <View
      style={{
        marginTop: compact ? 12 : 16,
        paddingTop: 12,
        paddingBottom: 13,
        paddingHorizontal: 14,
        minHeight,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: "rgba(255, 255, 255, 0.07)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      <Text variant="footnote" weight="heavy" color={palette.mint300} style={{ fontSize: 11, lineHeight: 14, letterSpacing: locale === "ar" ? 0 : 0.9, textTransform: locale === "ar" ? "none" : "uppercase" }}>
        {t("Vous avez dit")}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 5 }}>
        <Text accessibilityLiveRegion="polite" weight="bold" style={{ fontSize: 16, lineHeight: 25, color: WHITE_DIM }}>
          {visible.length === 0
            ? placeholder
            : visible.map((word, index) => (
                <Text
                  key={index}
                  style={{
                    color: word.tone === "cur" ? palette.voiceCyan : word.tone === "dim" ? WHITE_DIM : WHITE_SEEN,
                    textDecorationLine: word.tone === "miss" ? "underline" : "none",
                    textDecorationStyle: "dotted",
                    textDecorationColor: palette.orange500,
                  }}
                >
                  {`${word.text} `}
                </Text>
              ))}
        </Text>
        {caret ? (
          <Animated.View
            accessibilityElementsHidden
            style={[
              { width: 2, height: 18, borderRadius: 1, marginStart: visible.length ? 0 : 4, backgroundColor: palette.voiceCyan },
              reducedMotion ? null : { animationName: BLINK, animationDuration: "900ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
            ]}
          />
        ) : null}
      </View>
    </View>
  )
}

/** Petite onde de la voix (5 barres). */
function Wave({ size, color = palette.forest900 }: { size: number; color?: string }) {
  const reducedMotion = useReducedMotion()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size > 60 ? 4 : 3, height: size * 0.36 }}>
      {[0.4, 0.7, 1, 0.7, 0.4].map((height, index) => (
        <Animated.View
          key={index}
          style={[
            { width: size > 60 ? 4 : 3, height: size * 0.36 * height, borderRadius: 2, backgroundColor: color },
            reducedMotion
              ? null
              : { animationName: WAVE, animationDuration: "1100ms", animationDelay: `${index * 110}ms`, animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
          ]}
        />
      ))}
    </View>
  )
}

/**
 * Ecoute : la sphere au centre. Au repos, elle respire et invite a parler (rien n'est enregistre
 * avant le toucher) ; a l'ecoute, ondes et anneaux, et la toucher termine.
 */
export function ListeningSpot({ compact, listening, onPress }: { compact: boolean; listening: boolean; onPress: () => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const size = compact ? 120 : 168
  return (
    <View style={{ flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: 22, paddingTop: 8, paddingBottom: 12 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={listening ? t("Arrêter l'écoute") : t("Commencer à parler")}
        accessibilityState={{ selected: listening }}
        hitSlop={8}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}
      >
        <Animated.View style={listening || reducedMotion ? undefined : { animationName: BREATHE_SOFT, animationDuration: "3600ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }}>
          <VoiceOrb size={size} animated={listening && !reducedMotion} rings={listening && !reducedMotion} />
        </Animated.View>
      </Pressable>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" weight="black" color={palette.white} align="center" style={{ fontSize: compact ? 22 : 26, lineHeight: compact ? 26 : 30, letterSpacing: -0.5 }}>
          {listening ? t("Je vous écoute") : t("Touchez la sphère pour parler")}
        </Text>
        <Text weight="bold" color={palette.mint300} align="center" style={{ fontSize: 15, lineHeight: 20 }}>
          {t("Dites vos produits et leurs quantités.")}
        </Text>
      </View>
    </View>
  )
}

export type SpotItem = { kind: "item"; key: string; name: string; detail: string; image: string } | { kind: "missing"; key: string; name: string } | null

/*
 * Passage d'un produit au suivant : le disque precedent s'envole et s'efface pendant que le
 * nouveau arrive en ressort (avec une legere rotation), une onde part de l'anneau et six eclats
 * s'echappent. Le texte monte de 10 pt, juste apres le disque. Les deux disques sont superposes :
 * aucun saut de mise en page.
 */
const DISC_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.55 }, { rotate: "-14deg" }] },
  55: { opacity: 1, transform: [{ translateY: -3 }, { scale: 1.08 }, { rotate: "3deg" }], easing: Easing.out(Easing.cubic) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }, { rotate: "0deg" }], easing: Easing.inOut(Easing.quad) },
}).duration(560)

const DISC_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -22 }, { scale: 0.78 }], easing: Easing.in(Easing.cubic) },
}).duration(260)

const PULSE = new Keyframe({
  0: { opacity: 0.75, transform: [{ scale: 0.82 }] },
  100: { opacity: 0, transform: [{ scale: 1.5 }], easing: Easing.out(Easing.cubic) },
}).duration(760)

const TEXT_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 10 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
})
  .duration(360)
  .delay(140)

const TEXT_OUT = new Keyframe({
  0: { opacity: 1, transform: [{ translateY: 0 }] },
  100: { opacity: 0, transform: [{ translateY: -8 }], easing: Easing.in(Easing.quad) },
}).duration(180)

const SPARK_ANGLES = [-90, -30, 30, 90, 150, 210]

/** Un eclat qui part de l'anneau, une fois par produit. */
function sparkKeyframe(angle: number, distance: number) {
  const radians = (angle * Math.PI) / 180
  const x = Math.cos(radians) * distance
  const y = Math.sin(radians) * distance
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateX: x * 0.55 }, { translateY: y * 0.55 }, { scale: 0.4 }] },
    35: { opacity: 1, transform: [{ translateX: x * 0.85 }, { translateY: y * 0.85 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
    100: { opacity: 0, transform: [{ translateX: x }, { translateY: y }, { scale: 0.6 }], easing: Easing.out(Easing.quad) },
  })
    .duration(720)
    .delay(120)
}

/** Analyse : le produit compris en vedette, un seul a la fois, dans un anneau qui tourne. */
export function AnalysisSpot({ current, compact }: { current: SpotItem; compact: boolean }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const ring = compact ? 112 : 136
  const disc = compact ? 84 : 104
  const missing = current?.kind === "missing"
  const accent = missing ? palette.orange500 : palette.voiceCyan
  const key = current?.key ?? "wave"
  const sparks = useMemo(() => SPARK_ANGLES.map((angle) => sparkKeyframe(angle, ring / 2 + 16)), [ring])
  const nameSize = compact ? 22 : 26
  const nameLine = compact ? 26 : 30

  return (
    <View accessibilityLiveRegion="polite" style={{ flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: 14, paddingTop: 8, paddingBottom: 12 }}>
      <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            { position: "absolute", top: 0, left: 0, width: ring, height: ring, borderRadius: ring / 2, backgroundColor: missing ? "rgba(240, 124, 0, 0.18)" : "rgba(80, 220, 230, 0.16)" },
            reducedMotion ? null : { animationName: BREATHE, animationDuration: "1800ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" },
          ]}
        />
        <Animated.View
          style={[
            { position: "absolute", top: 4, left: 4, width: ring - 8, height: ring - 8, borderRadius: (ring - 8) / 2, borderWidth: 3, borderColor: "rgba(255, 255, 255, 0.1)", borderTopColor: accent, borderRightColor: missing ? "rgba(240, 124, 0, 0.4)" : "rgba(80, 220, 230, 0.4)" },
            reducedMotion ? null : { animationName: SPIN, animationDuration: "1100ms", animationIterationCount: "infinite", animationTimingFunction: "linear" },
          ]}
        />
        {current && !reducedMotion ? (
          <>
            <Animated.View
              key={`pulse-${key}`}
              entering={PULSE}
              pointerEvents="none"
              style={{ position: "absolute", width: ring, height: ring, borderRadius: ring / 2, borderWidth: 2, borderColor: accent, opacity: 0 }}
            />
            {sparks.map((spark, index) => (
              <Animated.View
                key={`spark-${key}-${index}`}
                entering={spark}
                pointerEvents="none"
                style={{ position: "absolute", width: index % 2 ? 5 : 7, height: index % 2 ? 5 : 7, borderRadius: 4, backgroundColor: index % 3 === 0 ? palette.mint300 : accent, opacity: 0 }}
              />
            ))}
          </>
        ) : null}
        <Animated.View
          key={`disc-${key}`}
          entering={reducedMotion ? FadeIn.duration(200) : DISC_IN}
          exiting={reducedMotion ? FadeOut.duration(150) : DISC_OUT}
          style={{ position: "absolute", width: disc, height: disc, borderRadius: disc / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: missing ? palette.orange500 : palette.cream, boxShadow: "0 14px 30px -12px rgba(0, 0, 0, 0.6)" }}
        >
          {current?.kind === "item" ? (
            <ProductImage uri={current.image} variant="inset" style={{ width: disc, height: disc }} />
          ) : missing ? (
            <Info size={compact ? 32 : 40} color={palette.ink900} strokeWidth={2} />
          ) : (
            <LinearGradient colors={[palette.voiceCyan, palette.voiceTeal]} start={{ x: 0.3, y: 0.2 }} end={{ x: 0.8, y: 1 }} style={{ width: disc, height: disc, alignItems: "center", justifyContent: "center" }}>
              <Wave size={disc} />
            </LinearGradient>
          )}
        </Animated.View>
      </View>
      {/* Hauteur fixe : le texte qui part et celui qui arrive se croisent sans faire sauter l'ecran. */}
      <View style={{ alignSelf: "stretch", height: nameLine + 24, alignItems: "center" }}>
        <Animated.View
          key={`text-${key}`}
          entering={reducedMotion ? FadeIn.duration(200) : TEXT_IN}
          exiting={reducedMotion ? FadeOut.duration(150) : TEXT_OUT}
          style={{ position: "absolute", left: 0, right: 0, alignItems: "center", gap: 2, paddingHorizontal: 8 }}
        >
          <Text weight="black" color={palette.white} align="center" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: nameSize, lineHeight: nameLine, letterSpacing: -0.5 }}>
            {current ? current.name : t("Je comprends votre liste…")}
          </Text>
          <Text weight="bold" numeric color={missing ? "#FFC27A" : palette.mint300} align="center" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
            {current?.kind === "item" ? current.detail : missing ? t("Pas au marché de SOUKI") : t("Darija et français pris en charge.")}
          </Text>
        </Animated.View>
      </View>
    </View>
  )
}

/** En-tete de fin : liste prete (coche) ou pas compris (orbe orange). */
export function VoiceHeader({ tone, title, detail, compact }: { tone: "done" | "error"; title: string; detail: string; compact: boolean }) {
  const reducedMotion = useReducedMotion()
  const error = tone === "error"
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: compact ? 12 : 18 }}>
      <Animated.View entering={reducedMotion ? undefined : ZoomIn.springify().damping(14).stiffness(220)} style={{ width: 64, height: 64, borderRadius: 32, overflow: "hidden", boxShadow: error ? undefined : "0 0 0 1px rgba(80, 220, 230, 0.45), 0 12px 30px -10px rgba(80, 220, 230, 0.6)" }}>
        <LinearGradient
          colors={error ? ["#FFD08A", palette.orange500] : [palette.voiceCyan, palette.voiceTeal]}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          {error ? <AlertTriangle size={26} color={palette.ink900} strokeWidth={2.6} /> : <Check size={26} color={palette.forest900} strokeWidth={3} />}
        </LinearGradient>
      </Animated.View>
      <View style={{ flex: 1, gap: 3 }} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" weight="black" color={palette.white} style={{ fontSize: 18, lineHeight: 22, letterSpacing: -0.2 }}>
          {title}
        </Text>
        <Text weight="semibold" color={palette.mint300} style={{ fontSize: 12, lineHeight: 16 }}>
          {detail}
        </Text>
      </View>
    </View>
  )
}

/** Plateau « Votre panier » : feuille creme en bas de la scene. */
export function VoiceSheet({ title, caption, total, fill, maxHeight, bottomInset, children }: { title: string; caption: string; total: number; fill: boolean; maxHeight?: number; bottomInset: number; children: ReactNode }) {
  return (
    <View
      style={{
        marginHorizontal: -20,
        marginTop: fill ? 18 : 0,
        flex: fill ? 1 : undefined,
        minHeight: 0,
        maxHeight: fill ? undefined : maxHeight,
        paddingTop: 10,
        paddingHorizontal: 16,
        paddingBottom: bottomInset,
        gap: 10,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderCurve: "continuous",
        backgroundColor: palette.cream,
        boxShadow: "0 -18px 40px -20px rgba(0, 0, 0, 0.5)",
      }}
    >
      <View style={{ alignSelf: "center", width: 36, height: 5, borderRadius: 3, backgroundColor: palette.line }} />
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 1 }}>
          <Text weight="black" color={palette.ink900} style={{ fontSize: 18 }}>
            {title}
          </Text>
          <Text weight="bold" numeric color={palette.ink500} numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
            {caption}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr" }}>
          <AnimatedDigits value={formatTotal(total)} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30 }} />
          <Text weight="black" color={palette.souki900} style={{ fontSize: 12 }}>
            {" DH"}
          </Text>
        </View>
      </View>
      {children}
    </View>
  )
}

function formatTotal(value: number) {
  return (Math.round(value * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/** Une vignette tombe dans le plateau (sk-va-in : -22 pt, 0,92, ressort), apres le disque. */
const CHIP_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -22 }, { scale: 0.92 }] },
  65: { opacity: 1, transform: [{ translateY: 3 }, { scale: 1.04 }], easing: Easing.out(Easing.cubic) },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.inOut(Easing.quad) },
})
  .duration(420)
  .delay(260)

export type TrayChip = { key: string; image: string | null; label: string; missing?: boolean }

/** Pendant l'analyse : une vignette de 44 pt par produit compris (quantite dessous). */
export function VoiceTray({ chips }: { chips: TrayChip[] }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  if (chips.length === 0) {
    return (
      <View style={{ minHeight: 64, justifyContent: "center" }}>
        <Text weight="semibold" color={palette.ink500} style={{ fontSize: 13 }}>
          {t("Vos produits arrivent ici, un par un.")}
        </Text>
      </View>
    )
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, minHeight: 64, alignItems: "flex-start" }}>
      {chips.map((chip) => (
        <Animated.View key={chip.key} entering={reducedMotion ? FadeIn.duration(150) : CHIP_IN} style={{ width: 44, alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              borderCurve: "continuous",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: palette.white,
              boxShadow: chip.missing ? `inset 0 0 0 1.5px ${palette.orange500}` : shadows.card,
            }}
          >
            {chip.missing || !chip.image ? <Info size={18} color={palette.orange700} strokeWidth={2.2} /> : <ProductImage uri={chip.image} variant="inset" style={{ width: 44, height: 44 }} />}
          </View>
          <Text weight="heavy" numeric color={chip.missing ? palette.orange700 : palette.ink700} numberOfLines={1} style={{ fontSize: 10, lineHeight: 12 }}>
            {chip.label}
          </Text>
        </Animated.View>
      ))}
    </ScrollView>
  )
}

export type ListRow = { key: string; name: string; words: string; image: string; quantity: number; quantityLabel: string; price: string; unit: string; step: number }

/** Liste prete : photo, nom, mots dits entre guillemets, quantite, prix ; toucher une ligne l'ouvre. */
export function VoiceRow({ row, index, open, onToggle, onChange }: { row: ListRow; index: number; open: boolean; onToggle: () => void; onChange: (quantity: number) => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.delay(index * 45).springify().damping(16)}
      style={{ borderRadius: 16, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: open ? `inset 0 0 0 2px ${palette.market600}, ${shadows.card}` : shadows.card }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${row.name}, ${row.quantityLabel}, ${row.price}. ${t("Modifier")}`}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, paddingStart: 7, paddingEnd: 10, opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", backgroundColor: palette.photoBg }}>
          <ProductImage uri={row.image} variant="inset" style={{ width: 40, height: 40 }} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text weight="heavy" color={palette.ink900} numberOfLines={1} style={{ fontSize: 14 }}>
            {row.name}
          </Text>
          {row.words ? (
            <Text weight="semibold" color={palette.ink500} numberOfLines={1} style={{ fontSize: 11, fontStyle: "italic" }}>
              {`« ${row.words} »`}
            </Text>
          ) : null}
        </View>
        <View style={{ minHeight: 28, flexDirection: "row", alignItems: "center", gap: 3, paddingStart: 10, paddingEnd: 7, borderRadius: radius.pill, backgroundColor: palette.section }}>
          <Text weight="heavy" numeric color={palette.souki900} style={{ fontSize: 13 }}>
            {row.quantityLabel}
          </Text>
          <ChevronDown size={13} color={palette.souki900} strokeWidth={3} />
        </View>
        <Text weight="black" numeric color={palette.market700} style={{ fontSize: 14 }}>
          {row.price}
        </Text>
      </Pressable>
      {open ? (
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(200)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingStart: 6, paddingEnd: 8, paddingBottom: 8 }}>
          <Pressable
            onPress={() => onChange(0)}
            accessibilityRole="button"
            accessibilityLabel={`${t("Retirer")} ${row.name}`}
            style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: radius.pill, opacity: pressed ? 0.6 : 1 })}
          >
            <Trash2 size={15} color={palette.red600} strokeWidth={2.4} />
            <Text weight="heavy" color={palette.red600} style={{ fontSize: 13 }}>
              {t("Retirer")}
            </Text>
          </Pressable>
          <QuantityStepper size="small" removable={false} quantity={row.quantity} step={row.step} unit={row.unit} onChange={onChange} />
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

/** Mot hors marche : signale, jamais ignore. */
export function MissingRow({ name, index }: { name: string; index: number }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.delay(index * 45).springify().damping(16)}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 7, borderRadius: 16, borderCurve: "continuous", backgroundColor: palette.orange50 }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: palette.white }}>
        <Info size={18} color={palette.orange700} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="heavy" color={palette.ink900} style={{ fontSize: 14 }}>
          {name}
        </Text>
        <Text weight="semibold" color={palette.orange700} style={{ fontSize: 11, lineHeight: 15 }}>
          {t("SOUKI vend les fruits, légumes et herbes du marché.")}
        </Text>
      </View>
    </Animated.View>
  )
}

/** « Pas compris » : deux exemples de phrases. */
export function VoiceHelp() {
  const { t, locale } = useLocale()
  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      <Text weight="heavy" color={palette.mint300} style={{ fontSize: 12, letterSpacing: locale === "ar" ? 0 : 0.7, textTransform: locale === "ar" ? "none" : "uppercase" }}>
        {t("Essayez par exemple")}
      </Text>
      {["« 2 kilo maticha w kilo batata »", t("« Un kilo de carottes et deux bottes de menthe »")].map((example) => (
        <View key={example} style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderCurve: "continuous", backgroundColor: "rgba(255, 255, 255, 0.08)" }}>
          <Text weight="bold" color={palette.white} style={{ fontSize: 15 }}>
            {example}
          </Text>
        </View>
      ))}
    </View>
  )
}
