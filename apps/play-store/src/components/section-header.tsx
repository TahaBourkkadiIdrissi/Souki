import type { ReactNode } from "react"
import { Pressable, View } from "react-native"

import { Text } from "@/components/text"
import { m3, SCREEN_PADDING, sizes, states, withAlpha } from "@/theme"

type SectionHeaderProps = {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  /** Élément posé avant le titre (pastille de niveau d'un rail). */
  leading?: ReactNode
}

/** Titre de section (title-large), sous-titre `on-surface-variant`, bouton texte « Tout voir » en `secondary`. */
export function SectionHeader({ title, subtitle, actionLabel, onAction, leading }: SectionHeaderProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingStart: SCREEN_PADDING, paddingEnd: 4, gap: 12 }}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" variant="titleLarge" color={m3.onSurface}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodySmall" color={m3.onSurfaceVariant}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={`${actionLabel}, ${title}`}
          android_ripple={{ color: withAlpha(m3.secondary, states.pressed), borderless: false }}
          style={{ minHeight: sizes.touchMin, justifyContent: "center", paddingHorizontal: 12, borderRadius: 20, overflow: "hidden" }}
        >
          <Text variant="labelLarge" color={m3.secondary}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}
