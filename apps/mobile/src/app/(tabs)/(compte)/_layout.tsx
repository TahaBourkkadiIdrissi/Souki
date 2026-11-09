import { Stack } from "expo-router"

import { useLocale } from "@/contexts/locale-context"
import { tabStackScreenOptions } from "@/navigation/header-fallback"
import { productScreenOptions } from "@/navigation/stack-options"

export const unstable_settings = { anchor: "compte" }

/** Onglet Compte : invite ou connecte, profil, adresse, securite, notifications, favoris. */
export default function CompteStack() {
  const { t } = useLocale()
  return (
    <Stack screenOptions={tabStackScreenOptions("compte", "/compte")}>
      <Stack.Screen name="compte" options={{ title: t("Compte") }} />
      <Stack.Screen name="favoris" options={{ title: t("Favoris") }} />
      <Stack.Screen name="profil" options={{ title: t("Profil"), headerLargeTitleEnabled: false }} />
      <Stack.Screen name="adresse" options={{ headerShown: false }} />
      <Stack.Screen name="securite" options={{ title: t("Sécurité") }} />
      <Stack.Screen name="changer-mot-de-passe" options={{ title: t("Mot de passe"), headerLargeTitleEnabled: false }} />
      <Stack.Screen name="supprimer-compte" options={{ title: t("Supprimer le compte") }} />
      <Stack.Screen name="notifications" options={{ title: t("Notifications") }} />
      <Stack.Screen name="wallet" options={{ title: t("Wallet SOUKI") }} />
      <Stack.Screen name="parrainage" options={{ headerShown: false }} />
      <Stack.Screen name="abonnements" options={{ title: t("Abonnements") }} />
      <Stack.Screen name="abonnement/[id]" options={{ title: "", headerLargeTitleEnabled: false }} />
      {/* Mettre en pause : feuille native (iOS 15+). */}
      <Stack.Screen name="abonnement-pause/[id]" options={{ presentation: "formSheet", headerShown: false, sheetAllowedDetents: [0.62, 1], sheetGrabberVisible: true, sheetCornerRadius: 28 }} />
      <Stack.Screen name="produit/[slug]" options={productScreenOptions} />
    </Stack>
  )
}
