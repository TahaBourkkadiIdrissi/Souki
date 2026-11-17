import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Pressable, View } from "react-native"
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/text"
import { DUR_BASE, DUR_FAST, EASE_EMPHASIZED_DECELERATE } from "@/lib/motion"
import { m3, radius, shadows, sizes, withAlpha } from "@/theme"

/**
 * Snackbar Material 3 (TabsAndSnackbar du design system) : message court en bas de l'écran,
 * au-dessus de la barre de navigation, avec au plus une action (« Annuler »). Remplace les
 * alertes pour les confirmations qui ne demandent pas de décision.
 */
export type SnackbarOptions = {
  message: string
  actionLabel?: string
  onAction?: () => void
  /** Durée d'affichage (ms). 4 s sans action, 6 s avec. */
  duration?: number
  /** `false` sur un écran sans barre de navigation (fiche, formulaires). */
  aboveNavigation?: boolean
}

type Item = SnackbarOptions & { id: number }

let nextId = 1
const listeners = new Set<(item: Item | null) => void>()

export function showSnackbar(options: SnackbarOptions) {
  const item = { ...options, id: nextId++ }
  listeners.forEach((listener) => listener(item))
  AccessibilityInfo.announceForAccessibility(options.message)
}

export function hideSnackbar() {
  listeners.forEach((listener) => listener(null))
}

export function SnackbarHost() {
  const [item, setItem] = useState<Item | null>(null)
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    listeners.add(setItem)
    return () => {
      listeners.delete(setItem)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!item) return
    timer.current = setTimeout(() => setItem(null), item.duration ?? (item.actionLabel ? 6000 : 4000))
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [item])

  if (!item) return null

  const bottom = insets.bottom + 12 + (item.aboveNavigation === false ? 0 : sizes.tabBar + 8)

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", paddingHorizontal: 12 }}>
      <Animated.View
        key={item.id}
        accessibilityLiveRegion="polite"
        entering={reducedMotion ? undefined : FadeInDown.duration(DUR_BASE).easing(EASE_EMPHASIZED_DECELERATE)}
        exiting={reducedMotion ? undefined : FadeOutDown.duration(DUR_FAST)}
        style={{
          width: "100%",
          maxWidth: 560,
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingStart: 16,
          paddingEnd: item.actionLabel ? 4 : 16,
          paddingVertical: 4,
          borderRadius: radius.xs,
          backgroundColor: m3.inverseSurface,
          boxShadow: shadows.float,
        }}
      >
        <Text variant="bodyMedium" color={m3.inverseOnSurface} style={{ flex: 1, paddingVertical: 10 }}>
          {item.message}
        </Text>
        {item.actionLabel ? (
          <Pressable
            onPress={() => {
              item.onAction?.()
              setItem(null)
            }}
            accessibilityRole="button"
            android_ripple={{ color: withAlpha(m3.inversePrimary, 0.16) }}
            style={{ minHeight: 48, minWidth: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: radius.pill }}
          >
            <Text variant="labelLarge" color={m3.inversePrimary}>
              {item.actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  )
}
