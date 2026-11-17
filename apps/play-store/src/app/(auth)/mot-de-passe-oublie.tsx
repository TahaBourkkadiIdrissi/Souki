import { useState } from "react"
import { Linking } from "react-native"
import { useRouter } from "expo-router"
import { ArrowLeft, ArrowRight, Mail } from "lucide-react-native"
import { isValidEmail } from "@souki/shared"

import { AuthScreen } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { EmptyState } from "@/components/empty-state"
import { Note, TextField } from "@/components/form-fields"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, requestPasswordReset } from "@/lib/api"

/** a•••••@exemple.ma : on montre a qui le lien est parti sans afficher toute l'adresse. */
function maskEmail(email: string): string {
  const [name, domain] = email.trim().split("@")
  if (!name || !domain) return email
  return `${name.charAt(0)}•••••@${domain}`
}

/**
 * Mot de passe oublie (EcranMotDePasse, design system 2027), par e-mail comme le site :
 * lien valable 15 minutes, rappel des courriers indesirables, « Ouvrir Mail ». Le lien
 * s'ouvre sur souki.io (nouveau mot de passe), qui deconnecte les anciennes sessions.
 */
export default function MotDePasseOublieScreen() {
  const router = useRouter()
  const { t, isRtl } = useLocale()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const Arrow = isRtl ? ArrowLeft : ArrowRight

  const submit = async () => {
    if (!isValidEmail(email)) return setError(t("Format d'email invalide. Veuillez saisir une adresse email correcte (ex: nom@domaine.ma)."))
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (caught) {
      setError(caught instanceof ApiError ? t(caught.message) : t("Envoi impossible. Vérifiez votre connexion internet."))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthScreen
        backLabel={t("Connexion")}
        onBack={() => router.back()}
        dock={<BrandButton tone="soft" icon={Mail} label={t("Ouvrir Mail")} onPress={() => void Linking.openURL("message://")} />}
      >
        <EmptyState
          art="search"
          title={t("Lien envoyé")}
          description={t("Ouvrez l'e-mail envoyé à {email}. Le lien est valable pendant 15 minutes. Pensez à vérifier le dossier des courriers indésirables.", { email: maskEmail(email) })}
        />
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      backLabel={t("Connexion")}
      onBack={() => router.back()}
      title={t("Mot de passe oublié ?")}
      subtitle={t("Saisissez l'adresse e-mail utilisée pour votre compte. Le lien reçu sera valable pendant 15 minutes.")}
      dock={<BrandButton label={loading ? t("Envoi…") : t("Envoyer le lien")} icon={Arrow} iconPosition="end" disabled={loading || !email.trim()} onPress={() => void submit()} />}
    >
      <TextField
        label={t("Adresse e-mail")}
        icon={Mail}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => void submit()}
        error={error}
      />
      <Note>{t("Pensez à vérifier le dossier des courriers indésirables.")}</Note>
    </AuthScreen>
  )
}
