// Visuels de la fiche Google Play de l'app SOUKI (PWA emballee, apps/play-store-pwa/store) :
// - icon-512.png : icone haute resolution (512 × 512, PNG), la meme que l'icone de la PWA ;
// - feature-graphic.png : banniere (1024 × 500, PNG sans transparence), logo et panier sur creme.
// Usage : node tools/generate-play-store-pwa-assets.mjs
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "apps/client/package.json"))
const sharp = createRequire(require.resolve("next/package.json"))("sharp")

const publicDir = path.join(root, "apps/client/public")
const out = path.join(root, "apps/play-store-pwa/store")
await fs.mkdir(out, { recursive: true })

await sharp(path.join(publicDir, "brand/souki-2026/pwa-512.png")).resize(512, 512).png().toFile(path.join(out, "icon-512.png"))

const CREAM = "#FBFBF7"
const logo = await sharp(path.join(publicDir, "brand/souki-2026/horizontal.png")).resize({ width: 400 }).png().toBuffer()
const logoMeta = await sharp(logo).metadata()
const basket = await sharp(path.join(publicDir, "images/launch/basket.webp")).resize({ height: 350 }).png().toBuffer()
const basketMeta = await sharp(basket).metadata()
await sharp({ create: { width: 1024, height: 500, channels: 3, background: CREAM } })
  .composite([
    { input: logo, left: 60, top: Math.round((500 - logoMeta.height) / 2) },
    { input: basket, left: 1024 - basketMeta.width - 48, top: Math.round((500 - basketMeta.height) / 2) + 10 },
  ])
  .removeAlpha()
  .png()
  .toFile(path.join(out, "feature-graphic.png"))

console.log(JSON.stringify({ out: path.relative(root, out), files: await fs.readdir(out) }))
