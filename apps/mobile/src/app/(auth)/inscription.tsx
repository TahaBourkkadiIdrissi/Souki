import { useState } from "react"
import { Alert, Linking, View } from "react-native"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { Gift, Lock } from "lucide-react-native"
import { passwordIsValid } from "@souki/shared"

import { AuthScreen, EmailChip, TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, PasswordRules, TextField } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError, register } from "@/lib/api"
import { SITE_URL } from "@/lib/config"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

/**
 * Entree, nouveau compte (AuthFlow « create ») : l'e-mail en rappel, un mot de passe avec les
 * regles du site (iOS propose un mot de passe fort), « J'ai un code de parrainage » replie,
 * « Créer mon compte » -> code a 6 chiffres recu par e-mail -> onboarding. Plus de long
 * formulaire : prenom, adresse et telephone sont demandes dans l'onboarding, s'ils manquent.
 */
export default function InscriptionScreen() {
  const router = useRouter()
  const closeAuth = useCloseAuth()
  const { t } = useLocale()
  const { email = "" } = useLocalSearchParams<{ email?: string }>()
  const [password, setPassword] = useState("")
  const [referralOpen, setReferralOpen] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Ouvert sans adresse (ancien lien « S'inscrire ») : l'entree commence par l'e-mail.
  if (!email) return <Redirect href="/email" />

  const strong = passwordIsValid(password)

  const submit = async () => {
    if (!strong || loading) return
    setError(null)
    setLoading(true)
    try {
      const result = await register({ email, password, role: "CLIENT", code_parrainage: referralCode.trim().toUpperCase() || undefined })
      haptics.selection()
      router.replace({
        pathname: "/verification",
        params: { userId: String(result.id), channel: result.verification_channel ?? "email", target: result.verification_target ?? email },
      })
    } catch (caught) {
      haptics.error()
      if (caught instanceof ApiError) setError(t(caught.message))
      else Alert.alert(t("Pas de connexion internet"), t("Vérifiez votre connexion internet."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthScreen
      onBack={() => router.back()}
      onClose={closeAuth}
      title={t("Créons votre compte")}
      subtitle={t("Aucun compte SOUKI avec cette adresse. Choisissez un mot de passe.")}
    >
      <EmailChip value={email} onEdit={() => router.back()} />
      <TextField
        label={t("Mot de passe")}
        icon={Lock}
        secure
        value={password}
        onChangeText={(text) => {
          setPassword(text)
          setError(null)
        }}
        textContentType="newPassword"
        autoComplete="new-password"
        passwordRules="minlength: 8; required: upper; required: digit;"
        autoFocus
        returnKeyType="done"
      />
      <PasswordRules value={password} />
      {referralOpen ? (
        <TextField
          label={t("Code de parrainage")}
          optional={t("(optionnel)")}
          icon={Gift}
          value={referralCode}
          onChangeText={setReferralCode}
          placeholder={t("Ex : K7M2P9")}
          autoCapitalize="characters"
          autoCorrect={false}
          help={t("Vous recevrez 15 DH sur votre Wallet SOUKI à votre 1re commande livrée.")}
          autoFocus
        />
      ) : (
        <View style={{ alignItems: "flex-start" }}>
          <TextLink label={t("J'ai un code de parrainage")} onPress={() => setReferralOpen(true)} />
        </View>
      )}
      {error ? <Note tone="red">{error}</Note> : null}
      <BrandButton label={loading ? t("Création…") : t("Créer mon compte")} disabled={!strong || loading} onPress={() => void submit()} />
      <Text color={palette.ink500} align="center" style={{ fontSize: 12, lineHeight: 17 }}>
        {t("En continuant, vous acceptez la ")}
        <Text weight="bold" color={palette.ink700} accessibilityRole="link" onPress={() => void Linking.openURL(`${SITE_URL}/politique-confidentialite`)} style={{ fontSize: 12, textDecorationLine: "underline" }}>
          {t("Politique de confidentialité")}
        </Text>
        .
      </Text>
    </AuthScreen>
  )
}
