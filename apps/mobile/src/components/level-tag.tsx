import { View } from "react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette } from "@/theme"

export type ProductLevel = 1 | 2 | 3

/**
 * Niveaux des produits (champ `niveau` du back-end). Titres neutres : ce ne sont pas des
 * classements de popularite. Couleurs : 1 souki-900, 2 orange-500 avec encre, 3 yellow-400 avec encre.
 */
export const LEVELS: Record<ProductLevel, { title: string; subtitle: string; color: string; ink: string; background: string }> = {
  1: { title: "Les essentiels", subtitle: "La base de vos courses de la semaine", color: palette.souki900, ink: palette.white, background: palette.pale50 },
  2: { title: "Pour varier", subtitle: "Légumes et fruits pour varier les repas", color: palette.orange500, ink: palette.ink900, background: palette.orange50 },
  3: { title: "Les petits plus", subtitle: "Herbes, citrons et saveurs", color: palette.yellow400, ink: palette.ink900, background: "#FFF8DC" },
}

export function isProductLevel(value: unknown): value is ProductLevel {
  return value === 1 || value === 2 || value === 3
}

/** Pastille numerotee seule (titres de rail). */
export function LevelDisc({ level, size = 26 }: { level: ProductLevel; size?: number }) {
  const spec = LEVELS[level]
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: spec.color, alignItems: "center", justifyContent: "center" }}
    >
      <Text variant="eyebrow" weight="black" numeric color={spec.ink} style={{ fontSize: size * 0.46, lineHeight: size * 0.6, letterSpacing: 0 }}>
        {String(level)}
      </Text>
    </View>
  )
}

/** Pastille de niveau complete (« ① Les essentiels ») : fiche produit, etageres. */
export function LevelTag({ level }: { level: ProductLevel }) {
  const { t } = useLocale()
  const spec = LEVELS[level]
  return (
    <View
      accessible
      accessibilityLabel={`${t("Niveau {n}", { n: level })} : ${t(spec.title)}`}
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 26, paddingStart: 4, paddingEnd: 10, borderRadius: 999, backgroundColor: spec.background }}
    >
      <LevelDisc level={level} size={18} />
      <Text variant="footnote" weight="heavy" color={palette.ink900} style={{ fontSize: 12, lineHeight: 16 }}>
        {t(spec.title)}
      </Text>
    </View>
  )
}
