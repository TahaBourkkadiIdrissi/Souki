import { Redirect, useLocalSearchParams } from "expo-router"

/**
 * Ancienne adresse de l'inscription. Un nouveau compte se cree maintenant dans l'onboarding
 * (`/bienvenue?email=`) : nom, adresse de livraison (exigee par le serveur pour creer le compte),
 * telephone, mot de passe, puis le code recu par e-mail. Sans adresse e-mail, l'entree commence
 * par l'etape « Votre e-mail ».
 */
export default function InscriptionRedirect() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  if (email) return <Redirect href={{ pathname: "/bienvenue", params: { email } }} />
  return <Redirect href="/email" />
}
