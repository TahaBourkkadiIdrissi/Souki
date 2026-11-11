import { Pressable } from "react-native"
import { useRouter, type Href, type NativeStackNavigationOptions } from "expo-router"
import { ChevronLeft, ChevronRight } from "lucide-react-native"

import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

import { tabStackOptions } from "./stack-options"

/**
 * Retour de secours : chevron dessine a la place du retour natif, qui revient a l'ecran
 * principal de l'onglet (Commandes, Compte…) avec l'animation de retour (`dismissTo`).
 */
function FallbackBack({ home }: { home: Href }) {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const Icon = isRtl ? ChevronRight : ChevronLeft
  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        router.dismissTo(home)
      }}
      accessibilityRole="button"
      accessibilityLabel={t("Retour")}
      hitSlop={8}
      style={({ pressed }) => ({ width: 36, height: 44, alignItems: "flex-start", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}
    >
      <Icon size={28} color={palette.green900} strokeWidth={2.4} />
    </Pressable>
  )
}

type StackScreenProps = {
  route: { key?: string; name: string }
  navigation: { getState: () => { routes: { key: string }[] } }
}

/**
 * Options des piles d'onglets avec un filet de securite : une page de detail ouverte seule
 * dans sa pile (par exemple le suivi ouvert depuis « Commande validée » alors que l'onglet
 * Commandes n'a jamais ete ouvert) n'aurait aucun bouton retour, et le dock est cache sur
 * certaines pages. Elle recoit alors un retour vers l'ecran principal de l'onglet. Les autres
 * pages gardent le retour natif d'iOS, sans changement.
 */
export function tabStackScreenOptions(anchor: string, home: Href) {
  return ({ route, navigation }: StackScreenProps): NativeStackNavigationOptions => {
    const isFirst = route.key !== undefined && navigation.getState().routes[0]?.key === route.key
    if (!isFirst || route.name === anchor) return tabStackOptions
    return { ...tabStackOptions, headerLeft: () => <FallbackBack home={home} /> }
  }
}
