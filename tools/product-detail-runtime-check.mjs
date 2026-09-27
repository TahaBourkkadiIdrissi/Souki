// Isolated browser check: all API traffic uses an in-memory catalogue.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const products = [
  { id: 1, nom_fr: 'Tomates', nom_darija: 'maticha', description: 'Tomates de test pour salade.', prix_kg: 10, prix_affiche: 10, unite: 'kg', stock: 20, is_active: true, niveau: 2, image_url: '/placeholder.svg', marge_cible: .25, coussin_securite: .1, volatilite: 'STABLE', prix_gros_saisi: 7, prix_khddar_reel: 12, prix_vente_manuel: 10, prix_khddar_estime: 12, alerte: null, availability: 'in_stock' },
  { id: 2, nom_fr: 'Carottes', nom_darija: 'khizou', description: 'Carottes de test pour soupe.', prix_kg: 8, prix_affiche: 8, unite: 'kg', stock: 20, is_active: true, niveau: 1, image_url: '/placeholder.svg', availability: 'in_stock' },
]
const user = { id: 1, role: 'ADMIN', roles: ['ADMIN'], permissions: ['admin.panel.access', 'products.manage'], is_verified: true, is_active: true, default_dashboard: '/admin', onboarding_completed: true }
const api = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const url = req.url.split('?')[0]
  if (url === '/auth/me') return res.end(JSON.stringify(user))
  if (url === '/api/catalogue') return res.end(JSON.stringify(products))
  if (url === '/api/produits/pricing') return res.end(JSON.stringify({ items: [products[0]], total: 1, nb_alertes: 0 }))
  if (url === '/api/produits/1/pricing' && req.method === 'PATCH') {
    let body = ''; for await (const chunk of req) body += chunk
    Object.assign(products[0], JSON.parse(body))
    return res.end(JSON.stringify(products[0]))
  }
  if (url.includes('favorites')) return res.end(JSON.stringify({ product_ids: [] }))
  res.end('[]')
})
await new Promise(resolve => api.listen(3419, '127.0.0.1', resolve))
const children = []
const logs = []
let browser
try {
  for (const [app, port] of [['client', 3410], ['admin', 3411]]) {
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: path.join(root, 'apps', app), windowsHide: true,
      env: { ...process.env, BACKEND_INTERNAL_URL: 'http://127.0.0.1:3419', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    child.stdout.on('data', chunk => { logs.push(String(chunk)); process.stdout.write(chunk) })
    child.stderr.on('data', chunk => { logs.push(String(chunk)); process.stderr.write(chunk) })
  }
  browser = await chromium.launch({ headless: true, channel: process.env.SOUKI_TEST_BROWSER || 'msedge' })
  // The production CSP disallows webpack dev's eval. Bypass only in this test context.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, bypassCSP: true })
  await mobile.route('**/*', route => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' || url.protocol === 'data:' ? route.continue() : route.abort()
  })
  const page = await mobile.newPage()
  page.on('pageerror', error => console.error('Client browser error:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.error('Client console:', message.text()) })
  page.setDefaultTimeout(60000)
  for (let attempt = 0; ; attempt++) {
    try { await page.goto('http://127.0.0.1:3410/catalogue', { timeout: 120000 }); break }
    catch (error) { if (!String(error).includes('ERR_CONNECTION_REFUSED') || attempt > 30 || children.some(child => child.exitCode !== null)) throw error; await new Promise(resolve => setTimeout(resolve, 1000)) }
  }
  await page.waitForFunction(() => {
    const link = document.querySelector('a[aria-label="Voir Tomates"]')
    return link && Object.keys(link).some(key => key.startsWith('__reactProps$'))
  }, null, { timeout: 60000 })
  await page.getByRole('link', { name: 'Voir Tomates', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Fiche produit Tomates' })
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /Tomates de test pour salade/)
  await dialog.getByRole('button', { name: 'Augmenter', exact: true }).click()
  assert.match(await dialog.innerText(), /10\.00 DH/)
  await dialog.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('link', { name: 'Voir Carottes', exact: true }).first().click()
  assert.match(await page.getByRole('dialog').innerText(), /Carottes de test pour soupe/)
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.goto('http://127.0.0.1:3410/pwa-welcome?preview=pwa', { timeout: 120000 })
  await page.getByRole('button', { name: 'Voir Tomates', exact: true }).first().click()
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /Tomates de test pour salade/)
  console.log('PASS: catalogue and home clicks use the same product sheet; descriptions are product-specific.')
  const admin = await browser.newPage({ viewport: { width: 1600, height: 1000 }, bypassCSP: true })
  admin.setDefaultTimeout(60000)
  await admin.goto('http://127.0.0.1:3411/admin/pricing', { timeout: 120000 })
  await admin.getByRole('button', { name: 'Modifier', exact: true }).first().click()
  await admin.getByLabel('Description du produit').fill('Description modifiée depuis admin.')
  const [saved] = await Promise.all([
    admin.waitForResponse(response => response.url().endsWith('/api/produits/1/pricing') && response.request().method() === 'PATCH'),
    admin.getByRole('button', { name: 'Sauvegarder', exact: true }).click(),
  ])
  assert.equal(saved.status(), 200)
  await admin.getByLabel('Description du produit').waitFor({ state: 'hidden' })
  await admin.getByText('Description modifiée depuis admin.', { exact: true }).waitFor()
  assert.equal(products[0].description, 'Description modifiée depuis admin.')
  await page.reload()
  await page.getByRole('link', { name: 'Voir Tomates', exact: true }).first().click()
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /Description modifiée depuis admin/)
  await mkdir(path.join(root, 'outputs/product-detail'), { recursive: true })
  await page.screenshot({ path: path.join(root, 'outputs/product-detail/mobile.png') })
  console.log('PASS: admin saves the description and the client displays the updated text.')
} finally {
  await browser?.close()
  for (const child of children) child.kill()
  api.closeAllConnections(); api.close()
  await mkdir(path.join(root, 'outputs/product-detail'), { recursive: true })
  await writeFile(path.join(root, 'outputs/product-detail/runtime.log'), logs.join(''))
}
