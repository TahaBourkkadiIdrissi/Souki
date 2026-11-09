import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { tabStackScreenOptions } from "@/navigation/header-fallback"
import { productScreenOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "marche" }

/** Onglet Marche : accueil (en-tete SOUKI sur mesure), catalogue, fiche produit. */
export default function MarcheStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackScreenOptions("marche", "/marche")}>
      <Stack.Screen name="marche" options={{ title: t("Accueil"), headerShown: false }} />
      <Stack.Screen name="catalogue" options={{ headerShown: false }} />
      <Stack.Screen name="produit/[slug]" options={productScreenOptions} />
    </Stack>
  )
}
