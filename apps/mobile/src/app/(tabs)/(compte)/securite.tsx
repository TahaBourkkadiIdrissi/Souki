import { useCallback, useState } from "react"
import { ActivityIndicator, Alert, ScrollView, View } from "react-native"
import { useFocusEffect, useRouter } from "expo-router"
import { Laptop, Lock, LogOut, Smartphone, Trash2 } from "lucide-react-native"
import type { SessionDTO } from "@souki/shared"

import { RowButton, RowTag, SettingsGroup, SettingsRow } from "@/components/settings-group"
import { useAuth } from "@/contexts/auth-context"
import { useLocale } from "@/contexts/locale-context"
import { disconnectAllSessions, disconnectSession, fetchSessions } from "@/lib/api"
import { haptics } from "@/lib/haptics"
import { colors, palette } from "@/theme"

/** « il y a 2 jours », « maintenant » : derniere activite d'une session. */
function lastSeen(iso: string | null, t: (key: string, vars?: Record<string, string | number>) => string): string {
  if (!iso) return ""
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  if (minutes < 5) return t("maintenant")
  if (minutes < 60) return t("il y a {n} min", { n: minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t("il y a {n} h", { n: hours })
  return t(Math.round(hours / 24) === 1 ? "il y a {n} jour" : "il y a {n} jours", { n: Math.round(hours / 24) })
}

/**
 * Securite (EcranSecurite, design system 2027) : changer le mot de passe, sessions actives
 * (cet appareil, puis les autres avec « Déconnecter »), zone de danger (deconnexion de tous
 * les appareils, suppression du compte). Memes routes que le site (/api/user/sessions…).
 */
export default function SecuriteScreen() {
  const router = useRouter()
  const { t, direction } = useLocale()
  const { forget } = useAuth()
  const [sessions, setSessions] = useState<SessionDTO[] | null>(null)

  const load = useCallback(() => {
    fetchSessions()
      .then(setSessions)
      .catch(() => setSessions([]))
  }, [])
  useFocusEffect(load)

  const disconnectOne = (session: SessionDTO) => {
    haptics.remove()
    setSessions((list) => list?.filter((item) => item.id !== session.id) ?? null)
    disconnectSession(session.id).catch(load)
  }

  const disconnectEverywhere = () => {
    Alert.alert(t("Déconnecter tous les appareils ?"), t("Vous serez déconnecté de tous vos appareils, y compris celui-ci."), [
      { text: t("Annuler"), style: "cancel", isPreferred: true },
      {
        text: t("Tout déconnecter"),
        style: "destructive",
        onPress: async () => {
          haptics.remove()
          await disconnectAllSessions().catch(() => undefined)
          await forget()
          router.dismissTo("/compte")
        },
      },
    ])
  }

  const ordered = sessions ? [...sessions].sort((left, right) => Number(right.is_current) - Number(left.is_current)) : null

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ direction, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: 10, gap: 22 }}>
      <SettingsGroup title={t("Mot de passe")}>
        <SettingsRow icon={Lock} label={t("Changer le mot de passe")} onPress={() => router.push("/changer-mot-de-passe")} />
      </SettingsGroup>

      <SettingsGroup title={t("Sessions actives")}>
        {ordered === null ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color={palette.market600} />
          </View>
        ) : (
          ordered.map((session) => {
            const name = session.device_name || session.browser || t("Appareil")
            const mobile = /iphone|android|ios|mobile/i.test(`${session.device_name} ${session.browser}`)
            return (
              <SettingsRow
                key={session.id}
                icon={mobile ? Smartphone : Laptop}
                label={name}
                sub={[session.location, lastSeen(session.last_active, t)].filter(Boolean).join(" · ")}
                control={session.is_current ? <RowTag label={t("Cet appareil")} /> : <RowButton label={t("Déconnecter")} onPress={() => disconnectOne(session)} />}
              />
            )
          })
        )}
      </SettingsGroup>

      <SettingsGroup title={t("Zone de danger")}>
        <SettingsRow icon={LogOut} label={t("Déconnexion de tous les appareils")} sub={t("Vous serez déconnecté de tous vos appareils")} danger onPress={disconnectEverywhere} />
        <SettingsRow icon={Trash2} label={t("Supprimer le compte")} sub={t("Action permanente et irréversible")} danger onPress={() => router.push("/supprimer-compte")} />
      </SettingsGroup>
    </ScrollView>
  )
}
