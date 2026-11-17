import * as Haptics from "expo-haptics"
import { AndroidHaptics } from "expo-haptics"

/**
 * Retours haptiques Android (design-system/android.md > Retours haptiques) : constantes du
 * système, qui respectent le réglage « Vibration au toucher » du téléphone. Un seul retour
 * par action, toujours doublé d'un retour visuel.
 */
const isAndroid = process.env.EXPO_OS === "android"
const isIos = process.env.EXPO_OS === "ios"

function android(type: AndroidHaptics) {
  Haptics.performAndroidHapticsAsync(type).catch(() => undefined)
}

export const haptics = {
  /** Un produit entre dans le panier : CONFIRM. */
  add: () => {
    if (isAndroid) android(AndroidHaptics.Confirm)
    else if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  },
  /** Quantité + ou −, choix dans une liste (rayon, tri) : SEGMENT_TICK. */
  selection: () => {
    if (isAndroid) android(AndroidHaptics.Segment_Tick)
    else if (isIos) Haptics.selectionAsync().catch(() => undefined)
  },
  /** Suppression d'une ligne (seuil du glisser) : GESTURE_END. */
  remove: () => {
    if (isAndroid) android(AndroidHaptics.Gesture_End)
    else if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  },
  /** Favori, ouverture de la commande vocale : CONTEXT_CLICK. */
  medium: () => {
    if (isAndroid) android(AndroidHaptics.Context_Click)
    else if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  },
  /** Appui long sur une carte : LONG_PRESS. */
  longPress: () => {
    if (isAndroid) android(AndroidHaptics.Long_Press)
    else if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  },
  /** Chiffre du code : KEYBOARD_TAP. */
  key: () => {
    if (isAndroid) android(AndroidHaptics.Keyboard_Tap)
  },
  /** Fin de l'intro de lancement : CLOCK_TICK. */
  soft: () => {
    if (isAndroid) android(AndroidHaptics.Clock_Tick)
    else if (isIos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined)
  },
  /** Commande validée, action réussie : CONFIRM. */
  success: () => {
    if (isAndroid) android(AndroidHaptics.Confirm)
    else if (isIos) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
  },
  /** Champ refusé (identifiants incorrects, code faux) : REJECT. */
  error: () => {
    if (isAndroid) android(AndroidHaptics.Reject)
    else if (isIos) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
  },
  warning: () => {
    if (isAndroid) android(AndroidHaptics.Reject)
    else if (isIos) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
  },
}
