import { Platform } from "react-native"
import Constants, { ExecutionEnvironment } from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { PUSH_TOKEN_REGISTRATION_ENABLED } from "@/lib/features"
import { apiCall } from "@/lib/api"
import { readJson, writeJson } from "@/lib/local-store"

/**
 * Notifications Android (PLAN-ANDROID.md, phase 9 ; design-system/android.md > Notifications).
 *
 * - Canaux créés au démarrage : Suivi de commande, Abonnements, Compte et sécurité, Nouveautés
 *   (désactivé par défaut : l'utilisateur l'active lui-même dans les réglages).
 * - La permission `POST_NOTIFICATIONS` (Android 13+) n'est JAMAIS demandée au lancement ni pendant
 *   l'onboarding : un écran d'explication, puis la demande système, après la première commande
 *   validée. Un refus n'est pas redemandé en boucle.
 * - Le jeton de l'appareil est envoyé au back-end quand la route existe (tâche B3, commune à
 *   l'iOS) : `PUSH_TOKEN_REGISTRATION_ENABLED` dans lib/features.ts.
 */

export const CHANNELS = {
  commandes: "commandes",
  abonnements: "abonnements",
  compte: "compte",
  nouveautes: "nouveautes",
} as const

const ASKED_KEY = "souki.notifications.demande.v1"
/** Dernier jeton envoyé au back-end : retiré à la déconnexion (DELETE /api/push/appareils). */
const DEVICE_STORE = "souki.notifications.jeton.v1"

/** Expo Go ne gère plus les notifications push Android depuis le SDK 53 : build de développement requise. */
const inExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

/** Affichage des notifications reçues pendant que l'app est ouverte : bannière discrète, sans son. */
export function configureNotificationHandler() {
  if (Platform.OS === "web") return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  })
}

/** Crée (ou met à jour) les canaux Android. Sans effet ailleurs. */
export async function setupNotificationChannels(t: (french: string) => string) {
  if (Platform.OS !== "android") return
  const brand = "#005B43"
  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.commandes, {
      name: t("Suivi de commande"),
      description: t("Préparation, livreur en route, livraison et incidents."),
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: brand,
      vibrationPattern: [0, 180],
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.abonnements, {
      name: t("Abonnements"),
      description: t("Rappel avant la fermeture du marché pour votre commande régulière."),
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: brand,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.compte, {
      name: t("Compte et sécurité"),
      description: t("Connexion depuis un nouvel appareil, Wallet, réclamations."),
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: brand,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.nouveautes, {
      name: t("Nouveautés"),
      description: t("Nouveaux produits et nouvelles fonctions. Désactivé par défaut."),
      importance: Notifications.AndroidImportance.NONE,
    }),
  ]).catch(() => undefined)
}

export type NotificationState = "granted" | "denied" | "undetermined"

export async function getNotificationState(): Promise<NotificationState> {
  if (Platform.OS === "web") return "denied"
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync()
    if (status === "granted") return "granted"
    return canAskAgain ? "undetermined" : "denied"
  } catch {
    return "denied"
  }
}

/**
 * Faut-il montrer l'explication après cette commande ? Une seule fois par installation, et
 * seulement si la permission n'est ni accordée ni refusée définitivement.
 */
export async function shouldExplainNotifications(): Promise<boolean> {
  if (readJson<boolean>(ASKED_KEY, false)) return false
  return (await getNotificationState()) === "undetermined"
}

/** Retient que l'explication a été montrée (« Plus tard » compris) : on ne repose pas la question. */
export function markNotificationsExplained() {
  writeJson(ASKED_KEY, true)
}

/** Demande système, après l'explication. Renvoie l'état final et enregistre l'appareil si accordé. */
export async function requestNotifications(): Promise<NotificationState> {
  markNotificationsExplained()
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status === "granted") {
      void registerDevice()
      return "granted"
    }
    return "denied"
  } catch {
    return "denied"
  }
}

/**
 * Jeton Expo de l'appareil (FCM sous le capot) envoyé au back-end. Rien dans Expo Go, sur un
 * émulateur sans Google Play, ni tant que la route B3 n'est pas déployée.
 */
export async function registerDevice(): Promise<void> {
  if (!PUSH_TOKEN_REGISTRATION_ENABLED || inExpoGo || !Device.isDevice || Platform.OS === "web") return
  try {
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId
    if (!projectId) return
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await apiCall("/api/push/appareils", { method: "POST", body: { token, plateforme: Platform.OS } })
    writeJson(DEVICE_STORE, token)
  } catch {
    // Pas de jeton (Play Services absents, réseau, pas connecté) : nouvel essai au prochain lancement.
  }
}

/** Déconnexion : ce compte ne reçoit plus de notifications sur cet appareil. À appeler avant le logout. */
export async function unregisterDevice(): Promise<void> {
  const token = readJson<string | null>(DEVICE_STORE, null)
  if (!PUSH_TOKEN_REGISTRATION_ENABLED || !token) return
  try {
    await apiCall("/api/push/appareils", { method: "DELETE", body: { token } })
  } catch {
    // Hors connexion : le back-end rattachera le jeton au prochain compte connecté.
  }
  writeJson(DEVICE_STORE, null)
}

/**
 * Écran de l'app à ouvrir au toucher d'une notification. Le back-end envoie l'URL du site
 * (`/suivi-commande?commande=12`, `/historique`) : on la traduit en route de l'app.
 */
export function routeForNotificationUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url.startsWith("/")) return null
  const tracking = /^\/suivi-commande\?(?:.*&)?commande=(\d+)/.exec(url)
  if (tracking) return `/suivi/${tracking[1]}`
  if (url.startsWith("/historique")) return "/commandes"
  return null
}
