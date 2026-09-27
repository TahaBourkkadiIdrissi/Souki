// Test built frontends behind Nginx against an isolated catalogue fixture.
// No production database, user account, payment, or analytics request is used.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { chromium } from 'playwright'
import vm from 'node:vm'
import ts from '../apps/client/node_modules/typescript/lib/typescript.js'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'outputs/seo/runtime')
const nginxRoot = path.join(root, 'tmp/nginx-1.28.0')
const configRoot = path.join(root, 'tmp/seo-nginx')
await fs.mkdir(output, { recursive: true })
await fs.mkdir(configRoot, { recursive: true })
await fs.mkdir(path.join(configRoot, 'cache'), { recursive: true })
const slash = value => value.replaceAll('\\', '/')
const cert = path.join(configRoot, 'test-cert.pem')
const key = path.join(configRoot, 'test-key.pem')
const openssl = process.env.SOUKI_TEST_OPENSSL || 'C:/Program Files/Git/usr/bin/openssl.exe'
const generated = spawnSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,DNS:admin.localhost,DNS:livreur.localhost'], { encoding: 'utf8', windowsHide: true })
assert.equal(generated.status, 0, generated.stderr)
const ca = await fs.readFile(cert)
let template = await fs.readFile(path.join(root, 'infra/nginx/default.conf.template'), 'utf8')
template = template.replaceAll('${CLIENT_HOST}', 'localhost').replaceAll('${ADMIN_HOST}', 'admin.localhost')
  .replaceAll('${LIVREUR_HOST}', 'livreur.localhost')
  .replaceAll('listen 80', 'listen 3380').replaceAll('listen 443', 'listen 3443')
  .replaceAll('/etc/nginx/proxy.conf', slash(path.join(configRoot, 'proxy.conf')))
  .replaceAll('/etc/nginx/certs/fullchain.pem', slash(cert)).replaceAll('/etc/nginx/certs/privkey.pem', slash(key))
  .replaceAll('/var/cache/nginx/souki_static', slash(path.join(configRoot, 'cache')))
  .replaceAll('http://backend:8000', 'http://127.0.0.1:3319')
  .replaceAll('http://client:3000', 'http://127.0.0.1:3310')
  .replaceAll('http://admin:3000', 'http://127.0.0.1:3311')
  .replaceAll('http://livreur:3000', 'http://127.0.0.1:3312')
await fs.copyFile(path.join(root, 'infra/nginx/proxy.conf'), path.join(configRoot, 'proxy.conf'))
const configPath = path.join(configRoot, 'nginx.conf')
await fs.writeFile(configPath, `pid ${slash(path.join(configRoot, 'nginx.pid'))};\nevents {}\nhttp {\n${template}\n}\n`)
const nginxExe = path.join(nginxRoot, 'nginx.exe')
const nginxArgs = ['-p', slash(nginxRoot) + '/', '-c', slash(configPath)]
const checked = spawnSync(nginxExe, [...nginxArgs, '-t'], { encoding: 'utf8', windowsHide: true })
await fs.writeFile(path.join(output, 'nginx-test.txt'), checked.stdout + checked.stderr)
assert.equal(checked.status, 0, checked.stderr)

const product = (id, name, stock, availability, updated_at = null, is_active = true) => ({
  id, nom_fr: name, nom_darija: name, prix_kg: 10, prix_affiche: 12, prix_khddar_estime: 13,
  niveau: 2, unite: 'kg', image_url: id === 1 ? '/images/legumes/pomme-de-terre.png' : null, stock, availability, updated_at, is_active,
})
const products = [product(38, 'Tomates', 3, 'in_stock', '2026-09-27T12:00:00Z'),
  product(4, 'Carottes', 0, 'preorder'), product(1, 'Pommes de terre', 0, 'out_of_stock'),
  product(99, 'Produit désactivé', 1, 'in_stock', null, false)]
