import { View } from "react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { m3, radius, scene } from "@/theme"

export type ProductLevel = 1 | 2 | 3

/**
 * Niveaux des produits (champ `niveau` du back-end). Titres neutres : ce ne sont pas des
 * classements de popularite. Couleurs : 1 souki-900, 2 orange-500 avec encre, 3 yellow-400 avec encre.
 */
export const LEVELS: Record<ProductLevel, { title: string; subtitle: string; color: string; ink: string; background: string }> = {
  1: { title: "Les essentiels", subtitle: "La base de vos courses de la semaine", color: scene.souki900, ink: scene.white, background: scene.pale50 },
  2: { title: "Pour varier", subtitle: "Légumes et fruits pour varier les repas", color: scene.orange500, ink: scene.ink900, background: scene.orange50 },
  3: { title: "Les petits plus", subtitle: "Herbes, citrons et saveurs", color: scene.yellow400, ink: scene.ink900, background: "#FFF8DC" },
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

/**
 * Pastille de la fiche produit (« Les essentiels ») : le titre neutre seulement. Le niveau
 * (1, 2, 3) n'est jamais montre au client (demande de Salah eddine, 9 novembre 2026).
 */
export function LevelTag({ level }: { level: ProductLevel }) {
  const { t } = useLocale()
  const spec = LEVELS[level]
  return (
    <View
      accessible
      accessibilityLabel={t(spec.title)}
      // Pastille tonale qui suit le thème (comme les autres pastilles de la fiche) ; le point garde la couleur du niveau.
      style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, minHeight: 22, paddingHorizontal: 6, borderRadius: radius.xxs, backgroundColor: m3.surfaceContainerHigh }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: spec.color }} />
      <Text variant="labelSmall" color={m3.onSurfaceVariant}>
        {t(spec.title)}
      </Text>
    </View>
  )
}
