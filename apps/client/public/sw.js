const CACHE_PREFIX = "souki-pwa"
const CACHE_VERSION = "v10"
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`

// Page de repli affichee quand une navigation echoue hors ligne.
const OFFLINE_URL = "/offline"

// Point d'entree de l'app installee (start_url du manifest) : precache pour que
// le lancement soit instantane, y compris hors ligne.
const START_URL = "/pwa-welcome"

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/logo3.png",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/apple-icon.png",
  // Heros generes (Higgsfield, detoures) : couronne de l'animation d'entree
  // (~180 KB) et panier des generations IA (~65 KB) — precaches pour que le
  // premier lancement et les premieres generations soient complets, meme
  // hors ligne.
  "/images/launch/wreath.webp",
  "/images/launch/basket.webp",
  START_URL,
  OFFLINE_URL,
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(RUNTIME_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
})

// --- Notifications push -----------------------------------------------------

const NOTIFICATION_ICON = "/pwa-icon-192.png"
const NOTIFICATION_BADGE = "/pwa-icon-192.png"

self.addEventListener("push", (event) => {
  // Un push sans donnees lisibles reste affiche : ne jamais laisser une
  // notification « silencieuse », certains navigateurs penalisent l'abonnement.
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = {}
  }

  const title = payload.title || "SOUKI"
  const url = payload.url || "/"

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      lang: "fr",
      // Une notification par evenement metier : un nouveau statut de commande
      // remplace le precedent au lieu d'empiler les bulles.
      tag: payload.event || "souki",
      renotify: true,
      data: { url, event: payload.event || null, payload: payload.data || {} },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/"
  const parsedTarget = new URL(targetUrl, self.location.origin)
  const targetHref = parsedTarget.origin === self.location.origin ? parsedTarget.href : `${self.location.origin}/`

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Reutiliser l'onglet SOUKI deja ouvert plutot que d'en empiler un
      // nouveau a chaque notification.
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then((focused) => focused.navigate?.(targetHref) ?? focused)
        }
      }
      return self.clients.openWindow(targetHref)
    }),
  )
})

// Le navigateur peut faire tourner les cles d'un abonnement : sans ce
// re-enregistrement, l'appareil cesse silencieusement de recevoir les push.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey = event.oldSubscription?.options?.applicationServerKey
      if (!applicationServerKey) return

      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
        await fetch("/backend/api/user/push/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(subscription.toJSON()),
        })
      } catch (err) {
        // Sans session valide le re-abonnement echouera : l'app le refera au
        // prochain lancement (cf. hooks/usePushNotifications).
      }
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event

  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationWithOfflineFallback(request))
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/avatar/") ||
    url.pathname.match(/\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/)
  ) {
    event.respondWith(networkFirst(request))
  }
})

async function navigationWithOfflineFallback(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    return response
  } catch (err) {
    const cachedPage = await cache.match(request)
    if (cachedPage) return cachedPage

    const offline = await cache.match(OFFLINE_URL)
    if (offline) return offline

    throw err
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}
