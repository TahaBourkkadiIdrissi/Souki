import type { ReactNode } from "react"
import { Pressable, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native"
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Check, Mic, Search, X } from "lucide-react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { DUR_BASE, EASE_EMPHASIZED } from "@/lib/motion"
import { brand, fonts, m3, radius, scene, shadows, sizes, states, withAlpha } from "@/theme"

/**
 * Composants Material 3 du design system Android (SearchAndChips, Button > FAB, en-têtes).
 * Couleurs lues au rendu : ils suivent le thème clair ou sombre.
 */

/* ---------- Titre d'onglet (top app bar grande, dans le contenu) ---------- */

/** Grand titre d'un onglet (headline-large), sous la barre d'état. `trailing` : action à droite. */
export function ScreenTitle({ title, trailing, style }: { title: string; trailing?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[{ paddingTop: insets.top + 20, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
      <Text accessibilityRole="header" variant="headlineLarge" color={m3.onSurface} numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
      {trailing}
    </View>
  )
}

/* ---------- Barre de recherche ---------- */

type SearchFieldProps = Omit<TextInputProps, "style"> & {
  value: string
  onChangeText: (text: string) => void
  /** Micro à droite quand le champ est vide (ouvre la commande vocale). */
  onVoice?: () => void
  /** Sur l'en-tête vert de l'accueil : champ clair posé sur la scène. */
  onHero?: boolean
  style?: StyleProp<ViewStyle>
}

/** Barre de recherche M3 (56 dp, coins pleins) : loupe, saisie, micro ou effacer. */
export function SearchField({ value, onChangeText, onVoice, onHero = false, style, ...props }: SearchFieldProps) {
  const { t, isRtl } = useLocale()
  const background = onHero ? scene.white : m3.surfaceContainerHigh
  const ink = onHero ? scene.ink900 : m3.onSurface
  const variant = onHero ? scene.ink500 : m3.onSurfaceVariant
  return (
    <View
      style={[
        { minHeight: sizes.controlLg, borderRadius: radius.pill, backgroundColor: background, flexDirection: "row", alignItems: "center", paddingStart: 16, paddingEnd: 4, gap: 12 },
        style,
      ]}
    >
      <Search size={22} color={variant} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={variant}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        enterKeyHint="search"
        selectionColor={onHero ? scene.market600 : m3.motion}
        cursorColor={onHero ? scene.market600 : m3.motion}
        style={{ flex: 1, minHeight: 48, fontFamily: fonts.latin.regular, fontSize: 16, color: ink, textAlign: isRtl ? "right" : "left", paddingVertical: 0 }}
        {...props}
      />
      {value.length > 0 ? (
        <IconButton icon={X} label={t("Effacer")} color={variant} onPress={() => onChangeText("")} />
      ) : onVoice ? (
        <IconButton icon={Mic} label={t("Dicter ma liste")} color={onHero ? scene.souki900 : m3.primary} onPress={onVoice} />
      ) : null}
    </View>
  )
}

/* ---------- Bouton icône ---------- */

/** Bouton icône M3 : 48 dp de zone de toucher, ripple rond, libellé TalkBack obligatoire. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  color = m3.onSurfaceVariant,
  container,
  size = 24,
}: {
  icon: typeof Search
  label: string
  onPress: () => void
  color?: string
  /** Fond tonal (bouton icône rempli). */
  container?: string
  size?: number
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      android_ripple={{ color: withAlpha(color.startsWith("#") ? color : m3.onSurface, states.pressed + 0.04), borderless: !container, radius: 24 }}
      style={{
        width: sizes.touchMin,
        height: sizes.touchMin,
        borderRadius: container ? radius.control : 24,
        overflow: container ? "hidden" : "visible",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: container,
      }}
    >
      <Icon size={size} color={color} strokeWidth={2} />
    </Pressable>
  )
}

/* ---------- Chips de filtre ---------- */

export type ChipOption = { key: string; label: string; count?: number }

/**
 * Chips de filtre M3 (32 dp, coins 8 dp) : contour `outline` au repos, `secondary-container`
 * avec coche quand ils sont choisis. Choix unique. Défilent horizontalement si besoin.
 */
export function FilterChips({ options, selected, onSelect, style }: { options: ChipOption[]; selected: string; onSelect: (key: string) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
    >
      {options.map((option) => {
        const active = option.key === selected
        return (
          <Pressable
            key={option.key}
            onPress={() => {
              if (!active) haptics.selection()
              onSelect(option.key)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={option.count !== undefined ? `${option.label}, ${option.count}` : option.label}
            hitSlop={{ top: 8, bottom: 8 }}
            android_ripple={{ color: withAlpha(m3.onSurface, states.pressed) }}
            style={{
              minHeight: 32,
              paddingStart: active ? 8 : 16,
              paddingEnd: 16,
              borderRadius: radius.xs,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderWidth: active ? 0 : 1,
              borderColor: m3.outline,
              backgroundColor: active ? m3.secondaryContainer : "transparent",
            }}
          >
            {active ? <Check size={18} color={m3.onSecondaryContainer} strokeWidth={2.2} /> : null}
            <Text variant="labelLarge" color={active ? m3.onSecondaryContainer : m3.onSurfaceVariant} maxFontSizeMultiplier={1.5}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </Animated.ScrollView>
  )
}

/* ---------- Bouton vocal flottant ---------- */

/**
 * FAB « Dicter ma liste » (décision 3) : étendu sur l'accueil, réduit à l'icône sur le catalogue
 * et au défilement. Surface vocale (vert forêt), micro cyan, ombre `shadow-float`.
 */
export function VoiceFab({ extended, onPress, bottom }: { extended: boolean; onPress: () => void; bottom: number }) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      layout={reducedMotion ? undefined : LinearTransition.duration(DUR_BASE).easing(EASE_EMPHASIZED)}
      style={{ position: "absolute", end: 16, bottom, borderRadius: radius.tile, boxShadow: shadows.float }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("Dicter ma liste")}
        android_ripple={{ color: withAlpha(scene.voiceCyan, 0.18) }}
        style={{
          minHeight: sizes.controlLg,
          minWidth: sizes.controlLg,
          paddingHorizontal: extended ? 16 : 0,
          paddingEnd: extended ? 20 : 0,
          borderRadius: radius.tile,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          backgroundColor: scene.forest700,
        }}
      >
        <Mic size={24} color={scene.voiceCyan} strokeWidth={2.2} />
        {extended ? (
          <Text variant="labelLarge" color={brand.onDark} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {t("Dicter ma liste")}
          </Text>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}
