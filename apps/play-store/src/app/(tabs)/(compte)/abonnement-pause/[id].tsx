import { useState } from "react"
import { Pressable, View } from "react-native"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Pause } from "lucide-react-native"
import { isoDatePlusDays } from "@souki/shared"

import { BrandButton } from "@/components/brand-button"
import { Note } from "@/components/form-fields"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { useUpdateRecurrenceCache } from "@/hooks/use-loyalty"
import { ApiError, pauseRecurrence } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/** Reprise proposee dans 1 a 4 semaines (le serveur accepte une date entre J+2 et J+90). */
const WEEKS = [1, 2, 3, 4] as const

/**
 * Mettre en pause un abonnement (EcranAbonnements > Mettre en pause, design system 2027) :
 * feuille native avec la date de reprise en boutons, « Aucune commande n'est créée pendant la
 * pause. », « Valider la pause » et « Annuler ».
 */
export default function PauseSheet() {
  const router = useRouter()
  const { t, dateLocale, direction } = useLocale()
  const insets = useSafeAreaInsets()
  const updateCache = useUpdateRecurrenceCache()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [choice, setChoice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dates = WEEKS.map((weeks) => isoDatePlusDays(weeks * 7))
  const short = (iso: string) =>
    new Intl.DateTimeFormat(dateLocale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`))

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      updateCache(await pauseRecurrence(Number(id), dates[choice]))
      haptics.success()
      router.back()
    } catch (caught) {
      haptics.error()
      setError(caught instanceof ApiError ? t(caught.message) : t("Une erreur est survenue. Réessayez."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, direction, padding: 20, paddingTop: 28, paddingBottom: Math.max(insets.bottom, 16), gap: 14 }}>
      <Text accessibilityRole="header" variant="title2" weight="black" color={palette.ink900} style={{ fontSize: 22 }}>
        {t("Mettre en pause")}
      </Text>
      <Text variant="footnote" weight="bold" color={palette.ink500} style={{ fontSize: 13 }}>
        {t("Reprendre le")}
      </Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {dates.map((date, index) => {
          const active = index === choice
          return (
            <Pressable
              key={date}
              onPress={() => {
                if (active) return
                haptics.selection()
                setChoice(index)
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => ({
                width: "48%",
                flexGrow: 1,
                alignItems: "center",
                gap: 2,
                paddingVertical: 10,
                paddingHorizontal: 6,
                borderRadius: 16,
                borderCurve: "continuous",
                backgroundColor: active ? palette.souki900 : palette.white,
                borderWidth: active ? 0 : 1.5,
                borderColor: palette.line,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text variant="callout" weight="heavy" color={active ? palette.white : palette.ink900} style={{ fontSize: 14 }}>
                {short(date)}
              </Text>
              <Text variant="footnote" weight="semibold" color={active ? palette.mint300 : palette.ink500} style={{ fontSize: 11 }}>
                {t(WEEKS[index] === 1 ? "dans 1 semaine" : "dans {n} semaines", { n: WEEKS[index] })}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Note icon={Pause}>{t("Aucune commande n'est créée pendant la pause.")}</Note>
      {error ? <Note tone="red">{error}</Note> : null}
      <View style={{ flex: 1 }} />
      <BrandButton label={saving ? t("Enregistrement…") : t("Valider la pause")} disabled={saving} onPress={() => void confirm()} />
      <BrandButton tone="ghost" size="md" label={t("Annuler")} onPress={() => router.back()} />
    </View>
  )
}
