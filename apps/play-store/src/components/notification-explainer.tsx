import { useEffect, useState } from "react"
import { Modal, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BellRing } from "lucide-react-native"

import { BrandButton } from "@/components/brand-button"
import { showSnackbar } from "@/components/snackbar"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { markNotificationsExplained, requestNotifications, shouldExplainNotifications } from "@/lib/notifications"
import { m3, palette, radius } from "@/theme"

/** Délai avant la feuille : la célébration de la commande passe d'abord. */
const DELAY_MS = 1400

/**
 * Explication des notifications, puis demande système (design : « Commande validée », puis
 * explication et demande des notifications). Une seule fois par installation, seulement après
 * une commande validée, jamais si la permission est déjà accordée ou refusée définitivement.
 */
export function NotificationExplainer() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      void shouldExplainNotifications().then((should) => {
        if (active && should) setVisible(true)
      })
    }, DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  const later = () => {
    markNotificationsExplained()
    setVisible(false)
  }

  const enable = async () => {
    setVisible(false)
    const state = await requestNotifications()
    if (state === "granted") {
      haptics.success()
      showSnackbar({ message: t("Notifications activées."), aboveNavigation: false })
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={later}>
      <Pressable style={{ flex: 1, backgroundColor: m3.scrim }} onPress={later} accessibilityLabel={t("Plus tard")} />
      <View
        style={{
          backgroundColor: palette.white,
          borderTopLeftRadius: radius.feature,
          borderTopRightRadius: radius.feature,
          paddingTop: 12,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 16,
          gap: 16,
        }}
      >
        <View style={{ alignSelf: "center", width: 32, height: 4, borderRadius: 2, backgroundColor: m3.outline }} />
        <View style={{ width: 56, height: 56, borderRadius: radius.photo, alignItems: "center", justifyContent: "center", backgroundColor: m3.primaryContainer }}>
          <BellRing size={28} color={m3.onPrimaryContainer} strokeWidth={2} />
        </View>
        <View style={{ gap: 8 }}>
          <Text accessibilityRole="header" variant="headlineSmall" color={m3.onSurface}>
            {t("Suivre votre livraison")}
          </Text>
          <Text variant="bodyLarge" color={m3.onSurfaceVariant}>
            {t("SOUKI vous prévient quand votre commande est préparée, quand le livreur part et quand elle arrive. Rien d'autre sans votre accord.")}
          </Text>
        </View>
        <View style={{ gap: 8, paddingTop: 8 }}>
          <BrandButton icon={BellRing} label={t("Activer les notifications")} onPress={() => void enable()} />
          <BrandButton tone="ghost" label={t("Plus tard")} onPress={later} />
        </View>
      </View>
    </Modal>
  )
}
