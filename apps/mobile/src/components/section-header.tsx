import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import { ChevronLeft, ChevronRight } from "lucide-react-native"

import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { palette, SCREEN_PADDING } from "@/theme"

type SectionHeaderProps = {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  /** Element pose avant le titre (pastille de niveau d'un rail). */
  leading?: ReactNode
}

/** Titre de section (`title-2`), sous-titre `ink-500`, « Voir tout › » en `market-700`, pastille facultative devant. */
export function SectionHeader({ title, subtitle, actionLabel, onAction, leading }: SectionHeaderProps) {
  const { isRtl } = useLocale()
  const Chevron = isRtl ? ChevronLeft : ChevronRight
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SCREEN_PADDING, gap: 12 }}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" variant="title2" color={palette.ink900} style={{ fontSize: 21, letterSpacing: 0 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color={palette.ink500}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="link"
          style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}
        >
          <Text variant="footnote" weight="bold" color={palette.market700}>
            {actionLabel}
          </Text>
          <Chevron size={16} color={palette.market700} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  )
}
