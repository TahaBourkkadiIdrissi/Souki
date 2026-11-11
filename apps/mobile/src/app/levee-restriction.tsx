import { useState } from "react"
import { KeyboardAvoidingView, ScrollView, View } from "react-native"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Send } from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"
import { Note, TextField } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { ApiError, requestBlacklistLift } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/** Limite de saisie cote app (l'API n'en impose pas). */
const MAX_MOTIF = 1000

/**
 * Demande de levee de la restriction du paiement a la livraison (POST
 * /api/client/blacklist/lift-request), en feuille native au-dessus du checkout. Le checkout
 * relit l'etat de la restriction quand la feuille se ferme.
 */
export default function LeveeRestrictionSheet() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const [motif, setMotif] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const text = motif.trim()
    if (!text) return setError(t("Expliquez la situation avant l'envoi."))
    setSending(true)
    setError(null)
    try {
      await requestBlacklistLift(text)
      haptics.success()
      router.back()
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Vérifiez votre connexion internet."))
    } finally {
      setSending(false)
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, direction }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 12 }}>
        <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 22 }}>
          {t("Demande de levée")}
        </Text>
        <Text variant="body" color={palette.ink500} style={{ fontSize: 15, lineHeight: 21 }}>
          {t("Expliquez la situation pour que SOUKI puisse prendre une décision.")}
        </Text>
        <TextField
          value={motif}
          onChangeText={setMotif}
          placeholder={t("Expliquez la situation...")}
          multiline
          maxLength={MAX_MOTIF}
          autoFocus
          error={error}
        />
        <Note>{t("Le Wallet reste disponible pendant l'examen de votre demande.")}</Note>
      </ScrollView>
      <View style={{ gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <BrandButton icon={Send} label={sending ? t("Envoi…") : t("Envoyer la demande")} disabled={sending || !motif.trim()} onPress={() => void send()} />
        <BrandButton tone="ghost" size="md" label={t("Annuler")} onPress={() => router.back()} />
      </View>
    </KeyboardAvoidingView>
  )
}
