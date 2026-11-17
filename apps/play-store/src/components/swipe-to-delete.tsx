import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable"
import { Trash2 } from "lucide-react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette, radius, shadows } from "@/theme"

const DELETE_WIDTH = 88

/**
 * Carte qu'on balaie vers la gauche (la droite en arabe) pour decouvrir « Supprimer » sur
 * 88 pt, comme les lignes du panier (CartLine). VoiceOver : action « Supprimer » sur la carte.
 */
export function SwipeToDelete({ label, onDelete, disabled = false, children }: { label: string; onDelete: () => void; disabled?: boolean; children: ReactNode }) {
  const { t, isRtl } = useLocale()
  const remove = () => {
    haptics.remove()
    onDelete()
  }
  const action = () => (
    <Pressable
      onPress={remove}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: DELETE_WIDTH, alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: palette.red }}
    >
      <Trash2 size={20} color={palette.white} strokeWidth={2.2} />
      <Text variant="footnote" weight="heavy" color={palette.white} style={{ fontSize: 12 }}>
        {t("Supprimer")}
      </Text>
    </Pressable>
  )

  return (
    <View
      accessibilityActions={disabled ? undefined : [{ name: "delete", label: t("Supprimer") }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") remove()
      }}
      style={{ borderRadius: radius.card, borderCurve: "continuous", boxShadow: shadows.card }}
    >
      <View style={{ borderRadius: radius.card, borderCurve: "continuous", overflow: "hidden" }}>
        <ReanimatedSwipeable
          enabled={!disabled}
          friction={1.6}
          rightThreshold={DELETE_WIDTH / 2}
          leftThreshold={DELETE_WIDTH / 2}
          overshootRight={false}
          overshootLeft={false}
          renderRightActions={isRtl ? undefined : action}
          renderLeftActions={isRtl ? action : undefined}
          childrenContainerStyle={{ backgroundColor: palette.white }}
        >
          {children}
        </ReanimatedSwipeable>
      </View>
    </View>
  )
}
