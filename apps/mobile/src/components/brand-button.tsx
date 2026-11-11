import type { LucideIcon } from "lucide-react-native"
import { View } from "react-native"

import { AnimatedDigits } from "@/components/animated-digits"
import { PressableScale } from "@/components/pressable-scale"
import { Text } from "@/components/text"
import { palette, radius, shadows, sizes } from "@/theme"

export type BrandButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
  icon?: LucideIcon
  /**
   * `primary` : souki-900, la seule action principale de l'ecran ; `soft` : action secondaire ;
   * `light` et `ink` : uniquement sur fond sombre ou orange ; `ghost` : « Tout voir » ;
   * `danger` : supprimer.
   */
  tone?: "primary" | "light" | "soft" | "ink" | "ghost" | "ghostLight" | "danger"
  /** Pleine largeur (par defaut) ou ajuste au texte. */
  fill?: boolean
  /** `lg` 56 pt (par defaut), `md` 48 pt, `sm` 36 pt (zone de toucher gardee a 44 pt). */
  size?: "lg" | "md" | "sm"
  /** L'icone avant (par defaut) ou apres le libelle (fleche « continuer »). */
  iconPosition?: "start" | "end"
  /** Montant affiche apres un separateur ; le montant est toujours dans le bouton. */
  trailing?: string
}

/** 2027 : le principal passe en souki-900 (couleur de decision, blanc dessus 8,1:1). */
const TONES = {
  primary: { background: palette.souki900, foreground: palette.white },
  light: { background: palette.white, foreground: palette.souki900 },
  soft: { background: palette.softFill, foreground: palette.souki900 },
  ink: { background: palette.ink900, foreground: palette.white },
  ghost: { background: "transparent", foreground: palette.market700 },
  /** Lien discret sur fond sombre (« Continuer mes courses » de la confirmation). */
  ghostLight: { background: "transparent", foreground: palette.white },
  danger: { background: palette.red600, foreground: palette.white },
} as const

/** Desactive : sable + ink-500, avec un libelle qui dit pourquoi (« Validation dès 8h »). */
const DISABLED = { background: palette.sand, foreground: palette.ink500 } as const

const HEIGHTS = { lg: sizes.controlLg, md: 48, sm: 36 } as const

/** Bouton SOUKI : capsule (56 pt par defaut), libelle `headline`, icone Lucide, enfoncement 0,97 a l'appui. */
export function BrandButton({ label, onPress, disabled = false, icon: Icon, tone = "primary", fill = true, size = "lg", iconPosition = "start", trailing }: BrandButtonProps) {
  const colors = disabled ? DISABLED : TONES[tone]
  const height = HEIGHTS[size]
  // Un bouton visuellement plus petit garde une zone de toucher de 44 pt.
  const hitSlop = height < sizes.touchMin ? (sizes.touchMin - height) / 2 : undefined
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={{
        alignSelf: fill ? "stretch" : "flex-start",
        borderRadius: radius.pill,
        boxShadow: tone === "primary" && !disabled ? shadows.button : undefined,
      }}
    >
      <View
        style={{
          minHeight: height,
          paddingHorizontal: size === "sm" ? 14 : 22,
          borderRadius: radius.pill,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: colors.background,
        }}
      >
        {Icon && iconPosition === "start" ? <Icon size={size === "sm" ? 16 : 18} color={colors.foreground} strokeWidth={size === "sm" ? 2.6 : 2.4} /> : null}
        <Text variant={size === "sm" ? "callout" : "headline"} weight="bold" color={colors.foreground} numberOfLines={1}>
          {label}
        </Text>
        {trailing ? (
          <>
            <View style={{ width: 1, height: 18, backgroundColor: colors.foreground, opacity: 0.3 }} />
            <AnimatedDigits value={trailing} variant="headline" weight="black" color={colors.foreground} />
          </>
        ) : null}
        {Icon && iconPosition === "end" ? <Icon size={size === "sm" ? 16 : 18} color={colors.foreground} strokeWidth={size === "sm" ? 2.6 : 2.4} /> : null}
      </View>
    </PressableScale>
  )
}
