import { useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { Check, CircleAlert } from "lucide-react-native"

import { AuthScreen, TextLink } from "@/components/auth-screen"
import { Note, OtpInput } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError, resendOtp, verifyOtp } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

/** « Renvoyer le code » attend 60 s (comme le site). */
const RESEND_SECONDS = 60

/**
 * Entree, « Vérifiez votre e-mail » (AuthFlow « code ») : 6 cases, iOS propose le code recu par
 * Mail au-dessus du clavier, la verification part seule au 6e chiffre. Compte cree : le jeton est
 * garde (session ouverte) et l'onboarding s'ouvre aussitot, pour chaque nouveau compte.
 */
export default function VerificationScreen() {
  const params = useLocalSearchParams<{ userId: string; channel?: string; target?: string }>()
  const { t } = useLocale()
  const closeAuth = useCloseAuth()
  const router = useRouter()
  const { acceptToken } = useAuth()
  const userId = Number(params.userId)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [done, setDone] = useState(false)
  const [wait, setWait] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (wait <= 0 || done) return
    const timer = setTimeout(() => setWait((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait, done])

  const check = async (value: string) => {
    if (checking) return
    setChecking(true)
    setError(null)
    try {
      const result = await verifyOtp(userId, value, params.channel)
      if (result.access_token) await acceptToken(result.access_token)
      haptics.success()
      setDone(true)
      // « Compte créé » un instant, puis l'onboarding (nouveau compte : toujours).
      setTimeout(() => router.replace("/bienvenue"), 700)
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status !== 400 ? t(caught.message) : t("Code incorrect. Vérifiez-le ou demandez-en un nouveau."))
    } finally {
      setChecking(false)
    }
  }

  const resend = async () => {
    try {
      const result = await resendOtp(userId, params.channel)
      setWait(result.resend_available_in_seconds ?? RESEND_SECONDS)
      setCode("")
      setError(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? t(caught.message) : t("Impossible d'envoyer un nouveau code pour le moment."))
    }
  }

  const minutes = Math.floor(wait / 60)
  const seconds = String(wait % 60).padStart(2, "0")

  return (
    <AuthScreen
      onBack={() => router.back()}
      onClose={closeAuth}
      title={t("Vérifiez votre e-mail")}
      subtitle={
        <>
          {t("Saisissez le code à 6 chiffres envoyé à ")}
          <Text variant="body" weight="bold" color={palette.ink900} style={{ fontSize: 15 }}>
            {params.target || t("votre adresse")}
          </Text>
          .
        </>
      }
    >
      <OtpInput value={code} onChange={setCode} onComplete={(value) => void check(value)} error={Boolean(error)} done={done} />
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CircleAlert size={14} color={palette.red600} strokeWidth={2.4} />
          <Text variant="footnote" weight="semibold" color={palette.red600} style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
      {done ? (
        <Note icon={Check}>{t("Compte créé. Quelques réglages et c'est parti.")}</Note>
      ) : (
        <>
          <View style={{ alignItems: "center" }}>
            {wait > 0 ? (
              <Text variant="callout" weight="heavy" numeric color={palette.ink500} style={{ fontSize: 14, minHeight: 44, lineHeight: 44 }}>
                {t("Renvoyer le code dans {temps}", { temps: `${minutes}:${seconds}` })}
              </Text>
            ) : (
              <TextLink label={t("Renvoyer le code")} onPress={() => void resend()} />
            )}
          </View>
        </>
      )}
    </AuthScreen>
  )
}
