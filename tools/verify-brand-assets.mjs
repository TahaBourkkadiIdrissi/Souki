import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import vm from "node:vm"

const root = path.resolve(import.meta.dirname, "..")
const require = createRequire(path.join(root, "apps/client/package.json"))
const sharp = createRequire(require.resolve("next/package.json"))("sharp")
const results = []
for (const role of ["client", "livreur", "admin"]) {
  const publicDir = path.join(root, "apps", role, "public")
  const brand = path.join(publicDir, "brand/souki-2026")
  for (const [file, width, height, alpha] of [
    ["horizontal.png", 1825, 611, true], ["secondary.png", 1189, 1156, true],
    ["symbol.png", 625, 611, true], ["submark.png", 1254, 1254, false],
    ["apple-touch-icon.png", 180, 180, false],
    ...[16, 32, 48].map(s => [`favicon-${s}.png`, s, s, false]),
    ...[192, 512].flatMap(s => [[`pwa-${s}.png`, s, s, false], [`pwa-maskable-${s}.png`, s, s, false]]),
  ]) {
    const metadata = await sharp(path.join(brand, file)).metadata()
    assert.equal(metadata.width, width, file)
    assert.equal(metadata.height, height, file)
    assert.equal(metadata.hasAlpha, alpha, file)
  }
  for (const size of [192, 512]) {
    const { data, info } = await sharp(path.join(brand, `pwa-maskable-${size}.png`)).raw().toBuffer({ resolveWithObject: true })
    let radius = 0
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * info.channels
      // The supplied white artwork, including its antialiased edges.
      if (data[i] > 100 && data[i + 1] > 150 && data[i + 2] > 150) {
        radius = Math.max(radius, Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2))
      }
    }
    assert(radius > size * 0.25, "symbol must not be missing")
    assert(radius < size * 0.4, "complete symbol must fit the circular safe zone")
    assert.notDeepEqual(await fs.readFile(path.join(brand, `pwa-${size}.png`)), await fs.readFile(path.join(brand, `pwa-maskable-${size}.png`)))
    results.push({ role, size, maskableMaxRadius: radius, safeRadius: size * 0.4 })
  }
  const ico = await fs.readFile(path.join(brand, "favicon.ico"))
  assert.equal(ico.readUInt16LE(4), 3)
  assert.deepEqual([0, 1, 2].map(i => [ico[6 + 16 * i], ico[7 + 16 * i]]), [[16, 16], [32, 32], [48, 48]])
  if (role === "admin") continue
  const source = await fs.readFile(path.join(publicDir, "sw.js"), "utf8")
  const listeners = new Map()
  const deleted = []
  const old = role === "client" ? "souki-pwa-v10" : "souki-livreur-pwa-v10"
  const current = old.replace("v10", role === "client" ? "v12-launch-circle" : "v11-brand2026")
  const unrelated = ["souki-user-data", "other-app-cache", old.replace("v10", "user-data")]
  let staticAssets = []
  vm.runInNewContext(source, {
    self: { addEventListener: (type, handler) => listeners.set(type, handler), skipWaiting: () => {}, clients: { claim: () => {} } },
    caches: { keys: async () => [old, current, ...unrelated], delete: async key => deleted.push(key), open: async () => ({ addAll: async assets => { staticAssets = assets } }) },
    URL,
  })
  let pending
  listeners.get("install")({ waitUntil: p => { pending = p } }); await pending
  for (const asset of staticAssets) {
    if (["/offline", "/pwa-welcome", "/manifest.webmanifest"].includes(asset)) continue
    await fs.access(path.join(publicDir, asset))
  }
  listeners.get("activate")({ waitUntil: p => { pending = p } }); await pending
  assert.deepEqual(deleted, [old], "update deletes only old resource caches")
  assert(!/localStorage|indexedDB|clearSiteData|deleteDatabase/.test(source))
}
const splashes = await fs.readdir(path.join(root, "apps/client/public/brand/souki-2026/splash"))
assert.equal(splashes.length, 36)
for (const name of splashes) {
  const [, w, h] = /apple-splash-(\d+)-(\d+)\.png/.exec(name)
  const meta = await sharp(path.join(root, "apps/client/public/brand/souki-2026/splash", name)).metadata()
  assert.equal(meta.width, Number(w)); assert.equal(meta.height, Number(h)); assert.equal(meta.hasAlpha, false)
}
console.log(JSON.stringify({ passed: true, splashes: splashes.length, maskable: results }, null, 2))
