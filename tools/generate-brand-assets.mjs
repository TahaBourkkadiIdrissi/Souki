import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "apps/client/package.json"))
const sharp = createRequire(require.resolve("next/package.json"))("sharp")
const source = path.join(root, "assets/branding/source")
const brand = "brand/souki-2026"
const green = "#005B43"

// Crop only transparent margins. Keep every non-transparent source pixel.
async function transparentBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let left = info.width, top = info.height, right = 0, bottom = 0
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y)
      right = Math.max(right, x); bottom = Math.max(bottom, y)
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 }
}

const horizontal = await transparentBounds(path.join(source, "logo-primaire.png"))
const secondary = await transparentBounds(path.join(source, "logo-secondaire.png"))
const croppedHorizontal = await sharp(path.join(source, "logo-primaire.png")).extract(horizontal).png().toBuffer()
const croppedSecondary = await sharp(path.join(source, "logo-secondaire.png")).extract(secondary).png().toBuffer()
// The bag is the left, separate part of the supplied horizontal logo.
const symbol = await sharp(path.join(source, "logo-primaire.png"))
  .extract({ left: horizontal.left, top: horizontal.top, width: 625, height: horizontal.height }).png().toBuffer()
const symbolBounds = await transparentBounds(path.join(source, "logo-primaire.png"))
const iconSource = path.join(source, "favicon.png")

for (const app of ["client", "livreur", "admin"]) {
  const publicDir = path.join(root, "apps", app, "public")
  const dest = path.join(publicDir, brand)
  await fs.mkdir(dest, { recursive: true })
  await fs.writeFile(path.join(dest, "horizontal.png"), croppedHorizontal)
  await fs.writeFile(path.join(dest, "secondary.png"), croppedSecondary)
  await fs.writeFile(path.join(dest, "symbol.png"), symbol)
  await fs.copyFile(path.join(source, "submark.png"), path.join(dest, "submark.png"))
  await fs.copyFile(path.join(source, "favicon.ico"), path.join(publicDir, "favicon.ico"))
  await fs.copyFile(path.join(source, "favicon.ico"), path.join(dest, "favicon.ico"))
  for (const size of [16, 32, 48]) {
    await sharp(iconSource).resize(size, size).png().toFile(path.join(dest, `favicon-${size}.png`))
  }
  for (const size of [180, 192, 512]) {
    await sharp(iconSource).resize(size, size).png().toFile(path.join(dest, size === 180 ? "apple-touch-icon.png" : `pwa-${size}.png`))
  }
  for (const size of [192, 512]) {
    // Resize the opaque supplied artwork, never recolor or reconstruct its symbol.
    // At 68% the complete symbol fits inside the 40%-radius safe circle.
    const inset = Math.round(size * 0.68)
    const image = await sharp(iconSource).resize(inset, inset).png().toBuffer()
    const margin = Math.floor((size - inset) / 2)
    // Extend the supplied green edge pixels to avoid a visible color seam.
    await sharp(image).extend({
      top: margin, left: margin,
      bottom: size - inset - margin, right: size - inset - margin,
      extendWith: "copy",
    }).png().toFile(path.join(dest, `pwa-maskable-${size}.png`))
  }
  if (app === "client") {
    const splashDir = path.join(dest, "splash")
    await fs.mkdir(splashDir, { recursive: true })
    const layout = await fs.readFile(path.join(root, "apps/client/app/layout.tsx"), "utf8")
    const devices = layout.match(/const APPLE_SPLASH_DEVICES[^=]+\= \[([\s\S]+?)\n\]/)[1]
    const densities = new Map()
    for (const match of devices.matchAll(/\[(\d+), (\d+), (\d+)\]/g)) {
      const [w, h, density] = match.slice(1).map(Number)
      densities.set(`${w * density}-${h * density}`, density)
      densities.set(`${h * density}-${w * density}`, density)
    }
    for (const file of await fs.readdir(path.join(publicDir, "splash"))) {
      const match = /^apple-splash-(\d+)-(\d+)\.png$/.exec(file)
      if (!match) continue
      const [width, height] = match.slice(1).map(Number)
      const dpr = densities.get(`${width}-${height}`)
      if (!dpr) throw new Error(`Splash device not declared: ${file}`)
      const size = Math.round(Math.min(Math.min(width, height) * 0.34, 136 * dpr))
      const image = await sharp(path.join(source, "submark.png")).resize(size, size).png().toBuffer()
      await sharp({ create: { width, height, channels: 3, background: "#FFFFFF" } })
        .composite([{ input: image, gravity: "centre" }]).removeAlpha().png().toFile(path.join(splashDir, file))
    }
  }
}
console.log(JSON.stringify({ brand, green, horizontal, secondary, symbol: { width: 625, height: symbolBounds.height } }, null, 2))
