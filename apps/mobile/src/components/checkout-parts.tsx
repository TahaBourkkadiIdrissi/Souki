import { useEffect, useRef, useState, type ReactNode } from "react"
import { Pressable, View, type LayoutChangeEvent } from "react-native"
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import { Check, Truck, type LucideIcon } from "lucide-react-native"
import {
  DELIVERY_TIME_MAX,
  DELIVERY_TIME_MIN,
  DELIVERY_TIME_PRESETS,
  DELIVERY_TIME_STEP,
  minutesToLabel,
} from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { ProductImage } from "@/components/product-image"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, DUR_FAST, EASE_OUT_2027, SPRING_FINGER } from "@/lib/motion"
import { palette, radius, shadows } from "@/theme"

/* ---------- Carte et ligne du checkout (sk-co-card, sk-co-line) ---------- */

/** Carte blanche du checkout ; `title` en eyebrow avec, a droite, « Modifier ». */
export function CheckoutCard({ title, onEdit, editLabel, children }: { title?: string; onEdit?: () => void; editLabel?: string; children: ReactNode }) {
  const { t } = useLocale()
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 }}>
          <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 13 }}>
            {title}
          </Text>
          {onEdit ? (
            <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${editLabel ?? t("Modifier")} · ${title}`} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text variant="callout" weight="heavy" color={palette.market700} style={{ fontSize: 14 }}>
                {editLabel ?? t("Modifier")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}

/** Ligne icone + texte + petite ligne grise (adresse, date, paiement). `dark` sur la confirmation. */
export function CheckoutLine({ icon: Icon, title, detail, dark = false }: { icon: LucideIcon; title: string; detail?: string; dark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: dark ? "rgba(255, 255, 255, 0.14)" : palette.pale50 }}>
        <Icon size={18} color={dark ? palette.white : palette.souki900} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="callout" weight="bold" color={dark ? palette.white : palette.ink900} style={{ fontSize: 15, lineHeight: 20 }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" color={dark ? palette.mint300 : palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/** Vignettes rondes qui se chevauchent (sk-thumbs) : 4 photos puis « +N ». */
export function ThumbStack({ images }: { images: string[] }) {
  const shown = images.slice(0, 4)
  const more = images.length - shown.length
  const bubble = { width: 40, height: 40, borderRadius: 20, overflow: "hidden" as const, backgroundColor: palette.photoBg, boxShadow: `0 0 0 3px ${palette.white}`, alignItems: "center" as const, justifyContent: "center" as const }
  return (
    <View style={{ flexDirection: "row" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {shown.map((uri, index) => (
        <View key={`${uri}-${index}`} style={[bubble, { marginStart: index === 0 ? 0 : -10 }]}>
          <ProductImage uri={uri} variant="inset" style={{ width: 40, height: 40 }} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[bubble, { marginStart: -10 }]}>
          <Text variant="footnote" weight="black" numeric color={palette.souki900} style={{ fontSize: 12 }}>
            {`+${more}`}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/* ---------- TimeSlider : heure exacte entre 08h00 et 15h00 ---------- */

const THUMB = 36
const TRACK_INSET = 14
const TICKS = [8, 10, 12, 14, 15]

/**
 * Heure de livraison exacte (TimeSlider, design system 2027) : 08h00 a 15h00 par pas de
 * 30 min, raccourcis 8h, 10h, 12h, 14h du site. L'heure roule, le camion glisse en ressort,
 * haptique `selection` a chaque pas. VoiceOver : curseur reglable qui lit « 10h00 ».
 * L'axe des heures reste de gauche a droite, comme les chiffres, en arabe aussi.
 */
export function TimeSlider({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const [width, setWidth] = useState(0)
  const progress = useSharedValue((value - DELIVERY_TIME_MIN) / (DELIVERY_TIME_MAX - DELIVERY_TIME_MIN))
  const trackWidth = useSharedValue(0)
  const last = useRef(value)
  last.current = value

  useEffect(() => {
    const target = (value - DELIVERY_TIME_MIN) / (DELIVERY_TIME_MAX - DELIVERY_TIME_MIN)
    progress.value = reducedMotion ? withTiming(target, { duration: 0 }) : withSpring(target, SPRING_FINGER)
  }, [value, reducedMotion, progress])

  const set = (minutes: number) => {
    const clamped = Math.min(DELIVERY_TIME_MAX, Math.max(DELIVERY_TIME_MIN, minutes))
    if (clamped === last.current) return
    last.current = clamped
    haptics.selection()
    onChange(clamped)
  }

  const fromX = (x: number) => {
    if (width <= 0) return
    const ratio = Math.min(1, Math.max(0, x / width))
    const raw = DELIVERY_TIME_MIN + ratio * (DELIVERY_TIME_MAX - DELIVERY_TIME_MIN)
    set(Math.round(raw / DELIVERY_TIME_STEP) * DELIVERY_TIME_STEP)
  }

  // Glisser horizontalement regle l'heure ; un glissement vertical laisse defiler l'ecran.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onStart((event) => fromX(event.x))
    .onUpdate((event) => fromX(event.x))
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => fromX(event.x))
  const gesture = Gesture.Race(pan, tap)

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width)
    trackWidth.value = event.nativeEvent.layout.width
  }
  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * trackWidth.value }))
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * trackWidth.value - THUMB / 2 }] }))

  const label = minutesToLabel(value)

  return (
    <View style={{ padding: 18, gap: 18, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}>
      <View style={{ alignItems: "center", gap: 2 }}>
        <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 11 }}>
          {t("Livraison prévue vers")}
        </Text>
        <AnimatedDigits value={label} weight="black" color={palette.souki900} style={{ fontSize: 52, lineHeight: 58, letterSpacing: -2 }} />
      </View>

      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t("Heure de livraison souhaitée")}
          accessibilityValue={{ text: label }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => set(value + (event.nativeEvent.actionName === "increment" ? DELIVERY_TIME_STEP : -DELIVERY_TIME_STEP))}
          style={{ height: 56, marginHorizontal: TRACK_INSET, direction: "ltr" }}
        >
          {/* Zone de toucher plus large que la regle (le pouce deborde de chaque cote). */}
          <View onLayout={onLayout} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 56 }}>
            <View style={{ position: "absolute", top: 14, left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: palette.green100, overflow: "hidden" }}>
              <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: palette.market600 }, fillStyle]} />
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: palette.souki900,
                  boxShadow: `0 0 0 4px ${palette.white}, ${shadows.button}`,
                },
                thumbStyle,
              ]}
            >
              <Truck size={16} color={palette.white} strokeWidth={2.4} />
            </Animated.View>
            {width > 0
              ? TICKS.map((hour) => (
                  <Text
                    key={hour}
                    variant="footnote"
                    weight="bold"
                    numeric
                    color={palette.ink500}
                    style={{ position: "absolute", top: 40, left: ((hour * 60 - DELIVERY_TIME_MIN) / (DELIVERY_TIME_MAX - DELIVERY_TIME_MIN)) * width - 12, width: 24, textAlign: "center", fontSize: 11, lineHeight: 14 }}
                  >
                    {`${hour}h`}
                  </Text>
                ))
              : null}
          </View>
        </View>
      </GestureDetector>

      <View style={{ flexDirection: "row", gap: 6, direction: "ltr" }}>
        {DELIVERY_TIME_PRESETS.map((preset) => {
          const active = value === preset
          return (
            <Pressable
              key={preset}
              onPress={() => set(preset)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => ({
                flex: 1,
                height: 40,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? palette.souki900 : "transparent",
                borderWidth: active ? 0 : 1.5,
                borderColor: palette.line,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text variant="callout" weight="heavy" numeric color={active ? palette.white : palette.ink700} style={{ fontSize: 14 }}>
                {minutesToLabel(preset)}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/* ---------- PaymentOption : carte radio ---------- */

type PaymentOptionProps = {
  icon: LucideIcon
  title: string
  desc?: string
  badge?: string
  trailing?: string
  selected: boolean
  disabled?: boolean
  onSelect?: () => void
  /** Affiche sous la carte quand elle est choisie (credit Wallet). */
  children?: ReactNode
}

/**
 * Option de paiement (PaymentOption, design system 2027) : carte radio, contour souki-900 de
 * 2 pt et icone pleine quand elle est choisie ; indisponible, elle reste visible, grisee,
 * avec sa raison en clair. Haptique `selection`.
 */
export function PaymentOption({ icon: Icon, title, desc, badge, trailing, selected, disabled = false, onSelect, children }: PaymentOptionProps) {
  const reducedMotion = useReducedMotion()
  return (
    <View
      style={{
        borderRadius: 20,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: disabled ? palette.sand : palette.white,
        borderWidth: disabled ? 0 : selected ? 2 : 1.5,
        borderColor: selected ? palette.souki900 : palette.line,
        boxShadow: selected ? shadows.card : undefined,
      }}
    >
      <Pressable
        onPress={() => {
          if (disabled || selected) return
          haptics.selection()
          onSelect?.()
        }}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={[title, badge, desc, trailing].filter(Boolean).join(". ")}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, minHeight: 72, opacity: pressed && !disabled ? 0.85 : 1 })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: disabled ? palette.white : selected ? palette.souki900 : palette.pale50,
          }}
        >
          <Icon size={22} color={disabled ? palette.ink500 : selected ? palette.white : palette.souki900} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <Text variant="callout" weight="heavy" color={disabled ? palette.ink500 : palette.ink900} style={{ fontSize: 15 }}>
              {title}
            </Text>
            {badge ? (
              <View style={{ height: 20, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center", backgroundColor: disabled ? palette.white : palette.sand }}>
                <Text variant="eyebrow" color={palette.ink500} style={{ fontSize: 10 }}>
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          {desc ? (
            <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 12, lineHeight: 16 }}>
              {desc}
            </Text>
          ) : null}
        </View>
        {trailing ? (
          <Text variant="callout" weight="black" numeric color={disabled ? palette.ink500 : palette.market700} style={{ fontSize: 14 }}>
            {trailing}
          </Text>
        ) : null}
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? palette.souki900 : palette.ink300, alignItems: "center", justifyContent: "center" }}>
          {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.souki900 }} /> : null}
        </View>
      </Pressable>
      {selected && children ? (
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(DUR_BASE).easing(EASE_OUT_2027)} style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 10 }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  )
}

/** Ligne verte pale a l'interieur d'une option (sk-pay-row) : texte + controle. */
export function PaymentRow({ title, detail, control }: { title: string; detail?: string; control: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderCurve: "continuous", backgroundColor: palette.pale50 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="footnote" weight="semibold" color={palette.souki900} style={{ fontSize: 13, lineHeight: 17 }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 13, lineHeight: 17 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      {control}
    </View>
  )
}

/* ---------- Checkbox ---------- */

/**
 * Case a cocher de 24 pt (zone de 44 pt), cochee en souki-900. `children` est le libelle ;
 * un lien s'y met en <Text> imbrique (gras market-700).
 */
export function Checkbox({ checked, onChange, children, accessibilityLabel }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; accessibilityLabel: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, paddingTop: 10 }}>
      <Pressable
        onPress={() => {
          haptics.selection()
          onChange(!checked)
        }}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
      >
        <Animated.View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: checked ? palette.souki900 : "transparent",
            borderWidth: checked ? 0 : 2,
            borderColor: palette.ink300,
            transitionProperty: "backgroundColor",
            transitionDuration: DUR_FAST,
          }}
        >
          {checked ? <Check size={15} color={palette.white} strokeWidth={3.2} /> : null}
        </Animated.View>
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

/* ---------- Celebration : pluie de feuilles et de pastilles ---------- */

const CELEBRATION_COLORS = [palette.leaf500, palette.fresh500, palette.yellow400, palette.orange500, palette.mint300]

/** Images cles creees une fois : une piece tombe de 1000 pt en tournant (sk-fall). */
const FALL_KEYFRAMES = Array.from({ length: 26 }, (_, index) => ({
  "0%": { opacity: 1, transform: [{ translateY: 0 }, { rotate: "0deg" }] },
  "100%": { opacity: 0.2, transform: [{ translateY: 1000 }, { rotate: `${(index * 47) % 360}deg` }] },
}))

/**
 * Pluie de feuilles et de pastilles aux couleurs de la marque (Celebration) : une seule fois,
 * 2 a 3 s, pour la commande validee et le compte active. Absente en mouvement reduit.
 */
export function Celebration({ count = 26 }: { count?: number }) {
  const reducedMotion = useReducedMotion()
  if (reducedMotion) return null
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", zIndex: 1 }}>
      {FALL_KEYFRAMES.slice(0, count).map((keyframes, index) => {
        const leaf = index % 3 !== 0
        const size = leaf ? 14 : 8
        return (
          <Animated.View
            key={index}
            style={{
              position: "absolute",
              top: -20,
              left: `${(index * 37) % 100}%`,
              width: size,
              height: size,
              borderRadius: leaf ? 0 : 4,
              borderTopRightRadius: leaf ? 14 : 4,
              borderBottomLeftRadius: leaf ? 14 : 4,
              backgroundColor: CELEBRATION_COLORS[index % CELEBRATION_COLORS.length],
              animationName: keyframes,
              animationDuration: `${1800 + ((index * 131) % 1200)}ms`,
              animationDelay: `${(index * 83) % 900}ms`,
              animationTimingFunction: "linear",
              animationFillMode: "both",
            }}
          />
        )
      })}
    </View>
  )
}
