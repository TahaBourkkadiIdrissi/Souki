import { View } from "react-native"
import type { Locale } from "@souki/shared"

import { PressableScale } from "@/components/pressable-scale"
import { Text } from "@/components/text"
import { useLocale } from "@/contexts/locale-context"
import { haptics } from "@/lib/haptics"
import { palette } from "@/theme"

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
]

/** Choix de la langue en pastilles SOUKI (comme le switch FR/AR de la PWA). Le francais reste par defaut. */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale()
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t("Langue")}
      style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: palette.green50 }}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === locale
        return (
          <PressableScale
            key={option.value}
            onPress={() => {
              if (selected) return
              haptics.selection()
              setLocale(option.value)
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
              minHeight: 44,
              paddingHorizontal: 14,
              borderRadius: 999,
              justifyContent: "center",
              backgroundColor: selected ? palette.souki900 : "transparent",
            }}
          >
            <Text variant="callout" weight="bold" color={selected ? palette.white : palette.green900}>
              {option.label}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}
