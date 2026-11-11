import { useCallback, useState } from "react"
import { ActivityIndicator, ScrollView, Switch, View } from "react-native"
import { useFocusEffect } from "expo-router"
import { Mail, MessageSquare, Newspaper, Package, Tag, Truck, type LucideIcon } from "lucide-react-native"
import type { NotificationPreferencesDTO } from "@souki/shared"

import { SettingsGroup, SettingsRow } from "@/components/settings-group"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { fetchNotificationPreferences, updateNotificationPreferences } from "@/lib/api"
import { haptics } from "@/lib/haptics"
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
      <Text variant="footnote" color={palette.ink500} align="center">
        {t("Les notifications sur l'iPhone arriveront avec une prochaine mise à jour.")}
      </Text>
    </ScrollView>
  )
}
