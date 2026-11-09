import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { productScreenOptions, tabStackOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "produits" }

/** Onglet Produits (comme l'onglet « Produits » de la PWA) : tout le marche, rayon par rayon. */
export default function ProduitsStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="produits" options={{ title: t("Produits") }} />
      <Stack.Screen name="produit/[slug]" options={productScreenOptions} />
    </Stack>
  )
}
