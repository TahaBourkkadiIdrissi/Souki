// Isolated application checks: no production API, account or order is touched.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const products = ['Carottes', 'Brocoli', 'Tomates'].map((nom_fr, i) => ({ id: i + 1, nom_fr, nom_darija: nom_fr, niveau: i + 1, prix_kg: 12, prix_affiche: 12, unite: 'kg', stock: 50, is_active: true, availability: 'in_stock' }))
let userId = 1, driverMode = false, favoriteFailure = false, eventStatus = 503, eventCalls = [], tourneeCalls = 0
const user = () => ({ id: userId, email: `test${userId}@example.test`, role: driverMode ? 'LIVREUR' : 'CLIENT', roles: [driverMode ? 'LIVREUR' : 'CLIENT'], permissions: ['checkout.create', 'livreur.dashboard.access'], onboarding_completed: true, is_verified: true, is_active: true })
const tournee = () => ({ status: 'success', date_jour: new Date().toISOString().slice(0, 10), available_after: '07:00', sort_strategy: 'test', tournee_started: true, tournee_id: 10, pickup: null, ramassee: true, ramasse_at: new Date().toISOString(), items: [{ commande_id: 101, client_phone: null, client_label: 'Test', street: 'Rue test', neighborhood: null, details: null, full_address: 'Rue test, Fes', colis_count: 1, creneau_livraison: '10:00', statut: 'EN_ROUTE', status_version: 1, montant_total: 60, mode_paiement: 'wallet', payment_validated: true, lat: null, lng: null }] })
const api = createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json')
  let body = ''; for await (const c of req) body += c
  const path = req.url.split('?')[0]
  let result = []
  if (path === '/auth/me') result = user()
  else if (path === '/api/catalogue') result = products
  else if (path === '/api/catalogue/suggestions') result = products.filter(p => !JSON.parse(body || '{}').exclude_ids?.includes(p.id))
  else if (path === '/api/user/favorites') { if (favoriteFailure) res.statusCode = 503; result = favoriteFailure ? { detail: 'temporary' } : [products[userId - 1]] }
  else if (path === '/api/user/suggestions') result = [products[userId - 1]]
  else if (path === '/api/user/profile') result = { prenom: 'Test', nom: 'Souki', email: 'test@example.test', telephone: '0612345678', address: {} }
  else if (path === '/api/user/bootstrap') result = { profile: { telephone: '0612345678', address: {} }, wallet: { balance_centimes: 10000 } }
  else if (path === '/api/livreur/tournee') { tourneeCalls++; result = tournee() }
  else if (path.endsWith('/events')) {
    const event = JSON.parse(body); eventCalls.push(event)
    res.statusCode = eventStatus
    result = eventStatus === 200 ? { ...event, commande_id: 101, new_status: event.target_status, status_version: 2, message: 'Synchronise', server_timestamp: new Date().toISOString(), idempotent: false } : { detail: 'test failure' }
  }
  res.end(JSON.stringify(result))
})
await new Promise(resolve => api.listen(3439, '127.0.0.1', resolve))
const children = []
let browser
try {
  for (const [app, port] of [['client', 3430], ['livreur', 3431]]) {
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: `apps/${app}`, windowsHide: true,
      env: { ...process.env, BACKEND_INTERNAL_URL: 'http://127.0.0.1:3439', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    child.stdout.on('data', c => process.stdout.write(c)); child.stderr.on('data', c => process.stderr.write(c))
  }
  browser = await chromium.launch({ headless: true, channel: 'msedge' })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, bypassCSP: true, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  await context.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }) })
  const page = await context.newPage(); page.setDefaultTimeout(45000)
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  async function visit(target, url) {
    for (let i = 0; ; i++) {
      try { await target.goto(url, { timeout: 120000 }); return }
      catch (e) { if (i > 25 || !String(e).includes('ERR_CONNECTION_REFUSED')) throw e; await new Promise(r => setTimeout(r, 1000)) }
    }
  }
  await visit(page, 'http://127.0.0.1:3430/checkout')
  await page.getByRole('heading', { name: 'Votre panier est vide' }).waitFor()
  assert.equal(await page.getByText('Tomates Marocaines').count(), 0)
  await page.goto('http://127.0.0.1:3430/catalogue')
  await page.waitForFunction(() => localStorage.getItem('souki:v2:user:1:cart') !== null)
  await page.getByRole('button', { name: 'Ajouter Carottes', exact: true }).first().click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('souki:v2:user:1:cart') || '[]').length === 1)
  await page.goto('http://127.0.0.1:3430/checkout')
  await page.getByRole('heading', { name: 'Votre panier est vide' }).waitFor({ state: 'hidden' })
  await page.getByText('Carottes', { exact: true }).first().waitFor()
  console.log('PASS: direct checkout empty, then real account cart restored')

  await page.goto('http://127.0.0.1:3430/favoris?preview=pwa')
  await page.getByRole('heading', { name: 'Carottes', exact: true }).first().waitFor()
  userId = 2; favoriteFailure = true
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: { token: 'cookie-session' } })))
  await page.getByRole('heading', { name: 'Carottes', exact: true }).waitFor({ state: 'hidden' })
  await page.goto('http://127.0.0.1:3430/checkout')
  await page.getByRole('heading', { name: 'Votre panier est vide' }).waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('souki:v2:user:1:cart')).length), 1)
  userId = 1; favoriteFailure = false
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: { token: 'cookie-session' } })))
  await page.getByText('Carottes', { exact: true }).first().waitFor()
  console.log('PASS: account switching and failed favorites API never show previous account data')

  await page.goto('http://127.0.0.1:3430/pwa-welcome?preview=pwa')
  await page.getByRole('heading', { name: 'Recommandé pour vous' }).waitFor()
  await page.getByRole('button', { name: 'Ajouter 0.5 kg de Carottes', exact: true }).first().click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('souki:v2:user:1:cart'))[0].quantity === 1)
  await page.evaluate(() => window.scrollTo(0, 500))
  assert.equal(await page.locator('main').getAttribute('data-motion-paused'), 'true')
  await mkdir('tmp/reliability', { recursive: true })
  await page.screenshot({ path: 'tmp/reliability/pwa.png' })
  console.log('PASS: PWA scoped quick-add and reduced-motion path')

  driverMode = true
  const driver = await context.newPage(); driver.setDefaultTimeout(45000)
  driver.on('pageerror', e => errors.push(e.message))
  await visit(driver, 'http://127.0.0.1:3431/livreur')
  await driver.waitForFunction(() => document.body.innerText.includes('Test'))
  async function queue(id) {
    await driver.evaluate(async id => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('souki-livreur-sync-1', 1); r.onupgradeneeded = () => r.result.createObjectStore('sync_queue', { keyPath: 'clientEventId' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      await new Promise((resolve, reject) => { const tx = db.transaction('sync_queue', 'readwrite'); tx.objectStore('sync_queue').put({ clientEventId: id, commandeId: '101', targetStatus: 'LIVRE', expectedVersion: 1, deviceTimestamp: new Date().toISOString(), createdAt: Date.now() }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
      db.close(); window.dispatchEvent(new Event('souki:delivery-queue-changed')); window.dispatchEvent(new Event('online'))
    }, id)
  }
  async function queuedCount() {
    return driver.evaluate(async () => {
      const db = await new Promise(resolve => { const r = indexedDB.open('souki-livreur-sync-1', 1); r.onsuccess = () => resolve(r.result) })
      const count = await new Promise(resolve => { const r = db.transaction('sync_queue').objectStore('sync_queue').count(); r.onsuccess = () => resolve(r.result) }); db.close(); return count
    })
  }
  async function waitUntil(check, timeout = 30000) {
    const end = Date.now() + timeout
    while (!(await check())) { assert(Date.now() < end, 'condition timed out'); await new Promise(r => setTimeout(r, 200)) }
  }
  for (const status of [503, 429]) {
    eventStatus = status; eventCalls = []
    await queue(`retry-${status}`)
    await waitUntil(() => eventCalls.length > 0)
    assert.equal(await queuedCount(), 1)
    await driver.getByRole('status').filter({ hasText: 'en attente de synchronisation' }).waitFor()
    eventStatus = 200
    await waitUntil(async () => (await queuedCount()) === 0)
    assert(eventCalls.length >= 2)
    assert(eventCalls.every(e => e.client_event_id === `retry-${status}`))
  }
  eventStatus = 401; eventCalls = []
  await queue('expired-session'); await waitUntil(() => eventCalls.length > 0)
  const attempts = eventCalls.length
  await new Promise(r => setTimeout(r, 6000))
  assert.equal(eventCalls.length, attempts); assert.equal(await queuedCount(), 1)
  eventStatus = 200
  await driver.evaluate(() => window.dispatchEvent(new CustomEvent('auth-token-changed', { detail: { token: 'cookie-session' } })))
  await waitUntil(async () => (await queuedCount()) === 0)
  eventStatus = 409; const previousFetches = tourneeCalls
  await queue('conflict'); await waitUntil(async () => (await queuedCount()) === 0 && tourneeCalls > previousFetches)
  console.log('PASS: durable queue retains 503/429, retries same IDs, suspends 401, resumes session, refreshes 409')
  assert.deepEqual(errors, [])
} finally {
  await browser?.close()
  for (const child of children) child.kill()
  api.closeAllConnections(); api.close()
}
