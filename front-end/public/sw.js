const CACHE_PREFIX = "souki-pwa"
const CACHE_VERSION = "v4"
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
