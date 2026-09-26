import { chromium } from "playwright"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const output = path.join(root, "outputs/branding/screenshots")
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: "chrome" })
console.log("Chrome started")
const report = process.argv.includes("--resume")
  ? JSON.parse(await fs.readFile(path.join(root, "outputs/branding/browser-checks.json"), "utf8"))
  : { screens: [], pwa: [], failures: [], limitations: ["No real Android/iOS device or OS-level PWA installation", "Business APIs are not running; no real account/login/order operation tested", "External photos and scripts blocked during isolated screenshot checks"] }
report.failures = []

async function screen(name, port, route, width, height, signup = false, dark = false) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: dark ? "dark" : "light" })
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort())
  const page = await context.newPage()
  const logoFailures = []
  page.on("response", res => { if (res.url().includes("/brand/") && !res.ok()) logoFailures.push([res.url(), res.status()]) })
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "domcontentloaded" })
  console.log(`Loaded ${name}`)
  if (signup) await page.getByRole("button", { name: "S'inscrire", exact: true }).click()
  await page.locator('a[aria-label="SOUKI — Accueil"]:visible').first().waitFor({ state: "visible" })
  console.log(`Logo visible ${name}`)
  await page.evaluate(async () => {
    await document.fonts.ready
    const visible = [...document.images].filter(i => {
      const r = i.getBoundingClientRect()
      return i.src.includes("/brand/") && r.width > 0 && r.top < innerHeight && r.bottom > 0
    })
    await Promise.all(visible.map(i => i.decode()))
  })
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    logos: [...document.querySelectorAll('img[src*="/brand/"]')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < innerHeight && r.bottom > 0 }).map(el => {
      const rect = el.getBoundingClientRect()
      return { src: el.getAttribute("src"), loaded: el.complete && el.naturalWidth > 0, width: rect.width, height: rect.height, inViewport: rect.left >= 0 && rect.right <= innerWidth, link: el.closest("a")?.getAttribute("aria-label"), href: el.closest("a")?.getAttribute("href") }
    }),
    icons: [...document.querySelectorAll('link[rel*="icon"]')].map(el => ({ rel: el.rel, href: el.getAttribute("href"), sizes: el.getAttribute("sizes") })),
  }))
  assert.equal(result.overflow, false, `${name}: horizontal overflow`)
  assert(result.logos.length > 0, `${name}: no visible logo`)
  for (const logo of result.logos) { assert(logo.loaded); assert(logo.inViewport); assert.equal(logo.link, "SOUKI — Accueil") }
  assert.deepEqual(logoFailures, [])
  await page.screenshot({ path: path.join(output, `${name}.png`) })
  if (name === "home-desktop") {
    await page.locator("footer").scrollIntoViewIfNeeded()
    await page.locator('footer img[src*="/brand/"]').evaluate(i => i.decode())
    await page.locator("footer").screenshot({ path: path.join(output, "footer-desktop.png") })
  }
  // The clickable brand returns to the same app's home entry.
  await page.locator('a[aria-label="SOUKI — Accueil"]:visible').first().click()
  await page.waitForURL(url => ["/", "/admin", "/login/livreur"].includes(url.pathname))
  report.screens.push({ name, width, height, dark, ...result })
  await context.close()
  console.log(`PASS ${name}`)
}

