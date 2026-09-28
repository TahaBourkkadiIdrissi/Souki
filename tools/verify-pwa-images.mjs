import { chromium } from "playwright"
import assert from "node:assert/strict"
import fs from "node:fs/promises"

const output = new URL("../outputs/pwa-images/", import.meta.url)
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: "chrome" })
const results = []
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 667 : 844 }, deviceScaleFactor: 3, reducedMotion: "reduce" })
    let profile = { prenom: "Amina", nom: "Test", email: "ancien@example.ma", telephone: "+212612345678", email_verified: true, address: { adresse: "Test", ville: "Fès", code_postal: "30000" } }
    await context.addInitScript(() => {
      if (location.search.includes("souki-launch-preview")) {
        const originalTimeout = window.setTimeout.bind(window)
        window.setTimeout = (callback, delay, ...args) => originalTimeout(callback, delay === 2650 ? 60000 : delay, ...args)
      }
      window.google = { accounts: { id: {
        initialize() {},
        renderButton(host) { host.textContent = "Continuer avec Google" },
      } } }
      Object.defineProperty(navigator, "standalone", { value: true })
      sessionStorage.setItem("souki-launched", "1")
    })
    await context.route("**/*", async route => {
      const url = new URL(route.request().url())
      if (url.hostname === "accounts.google.com") return route.fulfill({ contentType: "text/javascript", body: "" })
      if (url.hostname !== "127.0.0.1") return route.abort()
      if (url.pathname.startsWith("/backend/")) {
        let data = []
        if (url.pathname.endsWith("/auth/me")) data = { id: 42, email: profile.email, roles: ["CLIENT"], permissions: [], is_verified: true, is_active: true, onboarding_completed: true }
        if (url.pathname.endsWith("/api/user/profile")) {
          if (route.request().method() === "PUT") {
            profile = { ...profile, ...route.request().postDataJSON() }
            data = { success: true, email_changed: false }
          } else data = profile
        }
        if (url.pathname.endsWith("/api/user/bootstrap")) data = { profile, notifications: {}, sessions: [], wallet: null }
        return route.fulfill({ json: data })
      }
      return route.continue()
    })
    const page = await context.newPage()
    await page.goto("http://127.0.0.1:3100/login/client", { waitUntil: "networkidle" })
    const logo = page.locator('img[src*="symbol.png"]:visible')
    assert.equal(await logo.evaluate(el => el.getBoundingClientRect().height), 48)
    const dimensions = await page.evaluate(() => ({ height: innerHeight, scroll: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth }))
    assert.equal(dimensions.overflow, false)
    if (dimensions.scroll > dimensions.height + 1) {
      await page.screenshot({ path: new URL(`login-overflow-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1"), fullPage: true })
      console.log(await page.locator('body').innerText())
      console.log(await page.locator('body > div, form, form > div, main').evaluateAll(els => els.map(el => ({ tag: el.tagName, class: el.className, height: el.getBoundingClientRect().height }))))
    }
    assert(dimensions.scroll <= dimensions.height + 1, `Login scroll at ${width}: ${JSON.stringify(dimensions)}`)
    await page.screenshot({ path: new URL(`login-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1") })
    await page.getByRole("button", { name: "S'inscrire", exact: true }).click()
    assert.equal(await logo.evaluate(el => el.getBoundingClientRect().height), 48)
    await page.screenshot({ path: new URL(`signup-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1") })
    await page.goto("http://127.0.0.1:3100/pwa-welcome", { waitUntil: "networkidle" })
    await page.getByText("Amina", { exact: true }).waitFor()
    const header = page.locator("header").first()
    const alignment = await header.evaluate(el => {
      const logo = el.querySelector('img[src*="symbol.png"]').getBoundingClientRect()
      const location = el.querySelector('[aria-label="Adresse de livraison"]').getBoundingClientRect()
      return { delta: Math.abs(logo.y + logo.height / 2 - location.y - location.height / 2), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert(alignment.delta < 1)
    assert.equal(alignment.overflow, false)
    const backgrounds = await header.locator('a:has(img[src*="symbol.png"])').evaluate(el =>
      [el, el.querySelector('span'), el.querySelector('img')].map(node => getComputedStyle(node).backgroundColor))
    assert(backgrounds.every(color => color === 'rgba(0, 0, 0, 0)'), 'Home icon must have no background')
    await page.screenshot({ path: new URL(`home-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1") })
    await page.getByRole("button", { name: "Profil et paramètres" }).click()
    await page.locator('input[value="Amina"]').fill("Salma")
    await Promise.all([
      page.waitForResponse(res => res.url().endsWith("/api/user/profile") && res.request().method() === "PUT"),
      page.getByRole("button", { name: "Enregistrer", exact: true }).first().click(),
    ])
    assert.equal(profile.prenom, "Salma")
    await page.goto("http://127.0.0.1:3100/pwa-welcome", { waitUntil: "networkidle" })
    await page.getByText("Salma", { exact: true }).waitFor()
    profile.prenom = "Nadia"
    await page.evaluate(() => window.dispatchEvent(new Event("souki:profile-updated")))
    await page.getByText("Nadia", { exact: true }).waitFor()
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.goto("http://127.0.0.1:3100/pwa-welcome?souki-launch-preview", { waitUntil: "networkidle" })
    await page.evaluate(async () => {
      // Freeze the decorative sequence for a deterministic screenshot.
      document.documentElement.setAttribute("data-souki-launch", "")
      document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = 1500 })
      const image = document.querySelector('.souki-launch-logo-wrap img')
      await image.decode()
      await document.querySelector('.souki-launch-wreath-front').decode()
    })
    const launch = await page.locator('.souki-launch-logo-wrap').evaluate(el => ({ radius: getComputedStyle(el).borderRadius, width: el.clientWidth, height: el.clientHeight, pixels: el.querySelector('img').naturalWidth }))
    assert.equal(launch.width, launch.height)
    assert.equal(launch.radius, "50%")
    assert(launch.pixels >= launch.width * 3)
    assert.equal(await page.locator('.souki-launch').evaluate(el => getComputedStyle(el).opacity), "1")
    await page.screenshot({ path: new URL(`launch-${width}.png`, output).pathname.replace(/^\/(\w:)/, "$1") })
    results.push({ width, dimensions, alignment, launch, profileUpdate: "passed" })
    await context.close()
  }
  await fs.writeFile(new URL("checks.json", output), JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
