import type { LucideIcon } from "lucide-react-native"
import { ActivityIndicator, View } from "react-native"

import { AnimatedDigits } from "@/components/animated-digits"
import { PressableScale } from "@/components/pressable-scale"
import { Text } from "@/components/text"
import { brand, m3, radius, sizes, states, withAlpha } from "@/theme"

export type BrandButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Action en cours : roue à la place de l'icône, bouton inactif. */
  loading?: boolean
  icon?: LucideIcon
  /**
   * `primary` : bouton rempli, la seule action principale de l'écran ; `soft` : tonal (action
   * secondaire) ; `outline` : contour ; `light` et `ghostLight` : uniquement sur l'en-tête vert
   * ou la scène vocale ; `ink` : sur orange ; `ghost` : bouton texte (« Tout voir ») ;
   * `danger` : supprimer.
   */
  tone?: "primary" | "light" | "soft" | "outline" | "ink" | "ghost" | "ghostLight" | "danger"
  /** Pleine largeur (par défaut) ou ajusté au texte. */
  fill?: boolean
  /** `lg` 56 dp (par défaut), `md` 48 dp, `sm` 40 dp (zone de toucher gardée à 48 dp). */
  size?: "lg" | "md" | "sm"
  /** L'icône avant (par défaut) ou après le libellé (flèche « continuer »). */
  iconPosition?: "start" | "end"
  /** Montant affiché après un séparateur ; le montant est toujours dans le bouton. */
  trailing?: string
  accessibilityLabel?: string
}

/** Couleurs lues au rendu : elles suivent le thème clair ou sombre. */
function toneColors(tone: NonNullable<BrandButtonProps["tone"]>) {
  switch (tone) {
    case "primary":
      return { background: m3.primary, foreground: m3.onPrimary, border: undefined }
    case "soft":
      return { background: m3.primaryContainer, foreground: m3.onPrimaryContainer, border: undefined }
    case "outline":
      return { background: "transparent", foreground: m3.primary, border: m3.outline }
    case "light":
      return { background: brand.onDark, foreground: brand.souki900, border: undefined }
    case "ghostLight":
      return { background: "transparent", foreground: brand.onDark, border: undefined }
    case "ink":
      return { background: brand.ink, foreground: brand.onDark, border: undefined }
    case "ghost":
      return { background: "transparent", foreground: m3.secondary, border: undefined }
    case "danger":
      return { background: m3.error, foreground: m3.onError, border: undefined }
  }
}

const HEIGHTS = { lg: sizes.controlLg, md: sizes.controlMd, sm: 40 } as const

/**
 * Bouton SOUKI Android (fiche Button du design system) : coins de 12 dp (décision 7), libellé
 * title-medium, icône Lucide, ripple de la couleur du contenu et enfoncement 0,97. Désactivé :
 * conteneur à 12 % et contenu à 38 %, avec un libellé qui dit pourquoi (« Validation dès 8h »).
 */
export function BrandButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon: Icon,
  tone = "primary",
  fill = true,
  size = "lg",
  iconPosition = "start",
  trailing,
  accessibilityLabel,
}: BrandButtonProps) {
  const inactive = disabled || loading
  const base = toneColors(tone)
  // Désactivé : conteneur opaque (le bouton peut flotter au-dessus du contenu qui défile) et contenu à 38 %.
  const foreground = disabled ? withAlpha(m3.onSurface, states.disabledContent) : base.foreground
  const background = disabled && base.background !== "transparent" ? m3.surfaceContainerHighest : base.background
  const height = HEIGHTS[size]
  const hitSlop = height < sizes.touchMin ? (sizes.touchMin - height) / 2 : undefined
  const iconSize = size === "sm" ? 18 : 20

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (trailing ? `${label}, ${trailing}` : label)}
      accessibilityState={{ disabled: inactive, busy: loading }}
      android_ripple={{ color: withAlpha(base.foreground, states.pressed + 0.06) }}
      containerStyle={{ alignSelf: fill ? "stretch" : "flex-start", borderRadius: radius.control, overflow: "hidden" }}
      style={{ borderRadius: radius.control }}
    >
      <View
        style={{
          minHeight: height,
          paddingHorizontal: size === "sm" ? 16 : 24,
          borderRadius: radius.control,
          borderWidth: base.border ? 1 : 0,
          borderColor: disabled ? withAlpha(m3.onSurface, states.disabledContainer) : base.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: background,
        }}
      >
        {loading ? <ActivityIndicator size="small" color={foreground} /> : null}
        {!loading && Icon && iconPosition === "start" ? <Icon size={iconSize} color={foreground} strokeWidth={2.2} /> : null}
        <Text variant={size === "sm" ? "labelLarge" : "headline"} color={foreground} numberOfLines={1} maxFontSizeMultiplier={1.6}>
          {label}
        </Text>
        {trailing ? (
          <>
            <View style={{ width: 1, height: 18, backgroundColor: foreground, opacity: 0.3 }} />
            <AnimatedDigits value={trailing} variant="headline" weight="bold" color={foreground} />
          </>
        ) : null}
        {!loading && Icon && iconPosition === "end" ? <Icon size={iconSize} color={foreground} strokeWidth={2.2} /> : null}
      </View>
    </PressableScale>
  )
}
