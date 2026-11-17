import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

/**
 * Captures d'écran de l'app (version web de développement) pour comparer avec les maquettes
 * du design system, en clair et en sombre, à 360 × 800 dp.
 *
 * 1. Lancer le serveur web :  node scripts/expo.mjs start --web --port 8090 --clear
 * 2. Puis :                   node scripts/captures.mjs marche produits panier compte
 *    (routes sans « / » au début ; WAIT=9000 pour attendre plus longtemps les animations)
 * Les images vont dans apps/play-store/captures/ (ignoré par git).
 *
 * Les lectures publiques de l'API (GET) sont relayées avec un en-tête CORS ; toute écriture est
 * refusée : aucune donnée n'est modifiée. Aperçu web seulement : la carte et les modules natifs
 * (Google, notifications) n'y existent pas. La référence reste le téléphone.
 */
const require = createRequire(join(import.meta.dirname, "..", "..", "..", "package.json"))
const { chromium } = require("playwright")

const base = process.env.BASE_URL || "http://localhost:8090"
const wait = Number(process.env.WAIT || 4000)
const out = join(import.meta.dirname, "..", "captures")
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["marche"]
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme })
  await context.route("https://souki.io/backend/**", async (route) => {
    const method = route.request().method()
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, OPTIONS" }
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors })
    if (method !== "GET") return route.fulfill({ status: 401, headers: cors, body: "{}" })
    try {
      const response = await route.fetch({ headers: { accept: "application/json" } })
      await route.fulfill({ response, headers: { ...response.headers(), ...cors } })
    } catch {
      await route.fulfill({ status: 503, headers: cors, body: "{}" })
    }
  })
  const page = await context.newPage()
  for (const route of routes) {
    const clean = route.replace(/^\/+/, "")
    await page.goto(`${base}/${clean}`, { waitUntil: "networkidle", timeout: 120000 }).catch(() => undefined)
    await page.waitForTimeout(wait)
    const file = join(out, `${clean.replace(/\W+/g, "_") || "accueil"}-${scheme}.png`)
    await page.screenshot({ path: file })
    console.log("capture", file)
  }
  await context.close()
}
await browser.close()
