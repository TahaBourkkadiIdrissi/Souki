import type { NativeStackNavigationOptions } from "expo-router"

import { colors, fonts, palette } from "@/theme"

/**
 * Options communes des piles d'onglets : grands titres iOS en Poppins ExtraBold vert SOUKI
 * (comme les titres de la PWA), qui se reduisent au defilement ; fond creme de la marque.
 */
export const tabStackOptions: NativeStackNavigationOptions = {
  headerLargeTitleEnabled: true,
  headerLargeTitleShadowVisible: false,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  headerTintColor: palette.green900,
  headerStyle: { backgroundColor: colors.background },
  headerLargeStyle: { backgroundColor: colors.background },
  headerTitleStyle: { fontFamily: fonts.latin.bold, fontSize: 17, color: colors.label },
  headerLargeTitleStyle: { fontFamily: fonts.latin.heavy, fontSize: 32, color: palette.green900 },
  contentStyle: { backgroundColor: colors.background },
}

/** Fiche produit : en-tete transparent au-dessus de la grande photo. */
export const productScreenOptions: NativeStackNavigationOptions = {
  headerLargeTitleEnabled: false,
  headerTransparent: true,
  headerStyle: { backgroundColor: "transparent" },
  title: "",
}
