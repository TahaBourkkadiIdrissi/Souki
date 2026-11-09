import { View } from "react-native"
import Animated, { useReducedMotion } from "react-native-reanimated"
import { Image } from "expo-image"

import { BrandButton } from "@/components/brand-button"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, space } from "@/theme"

export type EmptyStateArt = "basket" | "orders" | "favorites" | "search" | "offline"

export type EmptyStateProps = {
  title: string
  description?: string
  art: EmptyStateArt
  action?: { label: string; onPress: () => void }
  /** `primary` (par defaut) ou `soft` pour une action secondaire (« Effacer la recherche »). */
  actionTone?: "primary" | "soft"
}

/** Illustrations de la PWA (apps/client/public/illustrations). */
const ILLUSTRATIONS = {
  basket: require("../../assets/illustrations/empty-basket.webp"),
  orders: require("../../assets/illustrations/empty-orders.webp"),
} as const

/** Souki : le fermier rassure (sans resultat, favoris) ; la tomate pour les erreurs legeres (hors connexion). */
const MASCOTS = {
  favorites: require("../../assets/illustrations/recolte-fermier.svg"),
  search: require("../../assets/illustrations/recolte-fermier.svg"),
  offline: require("../../assets/illustrations/recolte-tomate.svg"),
} as const

const FLOAT = {
  "0%": { transform: [{ translateY: 0 }] },
  "50%": { transform: [{ translateY: -5 }] },
  "100%": { transform: [{ translateY: 0 }] },
} as const

/**
 * Etat vide (EmptyState, design system 2027) : un titre qui dit l'etat, un texte qui dit
 * quoi faire, une action. Souki flotte doucement (immobile en mouvement reduit), ou
 * l'illustration de la PWA pour le panier et les commandes.
 */
export function BrandEmptyState({ title, description, art, action, actionTone = "primary" }: EmptyStateProps) {
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const mascot = art in MASCOTS ? MASCOTS[art as keyof typeof MASCOTS] : null
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: space[12], paddingBottom: 40, gap: 12 }}>
      {mascot ? (
        <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: palette.pale50, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Animated.View
            style={
              reducedMotion
                ? undefined
                : { animationName: FLOAT, animationDuration: "3200ms", animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }
            }
          >
            <Image source={mascot} style={{ width: 92, height: 104 }} contentFit="contain" accessibilityLabel={t("Souki, la mascotte SOUKI")} />
          </Animated.View>
        </View>
      ) : (
        <Image
          source={ILLUSTRATIONS[art as keyof typeof ILLUSTRATIONS]}
          style={{ width: 200, height: 200, borderRadius: 32 }}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />
      )}
      <Text accessibilityRole="header" variant="title2" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="body" color={palette.ink500} align="center">
          {description}
        </Text>
      ) : null}
      {action ? (
        <View style={{ marginTop: 8 }}>
          <BrandButton label={action.label} onPress={action.onPress} tone={actionTone} fill={false} />
        </View>
      ) : null}
    </View>
  )
}
