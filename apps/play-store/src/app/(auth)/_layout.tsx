import { Stack } from "expo-router"

import { colors } from "@/theme"

/**
 * Parcours de compte en plein ecran modal (EcranConnexion / EcranInscription) : connexion,
 * inscription en 3 etapes, code OTP, mot de passe oublie. Chaque ecran dessine son retour.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
}
