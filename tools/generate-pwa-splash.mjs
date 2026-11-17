// Ecrans de demarrage iOS de la PWA (apple-touch-startup-image) : fond vert SOUKI et sac blanc
// de 160 px CSS, soit exactement le premier frame de l'animation d'entree (PwaLaunchOverlay,
// reprise de l'intro de l'app Play Store). Sans ecran vert, iOS montrerait un flash blanc avant
// l'animation.
// Usage : node tools/generate-pwa-splash.mjs
// Ne touche qu'a apps/client/public/brand/souki-2026/splash (memes 36 fichiers, memes tailles).
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "apps/client/package.json"))
const sharp = createRequire(require.resolve("next/package.json"))("sharp")

const GREEN = "#005B43"
/** Taille du sac en px CSS (MARK de l'intro Play Store, .souki-launch-mark). */
const MARK = 160
const brandDir = path.join(root, "apps/client/public/brand/souki-2026")
const splashDir = path.join(brandDir, "splash")
const mark = path.join(brandDir, "splash-symbol.png")

// Densite de chaque fichier, lue dans APPLE_SPLASH_DEVICES (app/layout.tsx), comme generate-brand-assets.mjs.
const layout = await fs.readFile(path.join(root, "apps/client/app/layout.tsx"), "utf8")
const devices = layout.match(/const APPLE_SPLASH_DEVICES[^=]+\= \[([\s\S]+?)\n\]/)[1]
const densities = new Map()
for (const match of devices.matchAll(/\[(\d+), (\d+), (\d+)\]/g)) {
  const [w, h, density] = match.slice(1).map(Number)
  densities.set(`${w * density}-${h * density}`, density)
  densities.set(`${h * density}-${w * density}`, density)
}

let count = 0
for (const file of await fs.readdir(splashDir)) {
  const match = /^apple-splash-(\d+)-(\d+)\.png$/.exec(file)
  if (!match) continue
  const [width, height] = match.slice(1).map(Number)
  const dpr = densities.get(`${width}-${height}`)
  if (!dpr) throw new Error(`Splash device not declared: ${file}`)
  const size = MARK * dpr
  const image = await sharp(mark).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
  await sharp({ create: { width, height, channels: 3, background: GREEN } })
    .composite([{ input: image, gravity: "centre" }])
    .removeAlpha()
    .png()
    .toFile(path.join(splashDir, file))
  count += 1
}
console.log(JSON.stringify({ splashes: count, background: GREEN, markCssPx: MARK }))
