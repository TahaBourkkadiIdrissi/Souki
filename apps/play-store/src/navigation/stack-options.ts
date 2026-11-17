import type { NativeStackNavigationOptions } from "expo-router"

import { colors, fonts, m3 } from "@/theme"

/**
 * Top app bar Material 3 des piles d'onglets : titre title-large aligné au début, flèche de
 * retour Android, fond `surface` sans ombre (la barre prend une teinte au défilement côté natif).
 * Fonction : les couleurs sont lues au rendu, elles suivent le thème clair ou sombre.
 */
export function tabStackOptions(): NativeStackNavigationOptions {
  return {
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    headerTintColor: m3.onSurface,
    headerStyle: { backgroundColor: colors.background },
    headerTitleAlign: "left",
    headerTitleStyle: { fontFamily: fonts.latin.semibold, fontSize: 20, color: m3.onSurface },
    contentStyle: { backgroundColor: colors.background },
    animation: "default",
  }
}

/** Fiche produit : en-tête transparent au-dessus de la grande photo. */
export const productScreenOptions: NativeStackNavigationOptions = {
  headerTransparent: true,
  headerStyle: { backgroundColor: "transparent" },
  title: "",
}
