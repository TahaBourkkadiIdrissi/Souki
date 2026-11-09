import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { tabStackOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "commandes" }

/** Onglet Commandes : historique, suivi, gerer (modifier ou annuler), reclamation, recommander. */
export default function CommandesStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="commandes" options={{ title: t("Commandes") }} />
      <Stack.Screen name="suivi/[id]" options={{ title: t("Suivi de commande") }} />
      <Stack.Screen name="gerer/[id]" options={{ title: t("Gérer ma commande") }} />
      <Stack.Screen name="reclamation/[id]" options={{ title: t("Signaler un problème") }} />
      {/* Feuille native (iOS 15+) : moitie puis plein ecran. */}
      <Stack.Screen
        name="recommander/[id]"
        options={{ presentation: "formSheet", headerShown: false, sheetAllowedDetents: [0.6, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }}
      />
    </Stack>
  )
}
