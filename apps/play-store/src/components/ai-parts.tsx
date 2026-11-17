import { useEffect, useState, type ComponentRef, type ReactNode, type RefObject } from "react"
import { KeyboardAvoidingView, Pressable, ScrollView, View } from "react-native"
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChevronLeft, ChevronRight, Sparkles, X, type LucideIcon } from "lucide-react-native"
import { formatDirhams, formatPriceUnit, type CatalogueProduct } from "@souki/shared"

import { AnimatedDigits } from "@/components/animated-digits"
import { ProductImage } from "@/components/product-image"
import { QuantityStepper } from "@/components/quantity-stepper"
import { Skeleton } from "@/components/skeleton"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, DUR_SLOW, EASE_OUT_2027 } from "@/lib/motion"
import { colors, palette, radius, shadows, scene } from "@/theme"

const MASCOT = require("../../assets/illustrations/recolte-fermier.svg")

/* ---------- Gabarit plein ecran : barre du haut, contenu, dock ---------- */

type AssistantFrameProps = {
  title: string
  /** Bouton retour (etape precedente) au lieu de fermer. */
  onBack?: () => void
  onClose: () => void
  dock?: ReactNode
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>
  children: ReactNode
}

/** Ecrans IA en plein ecran modal (prototype `screens-ia.js`) : fermer ou retour, titre centre. */
export function AssistantFrame({ title, onBack, onClose, dock, scrollRef, children }: AssistantFrameProps) {
  const { t, isRtl, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const Back = isRtl ? ChevronRight : ChevronLeft
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", backgroundColor: palette.glass, boxShadow: `0 1px 0 ${palette.line}`, zIndex: 2 }}>
        <RoundIcon icon={onBack ? Back : X} label={onBack ? t("Retour") : t("Fermer")} onPress={onBack ?? onClose} />
        <Text accessibilityRole="header" variant="headline" weight="heavy" color={palette.ink900} align="center" numberOfLines={1} style={{ flex: 1, fontSize: 17 }}>
          {title}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 28, flexGrow: 1 }}>
        {children}
      </ScrollView>
      {dock ? <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>{dock}</View> : null}
    </KeyboardAvoidingView>
  )
}

export function RoundIcon({ icon: Icon, label, onPress, dark = false }: { icon: LucideIcon; label: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={4} style={({ pressed }) => ({ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "rgba(255, 255, 255, 0.12)" : palette.sand }}>
        <Icon size={18} color={dark ? scene.white : scene.ink900} strokeWidth={2.6} />
      </View>
    </Pressable>
  )
}

/* ---------- En-tete vert (sk-ai-hero) ---------- */

export function AiHero({ icon: Icon, title, detail, spark = false }: { icon: LucideIcon; title: string; detail: string; spark?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" }}>
      <LinearGradient colors={[scene.souki900, scene.forest800]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: 64, height: 64, borderRadius: 22, borderCurve: "continuous", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 255, 255, 0.14)" }}>
        <Icon size={28} color={scene.white} strokeWidth={2} />
        {spark ? (
          <View style={{ position: "absolute", top: -5, end: -5, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: scene.yellow400, borderWidth: 3, borderColor: scene.souki900 }}>
            <Sparkles size={9} color={scene.ink900} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline" weight="black" color={scene.white} style={{ fontSize: 17 }}>
          {title}
        </Text>
        <Text variant="footnote" weight="semibold" color={scene.mint300} style={{ fontSize: 12, lineHeight: 16 }}>
          {detail}
        </Text>
      </View>
    </View>
  )
}

/** Libelle d'un champ (sk-field-row). */
export function FieldRow({ label, extra, children }: { label: string; extra?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="footnote" weight="bold" color={palette.ink700} style={{ fontSize: 13, paddingStart: 4 }}>
        {label}
        {extra ? (
          <Text variant="footnote" weight="medium" color={palette.ink500} style={{ fontSize: 13 }}>
            {` ${extra}`}
          </Text>
        ) : null}
      </Text>
      {children}
    </View>
  )
}

/* ---------- ChoiceChips ---------- */

/** Choix unique en pastilles sur une ligne qui defile. Haptique `selection`. */
export function ChoiceChips<T extends string | number>({ value, options, onChange, label, disabled = false }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string; disabled?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={label} contentContainerStyle={{ gap: 6, paddingHorizontal: 2 }} style={{ marginHorizontal: -2, opacity: disabled ? 0.45 : 1 }}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            key={String(option.value)}
            disabled={disabled}
            onPress={() => {
              if (active) return
              haptics.selection()
              onChange(option.value)
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => ({
              height: 36,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              justifyContent: "center",
              backgroundColor: active ? palette.souki900 : palette.white,
              borderWidth: active ? 0 : 1.5,
              borderColor: palette.line,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text variant="footnote" weight="bold" numeric color={active ? palette.white : palette.ink700} style={{ fontSize: 13 }}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/* ---------- DishRow ---------- */

/** Plat marocain (ou « Équilibré ») en carte radio : nom, darija en italique, personnes. */
export function DishRow({ icon: Icon, name, darija, servings, selected, onPress }: { icon: LucideIcon; name: string; darija: string; servings?: number; selected: boolean; onPress: () => void }) {
  const { t } = useLocale()
  return (
    <Pressable
      onPress={() => {
        if (!selected) haptics.selection()
        onPress()
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: selected ? palette.pale50 : palette.white,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? palette.souki900 : palette.line,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: palette.orange50 }}>
        <Icon size={20} color={palette.orange700} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="heavy" color={palette.ink900} numberOfLines={2} style={{ fontSize: 15 }}>
          {name}
        </Text>
        <Text variant="footnote" weight="medium" color={palette.ink500} numberOfLines={1} style={{ fontSize: 12, fontStyle: "italic" }}>
          {servings ? `${darija} · ${t("{n} pers.", { n: servings })}` : darija}
        </Text>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? palette.souki900 : palette.ink300, alignItems: "center", justifyContent: "center" }}>
        {selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.souki900 }} /> : null}
      </View>
    </Pressable>
  )
}

/* ---------- BudgetMeter ---------- */

/** Budget utilise par le panier suggere : montant qui roule, budget, barre market-600. */
export function BudgetMeter({ used, budget, caption }: { used: number; budget: number; caption: string }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const share = useSharedValue(0)
  const [width, setWidth] = useState(0)
  const ratio = budget > 0 ? Math.min(1, used / budget) : 0
  useEffect(() => {
    share.set(reducedMotion ? ratio : withTiming(ratio, { duration: DUR_SLOW, easing: EASE_OUT_2027 }))
  }, [ratio, reducedMotion, share])
  const fill = useAnimatedStyle(() => ({ width: width * share.get() }))
  return (
    <View
      accessible
      accessibilityLabel={t("{used} DH sur {budget} DH", { used: formatDirhams(used), budget: formatDirhams(budget) })}
      style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", direction: "ltr" }}>
          <AnimatedDigits value={formatDirhams(used)} weight="black" color={palette.souki900} style={{ fontSize: 24, lineHeight: 30 }} />
          <Text variant="footnote" weight="semibold" color={palette.ink500} style={{ fontSize: 13 }}>
            {` ${t("DH sur {budget} DH", { budget: formatDirhams(budget) })}`}
          </Text>
        </View>
        <Text variant="footnote" weight="heavy" color={palette.market700} style={{ fontSize: 12, flexShrink: 1 }}>
          {caption}
        </Text>
      </View>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 8, borderRadius: 4, backgroundColor: palette.green100, overflow: "hidden" }}>
        <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: palette.market600 }, fill]} />
      </View>
    </View>
  )
}

