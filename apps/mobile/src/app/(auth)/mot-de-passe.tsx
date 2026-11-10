import { useState } from "react"
import { Alert, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Info, Lock } from "lucide-react-native"

import { AuthScreen, EmailChip, TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { SocialButton } from "@/components/social-buttons"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

/**
 * Entree, compte existant (AuthFlow « password ») : l'e-mail en rappel (« Modifier »), le mot de
 * passe (le trousseau iCloud le propose), « Mot de passe oublié ? » -> accueil, sans onboarding.
 * Compte cree avec Google, sans mot de passe : on le dit et on propose Google.
 * Le prenom n'est pas affiche : la route B12 ne le donne pas (rien a un inconnu).
 */
export default function MotDePasseScreen() {
  const router = useRouter()
  const closeAuth = useCloseAuth()
  const { t } = useLocale()
  const { signIn } = useAuth()
  const { login = "", google, unknown } = useLocalSearchParams<{ login?: string; google?: string; unknown?: string }>()
  const googleOnly = google === "1"
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!password || loading) return
    setError(null)
    setLoading(true)
    try {
      await signIn(login, password)
      haptics.success()
      closeAuth()
    } catch (caught) {
      haptics.error()
      if (caught instanceof ApiError) setError(caught.status === 401 ? t("Mot de passe incorrect.") : t(caught.message))
      else Alert.alert(t("Pas de connexion internet"), t("Vérifiez votre connexion internet."))
    } finally {
      setLoading(false)
    }
  }

  const comingSoon = () =>
    Alert.alert(t("Bientôt disponible"), t("La connexion avec {provider} arrive avec la prochaine version de l'app. Continuez avec votre e-mail.", { provider: "Google" }))

  return (
    <AuthScreen
      onBack={() => router.back()}
      onClose={closeAuth}
      title={t("Bon retour 👋")}
      subtitle={googleOnly ? t("Ce compte a été créé avec Google.") : t("Entrez votre mot de passe pour continuer.")}
    >
      <EmailChip value={login} onEdit={() => router.back()} />
      {googleOnly ? (
        <>
          <Note icon={Info}>{t("Ce compte n'a pas de mot de passe. Continuez avec Google, ou créez un mot de passe avec « Mot de passe oublié ? ».")}</Note>
          <SocialButton provider="google" label={t("Continuer avec Google")} onPress={comingSoon} />
        </>
      ) : (
        <>
          <TextField
            label={t("Mot de passe")}
            icon={Lock}
            secure
            value={password}
            onChangeText={(text) => {
              setPassword(text)
              setError(null)
            }}
            textContentType="password"
            autoComplete="current-password"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            error={error}
          />
          <BrandButton label={loading ? t("Connexion…") : t("Se connecter")} disabled={!password || loading} onPress={() => void submit()} />
        </>
      )}
      <View style={{ alignItems: "center" }}>
        <TextLink label={t("Mot de passe oublié ?")} onPress={() => router.push("/mot-de-passe-oublie")} />
      </View>
      {unknown === "1" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", columnGap: 4 }}>
          <Text variant="callout" weight="medium" color={palette.ink500} style={{ fontSize: 14 }}>
            {t("Pas encore de compte ?")}
          </Text>
          <TextLink label={t("Créer mon compte")} onPress={() => router.replace({ pathname: "/inscription", params: { email: login } })} />
        </View>
      ) : null}
    </AuthScreen>
  )
}
