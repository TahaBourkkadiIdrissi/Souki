import fs from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(new URL("../apps/client/package.json", import.meta.url))
const sharp = createRequire(require.resolve("next/package.json"))("sharp")
// Supplied circular artwork, resized losslessly at >3x its largest CSS size.
const target = new URL("../apps/client/public/brand/souki-2026/launch-circle.webp", import.meta.url)
await fs.writeFile(target, await sharp(fileURLToPath(new URL("../assets/branding/source/submark.png", import.meta.url)))
  .resize(512, 512).webp({ lossless: true }).toBuffer())
console.log("Generated launch-circle.webp (512px)")

// Keep the native iOS launch frame aligned with min(34vmin, 136px) in CSS.
const layout = await fs.readFile(new URL("../apps/client/app/layout.tsx", import.meta.url), "utf8")
const devices = layout.match(/const APPLE_SPLASH_DEVICES[^=]+\= \[([\s\S]+?)\n\]/)[1]
const densities = new Map()
for (const match of devices.matchAll(/\[(\d+), (\d+), (\d+)\]/g)) {
  const [w, h, dpr] = match.slice(1).map(Number)
  densities.set(`${w * dpr}-${h * dpr}`, dpr)
  densities.set(`${h * dpr}-${w * dpr}`, dpr)
}
const splash = new URL("../apps/client/public/brand/souki-2026/splash/", import.meta.url)
for (const file of await fs.readdir(splash)) {
  const match = /^apple-splash-(\d+)-(\d+)\.png$/.exec(file)
  if (!match) continue
  const [width, height] = match.slice(1).map(Number)
  const dpr = densities.get(`${width}-${height}`)
  if (!dpr) throw new Error(`Unknown splash density: ${file}`)
  const size = Math.round(Math.min(Math.min(width, height) * 0.34, 136 * dpr))
  const logo = await sharp(fileURLToPath(target)).resize(size, size).png().toBuffer()
  await fs.writeFile(new URL(file, splash), await sharp({ create: { width, height, channels: 3, background: "#FFFFFF" } })
    .composite([{ input: logo, gravity: "centre" }]).removeAlpha().png().toBuffer())
}
console.log("Updated native iOS launch screens")