/* ---------- Ligne suggeree modifiable ---------- */

type SuggestedLineProps = {
  index: number
  product: CatalogueProduct | null
  name: string
  unit: string
  unitPrice: number
  image: string
  quantity: number
  note?: string | null
  onChange: (quantity: number) => void
}

/** Ligne du panier propose (image 60, nom, prix du jour, quantite) ; entree en cascade (40 ms). */
export function SuggestedLine({ index, product, name, unit, unitPrice, image, quantity, note, onChange }: SuggestedLineProps) {
  const { locale } = useLocale()
  const reducedMotion = useReducedMotion()
  const step = product?.quantityStep ?? (unit === "kg" ? 0.5 : 1)
  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).delay(index * 40).easing(EASE_OUT_2027)}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.card, borderCurve: "continuous", backgroundColor: palette.white, boxShadow: shadows.card }}
    >
      <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", backgroundColor: palette.photoBg }}>
        <ProductImage uri={product?.image ?? image} variant="inset" style={{ width: 60, height: 60 }} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="callout" weight="bold" color={palette.ink900} numberOfLines={1} style={{ fontSize: 15 }}>
          {name}
        </Text>
        <Text variant="footnote" weight="semibold" numeric color={palette.ink500} style={{ fontSize: 12 }}>
          {`${formatDirhams(unitPrice)} DH / ${formatPriceUnit(unit, locale)}`}
        </Text>
        {note ? (
          <Text variant="footnote" weight="semibold" color={palette.orange700} numberOfLines={2} style={{ fontSize: 12 }}>
            {note}
          </Text>
        ) : null}
      </View>
      <QuantityStepper size="small" quantity={quantity} step={step} unit={unit} onChange={onChange} />
    </Animated.View>
  )
}

/* ---------- Generation en cours ---------- */

const FLOAT = {
  "0%": { transform: [{ translateY: 0 }] },
  "50%": { transform: [{ translateY: -6 }] },
  "100%": { transform: [{ translateY: 0 }] },
} as const

/** Souki qui flotte, texte du site et squelettes des lignes. */
export function Generating({ title, detail }: { title: string; detail: string }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 14 }}>
      <View style={{ alignItems: "center", gap: 10, paddingTop: 18 }}>
        <Animated.View style={reducedMotion ? undefined : { animationName: FLOAT, animationDuration: "2400ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }}>
          <Image source={MASCOT} style={{ width: 130, height: 150 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
        </Animated.View>
        <Text variant="title2" weight="black" color={palette.ink900} align="center" style={{ fontSize: 20 }}>
          {title}
        </Text>
        <Text variant="callout" color={palette.ink500} align="center" style={{ fontSize: 14, maxWidth: 280 }}>
          {detail}
        </Text>
      </View>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.card, backgroundColor: palette.white }}>
          <Skeleton width={60} height={60} radius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={14} radius={7} />
            <Skeleton width="35%" height={12} radius={6} />
          </View>
        </View>
      ))}
    </View>
  )
}
