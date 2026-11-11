import * as Haptics from "expo-haptics"

/**
 * Retours haptiques, un seul par action et toujours avec un retour visuel
 * (beaucoup d'utilisateurs les desactivent). iOS uniquement.
 */
const enabled = process.env.EXPO_OS === "ios"

export const haptics = {
  /** Un produit entre dans le panier, une quantite change. */
  add: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  },
  /** Choix dans une liste (rayon, tri, favori). */
  selection: () => {
    if (enabled) Haptics.selectionAsync().catch(() => undefined)
  },
  /** Suppression d'une ligne du panier. */
  remove: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  },
  /** Appui franc (ouverture de la commande vocale). */
  medium: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined)
  },
  /** Fin de l'intro de lancement (LaunchIntro) : un seul retour, doux. */
  soft: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined)
  },
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
  },
  /** Champ refuse (identifiants incorrects, code faux). */
  error: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined)
  },
  warning: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
  },
}
