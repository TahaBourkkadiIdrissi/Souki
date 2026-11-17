import { Pressable } from "react-native"
import { useRouter, type Href, type NativeStackNavigationOptions } from "expo-router"
import { ArrowLeft, ArrowRight } from "lucide-react-native"

import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { m3, withAlpha } from "@/theme"

import { tabStackOptions } from "./stack-options"

/**
 * Retour de secours : flèche Android dessinée à la place du retour natif, qui revient a l'ecran
 * principal de l'onglet (Commandes, Compte…) avec l'animation de retour (`dismissTo`).
 */
function FallbackBack({ home }: { home: Href }) {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const Icon = isRtl ? ArrowRight : ArrowLeft
  return (
    <Pressable
      onPress={() => {
        haptics.selection()
        router.dismissTo(home)
      }}
      accessibilityRole="button"
      accessibilityLabel={t("Retour")}
      android_ripple={{ color: withAlpha(m3.onSurface, 0.12), borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}
    >
      <Icon size={24} color={m3.onSurface} strokeWidth={2} />
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
    const options = tabStackOptions()
    if (!isFirst || route.name === anchor) return options
    return { ...options, headerLeft: () => <FallbackBack home={home} /> }
  }
}
