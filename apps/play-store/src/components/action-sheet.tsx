import { useEffect, useState } from "react"
import { Modal, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/text"
import { haptics } from "@/lib/haptics"
import { colors, palette, radius } from "@/theme"

/**
 * Feuille d'actions Android (SheetAndDialog du design system Android) : remplace
 * `ActionSheetIOS`, qui n'existe pas sur Android. Même signature, pour que les écrans
 * repris de l'iOS n'aient qu'un import à changer. Le bouton « Annuler » n'est pas affiché :
 * sur Android on annule en touchant le fond ou avec le geste / bouton Retour.
 */
export type ActionSheetOptions = {
  title?: string
  message?: string
  options: string[]
  cancelButtonIndex?: number
  destructiveButtonIndex?: number
  /** Ignoré (propriété iOS), gardé pour la compatibilité des appels. */
  tintColor?: string
}

type Request = ActionSheetOptions & { onSelect: (index: number) => void }

let current: Request | null = null
const listeners = new Set<(request: Request | null) => void>()

function emit(request: Request | null) {
  current = request
  listeners.forEach((listener) => listener(request))
}

export function showActionSheetWithOptions(options: ActionSheetOptions, onSelect: (index: number) => void) {
  emit({ ...options, onSelect })
}

/** Remplacement direct de `ActionSheetIOS` dans les écrans repris de l'iOS. */
export const ActionSheet = { showActionSheetWithOptions }

/** À monter une seule fois, à la racine de l'app. */
export function ActionSheetHost() {
  const [request, setRequest] = useState<Request | null>(current)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    listeners.add(setRequest)
    return () => {
      listeners.delete(setRequest)
    }
  }, [])

  const close = (index: number) => {
    const active = request
    emit(null)
    if (active) active.onSelect(index)
  }

  const cancelIndex = request?.cancelButtonIndex ?? -1

  return (
    <Modal visible={request !== null} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close(cancelIndex)}>
      <Pressable style={{ flex: 1, backgroundColor: palette.scrim }} onPress={() => close(cancelIndex)} accessibilityLabel="Fermer" />
      {request ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.feature - 2,
            borderTopRightRadius: radius.feature - 2,
            paddingTop: 8,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View style={{ alignSelf: "center", width: 32, height: 4, borderRadius: 2, backgroundColor: palette.ink300, marginBottom: 12 }} />
          {request.title ? (
            <Text variant="headline" style={{ paddingHorizontal: 24, paddingBottom: request.message ? 4 : 12 }}>
              {request.title}
            </Text>
          ) : null}
          {request.message ? (
            <Text variant="footnote" color={colors.secondaryLabel} style={{ paddingHorizontal: 24, paddingBottom: 12 }}>
              {request.message}
            </Text>
          ) : null}
          {request.options.map((label, index) =>
            index === cancelIndex ? null : (
              <Pressable
                key={`${index}-${label}`}
                onPress={() => {
                  haptics.selection()
                  close(index)
                }}
                android_ripple={{ color: "rgba(0, 91, 67, 0.10)" }}
                accessibilityRole="button"
                style={{ minHeight: 56, justifyContent: "center", paddingHorizontal: 24 }}
              >
                <Text variant="body" weight="medium" color={index === request.destructiveButtonIndex ? colors.danger : colors.label}>
                  {label}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ) : null}
    </Modal>
  )
}
