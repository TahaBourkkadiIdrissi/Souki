import { useCallback, useState } from "react"
import { ActivityIndicator, Linking, ScrollView, Switch, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { BellRing, Mail, MessageSquare, Newspaper, Package, Tag, Truck, type LucideIcon } from "lucide-react-native"
import type { NotificationPreferencesDTO } from "@souki/shared"

import { SettingsGroup, SettingsRow } from "@/components/settings-group"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { fetchNotificationPreferences, updateNotificationPreferences } from "@/lib/api"
import { BrandButton } from "@/components/brand-button"
import { haptics } from "@/lib/haptics"
import { getNotificationState, requestNotifications, type NotificationState } from "@/lib/notifications"
import { colors, palette } from "@/theme"

type PreferenceKey = Exclude<keyof NotificationPreferencesDTO, "push">

const GROUPS: { title: string; rows: { key: PreferenceKey; label: string; Icon: LucideIcon }[] }[] = [
  {
    title: "Mes commandes",
    rows: [
      { key: "orderUpdates", label: "Suivi des commandes", Icon: Package },
      { key: "livraison", label: "Livraison", Icon: Truck },
    ],
  },
  {
    title: "Canaux",
    rows: [
      { key: "email", label: "E-mail", Icon: Mail },
      { key: "sms", label: "SMS", Icon: MessageSquare },
    ],
  },
  {
    title: "Nouveautés",
    rows: [
      { key: "promotions", label: "Offres", Icon: Tag },
      { key: "newsletter", label: "Lettre d'information", Icon: Newspaper },
    ],
  },
]

/**
 * Notifications : les preferences du compte (GET/PUT /api/user/notifications), comme sur le
 * site. Les notifications push de l'iPhone arriveront avec la build native (pas dans Expo Go).
 */
export default function NotificationsScreen() {
  const { t, direction } = useLocale()
  const [preferences, setPreferences] = useState<NotificationPreferencesDTO | null>(null)

  useFocusEffect(
    useCallback(() => {
      fetchNotificationPreferences()
        .then(setPreferences)
        .catch(() => undefined)
    }, []),
  )

  const toggle = (key: PreferenceKey, value: boolean) => {
    if (!preferences) return
    haptics.selection()
    const next = { ...preferences, [key]: value }
    setPreferences(next)
    updateNotificationPreferences(next).catch(() => setPreferences(preferences))
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ direction, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16, paddingTop: 10, gap: 22 }}>
      {preferences === null ? (
        <View style={{ paddingVertical: 40, alignItems: "center" }}>
          <ActivityIndicator color={palette.market600} />
        </View>
      ) : (
        GROUPS.map((group) => (
          <SettingsGroup key={group.title} title={t(group.title)}>
            {group.rows.map(({ key, label, Icon }) => (
              <SettingsRow
                key={key}
                icon={Icon}
                label={t(label)}
                control={<Switch value={preferences[key]} onValueChange={(value) => toggle(key, value)} trackColor={{ true: palette.market600, false: palette.line }} accessibilityLabel={t(label)} />}
              />
            ))}
          </SettingsGroup>
        ))
      )}
      <DeviceNotifications />
    </ScrollView>
  )
}

/**
 * Notifications du téléphone : état de la permission Android et accès aux réglages du système
 * (canaux Suivi de commande, Abonnements, Compte et sécurité, Nouveautés).
 */
function DeviceNotifications() {
  const { t } = useLocale()
  const [state, setState] = useState<NotificationState | null>(null)

  useFocusEffect(
    useCallback(() => {
      void getNotificationState().then(setState)
    }, []),
  )

  if (state === null) return null
  const detail =
    state === "granted"
      ? t("Activées sur ce téléphone. Choisissez les types de notifications dans les réglages d'Android.")
      : state === "denied"
        ? t("Désactivées sur ce téléphone. Vous pouvez les réactiver dans les réglages d'Android.")
        : t("Pas encore activées sur ce téléphone.")

  return (
    <View style={{ gap: 12 }}>
      <SettingsGroup title={t("Ce téléphone")}>
        <SettingsRow icon={BellRing} label={t("Notifications")} sub={detail} />
      </SettingsGroup>
      {state === "undetermined" ? (
        <BrandButton tone="soft" label={t("Activer les notifications")} onPress={() => void requestNotifications().then(setState)} />
      ) : (
        <BrandButton tone="outline" label={t("Ouvrir les réglages d'Android")} onPress={() => void Linking.openSettings()} />
      )}
    </View>
  )
}
