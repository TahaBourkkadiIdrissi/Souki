const CACHE_PREFIX = "souki-pwa"
const CACHE_VERSION = "v1"
const RUNTIME_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}`

const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/logo3.png",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/apple-icon.png",
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
    event.respondWith(networkFirst(request))
    return
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/avatar/") ||
    url.pathname.match(/\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(request))
  }
})

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)

  try {
    const fresh = await fetch(request)
    cache.put(request, fresh.clone())
    return fresh
  } catch {
    const cached = await cache.match(request)
    return cached || cache.match("/")
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  const fresh = await fetch(request)
  cache.put(request, fresh.clone())
  return fresh
}
