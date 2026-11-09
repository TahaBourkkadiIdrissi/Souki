import { useEffect, useState } from "react"
import { View } from "react-native"
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated"
import { Image } from "expo-image"
import { useLocalSearchParams } from "expo-router"
import { CircleAlert } from "lucide-react-native"

import { AuthScreen, TextLink } from "@/components/auth-screen"
import { BrandButton } from "@/components/brand-button"
import { Note, OtpInput } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { useCloseAuth } from "@/hooks/use-close-auth"
import { ApiError, resendOtp, verifyOtp } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { DUR_SLOW } from "@/lib/motion"
import { palette } from "@/theme"

const CELEBRATION = require("../../../assets/illustrations/checkout-celebration.webp")
/** « Renvoyer le code » attend 60 s (comme le site). */
const RESEND_SECONDS = 60

/**
 * Verification du compte (code OTP, design system 2027) : 6 cases, le code recu par SMS se
 * propose au-dessus du clavier, la verification part seule au 6e chiffre. Compte active :
 * illustration de fete et haptique de succes ; le jeton est garde, la session est ouverte.
 */
export default function VerificationScreen() {
  const params = useLocalSearchParams<{ userId: string; channel?: string; target?: string }>()
  const { t } = useLocale()
  const reducedMotion = useReducedMotion()
  const closeAuth = useCloseAuth()
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
      backLabel={t("Inscription")}
      onBack={closeAuth}
      step={done ? undefined : { current: 3, total: 3, label: t("Vérification") }}
      title={done ? t("Compte activé") : t("Vérification du compte")}
      subtitle={
        done ? (
          t("Votre compte SOUKI est prêt. Bienvenue !")
        ) : (
          <>
            {t("Saisissez le code OTP à 6 chiffres envoyé au ")}
            <Text variant="body" weight="bold" numeric color={palette.ink900} style={{ fontSize: 15 }}>
              {params.target || t("contact indiqué")}
            </Text>
            .
          </>
        )
      }
      dock={done ? <BrandButton label={t("Continuer mes courses")} onPress={closeAuth} /> : null}
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
        <Animated.View entering={reducedMotion ? undefined : FadeIn.duration(DUR_SLOW)} style={{ alignItems: "center", marginTop: 10 }}>
          <Image source={CELEBRATION} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityIgnoresInvertColors />
        </Animated.View>
      ) : (
        <>
          <Note>{t("Le compte restera inactif tant que le code n'est pas confirmé.")}</Note>
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
