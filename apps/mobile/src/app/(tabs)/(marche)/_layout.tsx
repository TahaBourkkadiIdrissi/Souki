import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { productScreenOptions, tabStackOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "marche" }

/** Onglet Marche : accueil (en-tete SOUKI sur mesure), catalogue, fiche produit. */
export default function MarcheStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="marche" options={{ title: t("Accueil"), headerShown: false }} />
      <Stack.Screen name="catalogue" options={{ headerShown: false }} />
      <Stack.Screen name="produit/[slug]" options={productScreenOptions} />
    </Stack>
  )
}
