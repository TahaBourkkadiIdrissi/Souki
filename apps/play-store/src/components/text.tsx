import { Text as RNText, type TextProps as RNTextProps } from "react-native"

import { useLocale } from "@/contexts/locale-context"
import { colors, fonts, textVariants, type FontWeightName, type TextVariant } from "@/theme"

export type TextProps = RNTextProps & {
  variant?: TextVariant
  /** Remplace la graisse du style choisi. */
  weight?: FontWeightName
  color?: string
  align?: "auto" | "center" | "start" | "end"
  /** Chiffres tabulaires isoles en LTR (prix, quantites, comptes a rebours). Par defaut selon le style. */
  numeric?: boolean
}

/** IBM Plex Sans Arabic : 1 sp plus grand et interligne +30 % par rapport au latin (tokens.json > Arabe). */
const ARABIC_SIZE_BONUS = 1
const ARABIC_LINE_HEIGHT_RATIO = 1.3

/**
 * Texte SOUKI : Instrument Sans en français, IBM Plex Sans Arabic en arabe, aligné dans le sens de lecture.
 * Les styles chiffres (prix, compte a rebours) passent en chiffres tabulaires et restent
 * en LTR meme en arabe ; les capitales des sur-titres ne s'appliquent qu'en francais.
 * Tout le texte de l'app passe par ce composant.
 */
export function Text({ variant = "body", weight, color = colors.label, align = "start", numeric, style, maxFontSizeMultiplier = 2, ...props }: TextProps) {
  const { locale, isRtl } = useLocale()
  const spec: (typeof textVariants)[TextVariant] & { numeric?: boolean; uppercase?: boolean; letterSpacing?: number } =
    textVariants[variant]
  const arabic = locale === "ar"
  const family = (arabic ? fonts.arabic : fonts.latin)[weight ?? spec.weight]
  const isNumeric = numeric ?? spec.numeric ?? false
  const textAlign =
    align === "center" ? "center" : align === "auto" ? undefined : (align === "start") !== isRtl ? "left" : "right"

  const fontSize = arabic && !isNumeric ? spec.fontSize + ARABIC_SIZE_BONUS : spec.fontSize
  const lineHeight = arabic && !isNumeric ? Math.round(spec.lineHeight * ARABIC_LINE_HEIGHT_RATIO) : spec.lineHeight

  return (
    <RNText
      {...props}
      // Texte agrandi jusqu'à 200 % (réglage Android) : aucune hauteur fixe ne doit le couper.
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          fontFamily: family,
          fontSize,
          lineHeight,
          color,
          textAlign,
          letterSpacing: arabic ? undefined : spec.letterSpacing,
          textTransform: spec.uppercase && !arabic ? "uppercase" : undefined,
        },
        isNumeric ? { fontVariant: ["tabular-nums"], writingDirection: "ltr" } : null,
        style,
      ]}
    />
  )
}