const backend = http.createServer((req, res) => {
  if (req.url === '/api/catalogue') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(products))
  } else { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end('{"detail":"Test unauthenticated"}') }
})
const children = []
const logs = []
let browser
const report = { fixture: true, checks: [], screenshots: [], images: [], limitations: [
  'Isolated synthetic catalogue; no real checkout, DebugView, or production deployment verified.',
  'Local Nginx 1.28 Windows; production container nginx -t remains required.',
] }

function start(command, args, options, name) {
  const log = createWriteStream(path.join(output, `${name}.log`)); logs.push(log)
  const child = spawn(command, args, { ...options, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.pipe(log); child.stderr.pipe(log); children.push(child)
  return child
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
async function ready(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(url)).ok) return } catch {}
    await delay(200)
  }
  throw Error(`Service did not become ready: ${url}`)
}
function request(route, host = 'localhost') {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: 'localhost', port: 3443, path: route, ca,
      headers: { Host: host, Accept: 'text/html' } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, rawHeaders: res.rawHeaders,
        body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(Error('Request timed out')))
  })
}
function headers(response, privatePage = false) {
  for (const key of ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'content-security-policy', 'permissions-policy', 'x-frame-options', 'cache-control']) {
    assert.equal(response.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === key).length, 1, `${key} must appear once`)
  }
  assert.equal(response.headers['x-content-type-options'], 'nosniff')
  assert.equal(response.headers['x-frame-options'], 'DENY')
  assert.ok(response.headers['content-security-policy'].includes("frame-ancestors 'none'"))
  if (privatePage) assert.equal(response.headers['x-robots-tag'], 'noindex, nofollow')
}

