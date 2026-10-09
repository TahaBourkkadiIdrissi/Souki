// Isolated UI verification: in-memory API only, never the production database.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '..')
const user = { id: 7, role: 'CLIENT', roles: ['CLIENT'], permissions: ['checkout.create'], is_verified: true, is_active: true, default_dashboard: '/', onboarding_completed: true }
const products = [
  { id: 1, nom_fr: 'Tomates', nom_darija: 'tomates', prix_kg: 12, prix_affiche: 12, unite: 'kg', stock: 10, is_active: true, niveau: 2, image_url: '/placeholder.svg' },
  { id: 2, nom_fr: 'Carottes', nom_darija: 'carottes', prix_kg: 8, prix_affiche: 8, unite: 'kg', stock: 10, is_active: true, niveau: 1, image_url: '/placeholder.svg' },
]
let closed = false, saves = 0, nearCutoff = false
let order = { commande_id: 1, version: 1, editable: true, reason: null, deadline: '2026-10-10T01:00:00Z', server_time: '2026-10-09T23:00:00Z', date_livraison: '2026-10-10', creneau_livraison: '10:00', mode_paiement: 'wallet', items: [{ product_id: 1, name: 'Tomates', unit: 'kg', quantity: 5, unit_price: 10, subtotal: 50 }], subtotal: 50, delivery_fee: 15, total: 65, previous_total: 65, difference: 0 }
const api = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  const url = req.url.split('?')[0]
  if (url === '/auth/me') return res.end(JSON.stringify(user))
  if (url === '/api/catalogue') return res.end(JSON.stringify(products))
  if (url === '/api/order-schedule') return res.end(JSON.stringify({ closed, server_time: closed ? '2026-10-10T01:00:00Z' : nearCutoff ? '2026-10-10T00:59:58Z' : order.server_time, next_transition: closed ? '2026-10-10T08:00:00Z' : order.deadline, delivery_date: closed ? null : order.date_livraison }))
  if (url === '/api/commandes/historique') return res.end(JSON.stringify([{ id: 1, ...order, statut: 'EN_ATTENTE', montant_total: order.total, produits: order.items.map(item => ({ product_id: item.product_id, nom_fr: item.name, quantite_kg: item.quantity, sous_total: item.subtotal })) }]))
  if (url.startsWith('/api/commandes/1/modification')) {
    if (req.method === 'GET') return res.end(JSON.stringify({ ...order, server_time: nearCutoff ? '2026-10-10T00:59:58Z' : order.server_time, editable: !closed, reason: closed ? 'Cette commande est clôturée.' : null }))
    let body = ''; for await (const chunk of req) body += chunk
    const payload = JSON.parse(body)
    assert.equal(payload.expected_version, order.version)
    const items = payload.items.map(item => ({ ...item, name: item.product_id === 1 ? 'Tomates' : 'Carottes', unit: 'kg', unit_price: item.product_id === 1 ? 10 : 8, subtotal: item.quantity * (item.product_id === 1 ? 10 : 8) }))
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
    const total = subtotal + (subtotal < 300 ? 15 : 0)
    const quote = { ...order, items, subtotal, total, delivery_fee: total - subtotal, previous_total: order.total, difference: total - order.total }
    if (req.method === 'PATCH') {
      assert.equal(payload.expected_total, total)
      saves++; order = { ...quote, version: order.version + 1 }
    }
    return res.end(JSON.stringify(quote))
  }
  res.end('[]')
})
await new Promise(resolve => api.listen(3429, '127.0.0.1', resolve))
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3420'], {
  cwd: path.join(root, 'apps/client'), windowsHide: true,
  env: { ...process.env, BACKEND_INTERNAL_URL: 'http://127.0.0.1:3429', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', value => process.stdout.write(value))
child.stderr.on('data', value => process.stderr.write(value))
let browser
try {
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, bypassCSP: true })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  page.setDefaultTimeout(60000)
  for (let i = 0; ; i++) {
    try { await page.goto('http://127.0.0.1:3420/commandes/1/modifier', { timeout: 120000 }); break }
    catch (e) { if (i > 25 || !String(e).includes('ERR_CONNECTION_REFUSED')) throw e; await new Promise(resolve => setTimeout(resolve, 500)) }
  }
  await page.getByRole('button', { name: 'Augmenter Tomates' }).click()
  await page.getByRole('button', { name: 'Ajouter Carottes' }).click()
  await page.getByRole('button', { name: 'Retirer Carottes' }).click()
  await page.getByRole('button', { name: 'Vérifier le nouveau total' }).click()
  await page.getByText('Nouveau total : 70.00 DH').waitFor()
  await page.getByText('Complément débité du Wallet : 5.00 DH').waitFor()
  assert.equal(saves, 0)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await mkdir(path.join(root, 'outputs/order-edit'), { recursive: true })
  await page.screenshot({ path: path.join(root, 'outputs/order-edit/mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click()
  await page.waitForURL('**/historique?commande_modifiee=1')
  await page.getByText('Votre commande N-1 a été modifiée avec succès.').waitFor()
  assert.equal(saves, 1)
  const dismissInstall = page.getByRole('button', { name: "Masquer l'installation" })
  if (await dismissInstall.isVisible()) await dismissInstall.click()
  await page.getByRole('link', { name: 'Modifier ma commande' }).click()
  await page.getByRole('button', { name: 'Diminuer Tomates' }).click()
  await page.getByRole('button', { name: 'Vérifier le nouveau total' }).click()
  await page.getByText('Montant recrédité au Wallet : 5.00 DH').waitFor()
  nearCutoff = true
  await page.reload()
  await page.getByText('La clôture est atteinte. Cette commande ne peut plus être modifiée.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Vérifier le nouveau total' }).isDisabled(), true)
  assert.equal(saves, 1)
  closed = true
  await page.reload()
  await page.getByText('Cette commande est clôturée.').waitFor()
  assert.equal(await page.getByRole('button', { name: 'Augmenter Tomates' }).isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log('PASS: add/remove, server quote, wallet debit/credit display, explicit save, history link and live 01:00 cutoff.')
} finally {
  await browser?.close()
  child.kill()
  api.closeAllConnections(); api.close()
}
