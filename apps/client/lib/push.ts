/**
 * Plomberie navigateur des notifications push (Web Push / VAPID).
 *
 * Ce module ne fait aucun appel reseau : il expose uniquement les primitives
 * `PushManager`. Les echanges avec l'API passent par hooks/usePushNotifications,
 * qui reutilise le client authentifie du projet.
 */

export type PushPermission = NotificationPermission | "unsupported"

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  )
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return "unsupported"
  return Notification.permission
}

/**
 * Convertit la cle publique VAPID (base64url, sans padding) en octets bruts :
 * `applicationServerKey` n'accepte pas la chaine telle quelle.
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    // `ready` attend qu'un worker controle la page : indispensable juste apres
    // le premier chargement, ou l'enregistrement est encore en cours.
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const registration = await getRegistration()
  if (!registration) return null
  try {
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Demande la permission puis souscrit. Doit etre appelee depuis un geste
 * utilisateur : les navigateurs bloquent (et penalisent) les demandes
 * spontanees au chargement de la page.
 */
export async function subscribeToPush(publicKey: string): Promise<PushSubscriptionJSON> {
  if (!isPushSupported()) {
    throw new Error("Cet appareil ne prend pas en charge les notifications push.")
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Les notifications sont bloquees pour SOUKI. Autorisez-les dans les reglages de votre navigateur."
        : "Autorisation des notifications non accordee.",
    )
  }

  const registration = await getRegistration()
  if (!registration) {
    throw new Error("Le service worker SOUKI n'est pas actif sur cet appareil.")
  }

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    return existing.toJSON()
  }

  const subscription = await registration.pushManager.subscribe({
    // Obligatoire sur Chrome : chaque push doit se traduire par une
    // notification visible, jamais par un traitement silencieux.
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  return subscription.toJSON()
}

/** Retire l'abonnement local et retourne son endpoint pour revocation serveur. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const subscription = await getExistingSubscription()
  if (!subscription) return null

  const { endpoint } = subscription
  try {
    await subscription.unsubscribe()
  } catch {
    // Meme si le navigateur refuse, la revocation serveur suffit a stopper les envois.
  }
  return endpoint
}