try {
  await new Promise(resolve => backend.listen(3319, '127.0.0.1', resolve))
  const services = []
  for (const [index, app] of ['client', 'admin', 'livreur'].entries()) {
    const source = path.join(root, 'apps', app)
    const built = path.join(source, '.next/standalone/apps', app)
    await fs.access(path.join(source, '.next/BUILD_ID'))
    await fs.cp(path.join(source, 'public'), path.join(built, 'public'), { recursive: true })
    await fs.cp(path.join(source, '.next/static'), path.join(built, '.next/static'), { recursive: true })
    services.push(start(process.execPath, ['server.js'], { cwd: built, env: { ...process.env,
      HOSTNAME: '127.0.0.1', PORT: String(3310 + index), BACKEND_INTERNAL_URL: 'http://127.0.0.1:3319' } }, app))
  }
  await Promise.all([3310, 3311, 3312].map(port => ready(`http://127.0.0.1:${port}/`)))
  start(nginxExe, nginxArgs, { cwd: nginxRoot }, 'nginx')
  await delay(400)
  for (const route of ['/', '/catalogue', '/produit/tomates-38', '/produit/carottes-4', '/produit/pommes-de-terre-1', '/checkout', '/missing-page', '/_next/static/missing.js', '/missing.png']) {
    const res = await request(route); headers(res)
    assert.equal(res.headers['cache-control'], 'no-store')
    if (route.includes('missing')) assert.equal(res.status, 404)
    else assert.equal(res.status, 200)
    if (route === '/' || route === '/catalogue') {
      assert.match(res.body, /href="\/produit\/tomates-38"/)
      assert.match(res.body, /Tomates/)
      assert.doesNotMatch(res.body, /Produit désactivé/)
    }
    if (route === '/checkout') assert.match(res.body, /name="robots" content="noindex, nofollow"/)
    if (route.startsWith('/produit/')) {
      const schema = JSON.parse(res.body.match(/<script type="application\/ld\+json">({"@context":"https:\/\/schema.org","@type":"Product".*?)<\/script>/s)[1])
      assert.equal(schema.offers.priceCurrency, 'MAD'); assert.equal(schema.offers.price, '12.00')
      const availability = route.includes('tomates') ? 'InStock' : route.includes('carottes') ? 'PreOrder' : 'OutOfStock'
      assert.equal(schema.offers.availability, `https://schema.org/${availability}`)
      if (availability === 'OutOfStock') assert.match(res.body, /<button[^>]*disabled=""/)
    }
    await fs.writeFile(path.join(output, route.replaceAll('/', '_') + '.html'), res.body)
    report.checks.push({ route, status: res.status, headers: res.headers })
  }
  const sitemap = await request('/sitemap.xml')
  assert.equal(sitemap.status, 200); assert.equal(sitemap.headers['cache-control'], 'public, max-age=0, must-revalidate')
  assert.match(sitemap.body, /2026-09-27T12:00:00/)
  assert.equal((sitemap.body.match(/<lastmod>/g) || []).length, 1)
  assert.equal((sitemap.body.match(/<loc>/g) || []).length, 9)
  assert.doesNotMatch(sitemap.body, /checkout|désactivé|99<\/loc>/)
  const robots = await request('/robots.txt'); assert.equal(robots.status, 200)
  assert.match(robots.body, /Sitemap: https:\/\/souki.io\/sitemap.xml/)
  const home = await request('/')
  const assetPath = home.body.match(/src="(\/_next\/static\/[^\"]+\.js)"/)[1]
  const asset = await request(assetPath)
  assert.equal(asset.status, 200); headers(asset)
  assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable')
  const redirect = await request('/produit/ancien-nom-38')
  assert.equal(redirect.status, 308); assert.ok(redirect.headers.location.endsWith('/produit/tomates-38'))
  for (const host of ['admin.localhost', 'livreur.localhost']) {
    for (const route of ['/', '/unknown', '/_next/static/missing.js']) {
      const res = await request(route, host); headers(res, true)
      assert.equal(res.headers['cache-control'], 'no-store')
      report.checks.push({ host, route, status: res.status, headers: res.headers })
    }
  }
  // A real upstream failure must retain security/noindex and must not be cached.
  services[1].kill(); await new Promise(resolve => services[1].once('exit', resolve))
  const unavailable = await request('/', 'admin.localhost')
  assert.equal(unavailable.status, 502); headers(unavailable, true)
  assert.equal(unavailable.headers['cache-control'], 'no-store')
  report.checks.push({ host: 'admin.localhost', route: '/', status: 502, headers: unavailable.headers })
  await fs.writeFile(path.join(output, 'sitemap.xml'), sitemap.body)

  // Compare the same local source image at a mobile width to its original file.
  const optimized = await fetch('http://127.0.0.1:3310/_next/image?url=%2Fimages%2Flegumes%2Ftomate.png&w=384&q=75', { headers: { Accept: 'image/webp' } })
  assert.equal(optimized.status, 200)
  const bytes = Buffer.from(await optimized.arrayBuffer())
  const originalBytes = (await fs.stat(path.join(root, 'apps/client/public/images/legumes/tomate.png'))).size
  assert.ok(bytes.length < originalBytes)
  report.images.push({ source: '/images/legumes/tomate.png', width: 384, originalBytes, optimizedBytes: bytes.length, contentType: optimized.headers.get('content-type') })

  // Check every source from the captured public catalogue, including uploads.
  const catalogueFile = path.join(root, 'outputs/seo/baseline-2026-09-27/souki.io_backend_api_catalogue.html')
  try {
    const captured = JSON.parse(await fs.readFile(catalogueFile, 'utf8'))
    const exports = {}
    vm.runInNewContext(ts.transpileModule(await fs.readFile(path.join(root, 'apps/client/lib/catalogue.ts'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText, { exports, require: () => ({ apiCall() {} }) })
    const active = captured.filter(product => product.is_active)
    report.catalogueImages = []
    for (let offset = 0; offset < active.length; offset += 4) {
      await Promise.all(active.slice(offset, offset + 4).map(async product => {
        const source = exports.resolveCatalogueImage(product.nom_fr, product.image_url)
        const response = await fetch(`http://127.0.0.1:3310/_next/image?url=${encodeURIComponent(source)}&w=384&q=75`, {
          headers: { Accept: 'image/webp' }, signal: AbortSignal.timeout(30000),
        })
        if (response.ok) {
          report.catalogueImages.push({ id: product.id, source, status: response.status,
            bytes: (await response.arrayBuffer()).byteLength, contentType: response.headers.get('content-type') })
        } else {
          const fallback = exports.getCatalogueFallbackImage(product.nom_fr)
          const alternative = await fetch(`http://127.0.0.1:3310${fallback}`)
          assert.equal(alternative.status, 200, `Missing fallback for ${product.nom_fr}`)
          report.catalogueImages.push({ id: product.id, source, status: response.status, fallback, fallbackVerified: true })
        }
      }))
    }
  } catch (error) {
    if (error.code === 'ENOENT') report.limitations.push('No public catalogue snapshot available for complete image-source checks.')
    else throw error
  }

  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await context.route('**/*', route => /google-analytics|googletagmanager/.test(route.request().url()) ? route.abort() : route.continue())
  for (const [name, route] of [['home', '/'], ['catalogue', '/catalogue'], ['product', '/produit/tomates-38']]) {
    const page = await context.newPage()
    await page.goto(`http://127.0.0.1:3310${route}?ga_debug=1`, { waitUntil: 'domcontentloaded' })
    await page.locator('h1:visible, article:visible').first().waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForFunction(() => [...document.images].filter(img => {
      const r = img.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0
    }).every(img => img.complete && img.naturalWidth > 0), null, { timeout: 30000 })
    await page.evaluate(async () => {
      await Promise.all([...document.images].filter(img => img.complete && img.naturalWidth > 0).map(img => img.decode().catch(() => {})))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const install = page.getByRole('button', { name: "Masquer l'installation" })
    if (await install.isVisible()) await install.click()
    await page.screenshot({ path: path.join(output, `${name}-viewport.png`) })
    await page.screenshot({ path: path.join(output, `${name}-mobile.png`), fullPage: true })
    const visual = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      images: [...document.images].filter(img => { const r = img.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0 })
        .map(img => ({ src: img.currentSrc, loaded: img.complete && img.naturalWidth > 0, width: img.getBoundingClientRect().width })) }))
    assert.equal(visual.overflow, false, `${name}: mobile horizontal overflow`)
    assert.ok(visual.images.every(img => img.loaded), `${name}: broken first-screen image`)
    if (await page.locator('article img').count()) {
      const first = page.locator('article img').first()
      await first.scrollIntoViewIfNeeded()
      await page.waitForFunction(() => {
        const img = document.querySelector('article img')
        return img?.complete && img.naturalWidth > 0
      }, null, { timeout: 30000 })
      await first.evaluate(img => img.decode())
      await first.locator('..').screenshot({ path: path.join(output, `${name}-card.png`) })
      visual.card = await first.evaluate(img => ({
        image: { opacity: getComputedStyle(img).opacity, visibility: getComputedStyle(img).visibility, zIndex: getComputedStyle(img).zIndex },
        siblings: [...img.parentElement.children].map(el => ({ tag: el.tagName, class: el.className,
          background: getComputedStyle(el).backgroundColor, zIndex: getComputedStyle(el).zIndex })),
      }))
    }
    report.screenshots.push({ name, ...visual }); await page.close()
  }
  report.passed = true
} catch (error) {
  report.passed = false; report.failure = error.stack; throw error
} finally {
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  await browser?.close()
  spawnSync(nginxExe, [...nginxArgs, '-s', 'quit'], { cwd: nginxRoot, windowsHide: true })
  for (const child of children) if (child.exitCode === null) child.kill()
  await new Promise(resolve => backend.close(resolve))
  for (const log of logs) log.end()
}
console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, images: report.images, screenshots: report.screenshots.map(x => x.name) }))
