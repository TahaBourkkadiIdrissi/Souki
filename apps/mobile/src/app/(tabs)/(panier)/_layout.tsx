import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { tabStackScreenOptions } from "@/navigation/header-fallback"
import { productScreenOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "panier" }

/** Onglet Panier : le panier et la fiche des produits qu'il contient. */
export default function PanierStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackScreenOptions("panier", "/panier")}>
      <Stack.Screen name="panier" options={{ title: t("Panier") }} />
      <Stack.Screen name="produit/[slug]" options={productScreenOptions} />
    </Stack>
  )
}