try {
  for (const args of [
    ["home-desktop", 3100, "/", 1440, 1000],
    ["home-mobile", 3100, "/", 390, 844],
    ["home-mobile-320", 3100, "/", 320, 740],
    ["catalogue-desktop", 3100, "/catalogue", 1440, 1000],
    ["catalogue-mobile", 3100, "/catalogue", 390, 844],
    ["login-desktop", 3100, "/login/client", 1440, 1000],
    ["login-mobile", 3100, "/login/client", 390, 844],
    ["signup-mobile", 3100, "/login/client", 390, 844, true],
    ["login-dark", 3100, "/login/client", 390, 844, false, true],
    ["livreur-login-desktop", 3101, "/login/livreur", 1440, 1000],
    ["livreur-login-mobile", 3101, "/login/livreur", 390, 844],
    ["admin-login-desktop", 3102, "/admin/login", 1440, 1000],
    ["admin-login-mobile", 3102, "/admin/login", 390, 844],
  ]) if (!report.screens.some(s => s.name === args[0])) await screen(...args)

  for (const [role, port, cacheName] of [["client", 3100, "souki-pwa-v11-brand2026"], ["livreur", 3101, "souki-livreur-pwa-v11-brand2026"]]) {
    if (report.pwa.some(p => p.role === role)) continue
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:${port}/offline`, { waitUntil: "domcontentloaded" })
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.waitForFunction(() => !!navigator.serviceWorker.controller)
    const manifest = await (await page.request.get(`http://127.0.0.1:${port}/manifest.webmanifest`)).json()
    assert.equal(manifest.theme_color, "#005B43")
    assert.equal(manifest.background_color, "#FFFFFF")
    assert.equal(manifest.icons.length, 4)
    for (const icon of manifest.icons) {
      assert(["192x192", "512x512"].includes(icon.sizes)); assert.equal(icon.type, "image/png")
      assert(["any", "maskable"].includes(icon.purpose)); assert((await page.request.get(`http://127.0.0.1:${port}${icon.src}`)).ok())
    }
    const cdp = await context.newCDPSession(page)
    const parsed = await cdp.send("Page.getAppManifest")
    assert.deepEqual(parsed.errors, [])
    const installability = await cdp.send("Page.getInstallabilityErrors")
    const cached = await page.evaluate(async name => (await (await caches.open(name)).keys()).map(r => new URL(r.url).pathname), cacheName)
    assert(cached.includes("/brand/souki-2026/secondary.png")); assert(cached.includes("/offline"))
    await page.evaluate(async () => {
      localStorage.setItem("souki-brand-qa-sentinel", "preserved")
      const c = await caches.open("souki-user-data")
      await c.put("/qa-sentinel", new Response("preserved"))
      const req = indexedDB.open("souki-brand-qa", 1)
      req.onupgradeneeded = () => req.result.createObjectStore("preferences")
      await new Promise((resolve, reject) => { req.onerror = reject; req.onsuccess = () => {
        const db = req.result; const tx = db.transaction("preferences", "readwrite"); tx.objectStore("preferences").put("preserved", "sentinel"); tx.oncomplete = () => { db.close(); resolve() }
      } })
    })
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update() })
    await context.setOffline(true)
    const offlineAssets = await page.evaluate(async () => {
      const image = await fetch("/brand/souki-2026/secondary.png")
      const manifest = await fetch("/manifest.webmanifest")
      return { image: image.ok, manifest: manifest.ok, localStorage: localStorage.getItem("souki-brand-qa-sentinel"), unrelatedCache: await (await caches.open("souki-user-data")).match("/qa-sentinel").then(r => r.text()) }
    })
    assert.equal(offlineAssets.image, true); assert.equal(offlineAssets.manifest, true)
    assert.equal(offlineAssets.localStorage, "preserved"); assert.equal(offlineAssets.unrelatedCache, "preserved")
    // The query is not precached: this exercises the navigation fallback while
    // keeping the app's existing route guard on its public /offline route.
    await page.goto(`http://127.0.0.1:${port}/offline?brand-qa-offline`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: /hors ligne/i }).waitFor({ state: "visible" })
    await page.screenshot({ path: path.join(output, `${role}-offline.png`) })
    report.pwa.push({ role, manifest, browserManifestErrors: parsed.errors, installability, cached, offlineAssets, offlineNavigation: "passed" })
    await context.close()
    console.log(`PASS ${role} PWA manifest, service worker and offline`)
  }

  const installedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
  await installedContext.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true })
    sessionStorage.setItem("souki-launched", "1")
  })
  await installedContext.route("**/*", async route => {
    const url = new URL(route.request().url())
    if (url.hostname !== "127.0.0.1") return route.abort()
    if (url.pathname === "/backend/auth/me") return route.fulfill({ status: 200, json: { id: 999999, role: "CLIENT", roles: ["CLIENT"], permissions: [], is_verified: true, is_active: true, onboarding_completed: true } })
    if (url.pathname === "/backend/api/user/profile") return route.fulfill({ status: 200, json: { prenom: "Aperçu", nom: "QA" } })
    if (url.pathname.startsWith("/backend/")) return route.fulfill({ status: 200, json: [] })
    return route.continue()
  })
  const installedPage = await installedContext.newPage()
  await installedPage.goto("http://127.0.0.1:3100/pwa-welcome", { waitUntil: "domcontentloaded" })
  const installedLogo = installedPage.locator('a[aria-label="SOUKI — Accueil"]:visible').first()
  await installedLogo.waitFor({ state: "visible" })
  await installedLogo.locator("img").evaluate(image => image.decode())
  assert.equal(await installedLogo.getAttribute("href"), "/pwa-welcome")
  assert.equal(await installedPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  await installedPage.screenshot({ path: path.join(output, "pwa-welcome-mobile.png") })
  report.standalonePreview = { mockedSession: true, emulatedNavigatorStandalone: true, overflow: false, logo: "horizontal on white support" }
  await installedContext.close()
  console.log("PASS emulated standalone PWA welcome")

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    const original = window.setTimeout.bind(window)
    window.setTimeout = (callback, delay, ...args) => original(callback, delay === 2650 ? 20000 : delay, ...args)
  })
  await page.goto("http://127.0.0.1:3100/login/client?souki-launch-preview", { waitUntil: "domcontentloaded" })
  await page.locator('.souki-launch img[src*="secondary.png"]').waitFor({ state: "visible" })
  await page.evaluate(async () => {
    await document.querySelector('.souki-launch img[src*="secondary.png"]').decode()
    for (const animation of document.querySelector(".souki-launch").getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 1450 }
  })
  await page.screenshot({ path: path.join(output, "animation-mobile.png") })
  report.animation = { suppliedSecondary: true, screenshotTimeMs: 1450, timeoutExtendedForScreenshotOnly: true }
  await context.close()
  const normalContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })
  const normalPage = await normalContext.newPage()
  await normalPage.goto("http://127.0.0.1:3100/login/client?souki-launch-preview", { waitUntil: "domcontentloaded" })
  await normalPage.waitForFunction(() => !document.documentElement.hasAttribute("data-souki-launch"))
  assert.equal(await normalPage.locator(".souki-launch").count(), 0)
  report.animation.reducedMotionDismissal = "passed"
  await normalContext.close()
} catch (error) {
  report.failures.push(String(error.stack || error)); console.error(error); process.exitCode = 1
} finally {
  await fs.writeFile(path.join(root, "outputs/branding/browser-checks.json"), JSON.stringify(report, null, 2))
  await browser.close()
}
