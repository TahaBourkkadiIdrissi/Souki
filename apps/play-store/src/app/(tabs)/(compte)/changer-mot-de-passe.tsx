import { useState } from "react"
import { KeyboardAvoidingView, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Lock } from "lucide-react-native"
import { passwordIsValid } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note, PasswordRules, TextField } from "@/components/form-fields"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, changePassword } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors } from "@/theme"

/**
 * Changer le mot de passe (Securite) : mot de passe actuel, nouveau avec les regles cochees en
 * direct, confirmation. « Enregistrer » reste desactive tant que tout n'est pas rempli.
 */
export default function ChangerMotDePasseScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const mismatch = confirm.length > 0 && confirm !== next
  const ready = current.length > 0 && passwordIsValid(next) && confirm === next

  const save = async () => {
    setError(null)
    setSaving(true)
    try {
      await changePassword({ current_password: current, new_password: next, confirm_password: confirm })
      haptics.success()
      router.back()
    } catch (caught) {
      setError(caught instanceof ApiError ? t(caught.message) : t("Enregistrement impossible. Vérifiez votre connexion internet."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>
        <TextField label={t("Mot de passe actuel")} icon={Lock} secure value={current} onChangeText={setCurrent} textContentType="password" />
        <TextField label={t("Nouveau mot de passe")} icon={Lock} secure value={next} onChangeText={setNext} textContentType="newPassword" autoComplete="new-password" />
        <PasswordRules value={next} />
        <TextField
          label={t("Confirmer le mot de passe")}
          icon={Lock}
          secure
          value={confirm}
          onChangeText={setConfirm}
          textContentType="newPassword"
          placeholder={t("Retapez le mot de passe")}
          error={mismatch ? t("Les mots de passe ne correspondent pas.") : null}
        />
        {error ? <Note tone="red">{error}</Note> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <BrandButton label={saving ? t("Enregistrement…") : t("Enregistrer")} disabled={!ready || saving} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  )
}
