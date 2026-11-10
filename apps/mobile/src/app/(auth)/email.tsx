import { useState } from "react"
import { Alert } from "react-native"
import { useRouter } from "expo-router"
import { Mail } from "lucide-react-native"
import { isValidEmail } from "@souki/shared"

import { AuthScreen } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { TextField } from "@/components/form-fields"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError, checkEmail } from "@/lib/api"
import { haptics } from "@/lib/haptics"

/** Un numero marocain (06…, 07…, +212…) : les comptes crees par telephone sur le site. */
function looksLikePhone(value: string) {
  return /^\+?[\d\s-]{9,}$/.test(value.trim())
}

/**
 * Entree, etape « Votre e-mail » (AuthFlow) : un seul champ, puis SOUKI regarde si le compte existe
 * (POST /auth/check-email, B12). Existant -> mot de passe -> accueil ; nouveau -> onboarding, ou
 * l'on donne nom, adresse, telephone et mot de passe, puis le code. Un numero de telephone (compte cree sur le site) va directement au mot de passe.
 */
export default function EmailScreen() {
  const router = useRouter()
  const closeAuth = useCloseAuth()
  const { t } = useLocale()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const login = value.trim()
  const phone = looksLikePhone(login)
  const valid = phone || isValidEmail(login)

  const next = async () => {
    if (!valid || checking) return
    setError(null)
    if (phone) return router.push({ pathname: "/mot-de-passe", params: { login } })
    setChecking(true)
    try {
      const result = await checkEmail(login)
      haptics.selection()
      // Nouveau compte : tout se fait dans l'onboarding (nom, adresse, telephone, mot de passe, code).
      if (!result.exists) router.push({ pathname: "/bienvenue", params: { email: login.toLowerCase() } })
      else router.push({ pathname: "/mot-de-passe", params: { login: login.toLowerCase(), google: result.has_password ? "" : "1" } })
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        // Serveur pas encore a jour (B12) : on propose les deux chemins sur l'ecran du mot de passe.
        router.push({ pathname: "/mot-de-passe", params: { login: login.toLowerCase(), unknown: "1" } })
      } else if (caught instanceof ApiError) {
        haptics.error()
        setError(t(caught.message))
      } else {
        Alert.alert(t("Pas de connexion internet"), t("Vérifiez votre connexion internet."))
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthScreen onBack={() => router.back()} onClose={closeAuth} title={t("Votre e-mail")} subtitle={t("Nous regardons si vous avez déjà un compte SOUKI.")}>
      <TextField
        label={t("E-mail")}
        icon={Mail}
        value={value}
        onChangeText={(text) => {
          setValue(text)
          setError(null)
        }}
        placeholder="nom@exemple.ma"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={() => void next()}
        error={error}
      />
      <BrandButton label={checking ? t("Vérification…") : t("Continuer")} disabled={!valid || checking} onPress={() => void next()} />
    </AuthScreen>
  )
}
