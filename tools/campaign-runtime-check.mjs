// Isolated test: ephemeral SQLite, fake authentication and catalogue, real campaign service/routes.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '..')
await mkdir(path.join(root, 'tmp/campaign-runtime'), { recursive: true })
await mkdir(path.join(root, 'outputs/campaign'), { recursive: true })
const apiSource = `
import sys, os, uuid
sys.path.insert(0, os.path.join(os.getcwd(), "back-end"))
from fastapi import FastAPI, Request, Response, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from controllers.campaign_controller import campaign_router, get_campaign_service
from services.campaign_service import CampaignService
from dao.campaign_dao import CampaignDao
from entities.campaign_entity import Campaign, CampaignVisit, CampaignOrder
from entities.commande_entity import Commande
import uvicorn
engine = create_engine("sqlite:///tmp/campaign-runtime/" + uuid.uuid4().hex + ".sqlite", connect_args={"check_same_thread": False})
for model in (Campaign, CampaignVisit, Commande, CampaignOrder): model.__table__.create(engine)
app = FastAPI()
def service():
    with Session(engine) as session: yield CampaignService(CampaignDao(), session)
app.dependency_overrides[get_campaign_service] = service
def admin(request: Request):
    if request.cookies.get("runtime_admin") != "1": raise HTTPException(403)
    return type("Principal", (), {"user_id": 7})()
for route in campaign_router.routes:
    for dep in route.dependant.dependencies:
        if dep.name == "principal": app.dependency_overrides[dep.call] = admin
app.include_router(campaign_router)
def user(role="CLIENT"):
    return dict(id=7, email="test@example.com", role=role, roles=[role], permissions=["checkout.create", "admin.panel.access"], is_verified=True, is_active=True, default_dashboard="/", onboarding_completed=True)
products = [dict(id=1, nom_fr="Tomates", nom_darija="tomates", prix_kg=10, prix_affiche=10, unite="kg", stock=20, is_active=True, niveau=2, image_url="/placeholder.svg", availability="in_stock", description="Tomates du test local.")]
@app.get("/auth/me")
def me(request: Request):
    if request.cookies.get("runtime_admin"): return user("ADMIN")
    if request.cookies.get("runtime_user"): return user()
    raise HTTPException(401)
@app.post("/auth/login")
def login(response: Response):
    response.set_cookie("runtime_user", "1", httponly=True)
    return {"user": user()}
@app.post("/auth/register")
async def register(request: Request):
    body = await request.json()
    assert body["prenom"] == "Salma" and body["nom"] == "Test"
    return {"id": 7, "verification_channel": "email", "verification_target": "t***@example.com", "role": "CLIENT"}
@app.post("/auth/verify-otp")
def verify(response: Response):
    response.set_cookie("runtime_user", "1", httponly=True)
    return {"access_token": "test-only", "onboarding_completed": True}
@app.get("/api/catalogue")
def catalogue(): return products
@app.get("/api/order-schedule")
def schedule(): return dict(closed=False, server_time="2026-10-11T12:00:00Z", next_transition="2026-10-12T01:00:00Z", delivery_date="2026-10-12")
@app.post("/api/checkout")
async def checkout(request: Request):
    assert request.cookies.get("runtime_user")
    body = await request.json()
    with Session(engine) as session:
        row = Commande(statut="EN_ATTENTE", montant_total=25)
        session.add(row); session.flush()
        CampaignService(CampaignDao(), session).attribute_order(request.cookies.get("souki_qr_visit"), row.id)
        session.commit()
        return dict(commande_id=row.id, sous_total=10, frais_livraison=15, montant_total=25, date_livraison="2026-10-12", lignes=[dict(product_id=1, nom_produit="Tomates", prix_unitaire=10, quantite=1)])
@app.get("/api/user/bootstrap")
def profile(): return {"profile": {"prenom": "Salma", "nom": "Test", "telephone": "+212612345678", "address": {"adresse": "Rue du test", "ville": "Fès"}}, "wallet": {"balance_centimes": 10000}}
@app.api_route("/{rest:path}", methods=["GET", "POST", "PUT"])
def fallback(rest: str):
    if "blacklist" in rest: return {"is_blacklisted": False}
    return []
uvicorn.run(app, host="127.0.0.1", port=3479, log_level="warning")
`
await writeFile(path.join(root, 'tmp/campaign-runtime/api.py'), apiSource)
const children = [], logs = []
function start(exe, args, cwd, env = {}) {
  const child = spawn(exe, args, { cwd, windowsHide: true, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs.push(String(data)); process.stdout.write(data) })
  return child
}
let browser
try {
  start(path.join(root, 'tmp/seo-venv/Scripts/python.exe'), ['tmp/campaign-runtime/api.py'], root, { SECRET_KEY: 'runtime-only-not-production', CAMPAIGN_PUBLIC_ORIGIN: 'http://127.0.0.1:3470', COOKIE_SECURE: '0' })
  for (const [app, port] of [['client', 3470], ['admin', 3471]]) start(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], path.join(root, 'apps', app), { BACKEND_INTERNAL_URL: 'http://127.0.0.1:3479', NEXT_TELEMETRY_DISABLED: '1' })
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  const contexts = []
  async function context(viewport = { width: 390, height: 844 }) {
    const ctx = await browser.newContext({ viewport, bypassCSP: true, userAgent: 'Mozilla/5.0 Chrome/130 Safari/537.36' })
    contexts.push(ctx)
    await ctx.route('**/*', route => ['127.0.0.1'].includes(new URL(route.request().url()).hostname) || route.request().url().startsWith('data:') ? route.continue() : route.abort())
    return ctx
  }
  const client = await context(), admin = await context({ width: 1440, height: 1000 })
  await admin.addCookies([{ name: 'runtime_admin', value: '1', url: 'http://127.0.0.1:3471' }])
  const page = await client.newPage(), dashboard = await admin.newPage(), errors = []
  for (const target of [page, dashboard]) { target.setDefaultTimeout(45000); target.on('pageerror', error => errors.push(error.message)) }
  async function go(target, url) {
    for (let attempt = 0; ; attempt++) {
      try { await target.goto(url, { timeout: 120000 }); return }
      catch (e) { if (attempt > 30 || !String(e).includes('ERR_CONNECTION_REFUSED') || children.some(child => child.exitCode !== null)) throw e; await new Promise(resolve => setTimeout(resolve, 500)) }
    }
  }
  await go(dashboard, 'http://127.0.0.1:3471/admin/compaign')
  await dashboard.getByRole('heading', { name: 'Compagne', exact: true }).waitFor()
  await dashboard.getByRole('button', { name: 'Nouveau QR code' }).click()
  await dashboard.getByLabel('Nom de la campagne', { exact: true }).fill('Flyer Narjiss')
  await dashboard.getByLabel('Identifiant du lien court').fill('narjiss')
  await dashboard.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await dashboard.getByRole('img', { name: 'QR code Flyer Narjiss' }).waitFor()
  const svgBefore = await dashboard.getByRole('img', { name: 'QR code Flyer Narjiss' }).getAttribute('src')
  const downloaded = dashboard.waitForEvent('download')
  await dashboard.getByRole('button', { name: 'PNG', exact: true }).click()
  assert.match((await downloaded).suggestedFilename(), /narjiss.png$/)
  await go(page, 'http://127.0.0.1:3470/r/narjiss')
  assert.match(page.url(), /utm_source=flyer/)
  await page.waitForFunction(() => document.querySelector('a[aria-label="Voir Tomates"]') && Object.keys(document.querySelector('a[aria-label="Voir Tomates"]')).some(key => key.startsWith('__reactProps$')))
  const dismiss = page.getByRole('button', { name: "Masquer l'installation" })
  if (await dismiss.isVisible()) await dismiss.click()
  await page.getByRole('link', { name: 'Voir Tomates', exact: true }).first().click()
  const product = page.getByRole('dialog', { name: 'Fiche produit Tomates' })
  await product.getByRole('button', { name: 'Augmenter', exact: true }).click()
  await product.getByRole('button', { name: /Ajouter au panier/ }).click()
  await page.reload()
  assert.match(page.url(), /catalogue/)
  await page.getByRole('button', { name: /Voir le panier/ }).click()
  await page.getByRole('button', { name: 'Valider la commande', exact: true }).click()
  await page.waitForURL('**/login/client?redirect=%2Fcheckout')
  await page.getByPlaceholder('votre@email.com ou 06XXXXXXXX').fill('test@example.com')
  await page.locator('input[type="password"]').fill('Password1')
  await page.getByRole('button', { name: 'Se connecter', exact: true }).last().click()
  await page.waitForURL('**/checkout')
  await page.getByText('Tomates', { exact: true }).first().waitFor()
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('souki:v2:user:7:cart')).length), 1)
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('souki:v2:guest:cart')).length), 0)
  await page.screenshot({ path: path.join(root, 'outputs/campaign/guest-checkout.png'), fullPage: true })
  // Verify server attribution using the same signed browser cookie, after login.
  const purchase = await client.request.post('http://127.0.0.1:3470/backend/api/checkout', { data: { items: [{ product_id: 1, quantity: 1 }] } })
  assert.equal(purchase.status(), 200)
  await go(page, 'http://127.0.0.1:3470/r/narjiss')
  const second = await context(), other = await second.newPage()
  await go(other, 'http://127.0.0.1:3470/r/narjiss')
  await dashboard.getByRole('button', { name: 'Actualiser', exact: true }).click()
  const row = dashboard.getByRole('row').filter({ hasText: 'Flyer Narjiss' })
  await row.getByRole('cell', { name: '3', exact: true }).waitFor()
  await row.getByRole('cell', { name: '2', exact: true }).waitFor()
  await row.getByRole('cell', { name: '1', exact: true }).waitFor()
  await dashboard.getByRole('button', { name: 'Modifier Flyer Narjiss' }).click()
  await dashboard.getByLabel('Page de destination').fill('/faq')
  await dashboard.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await dashboard.getByText('Campagne mise à jour. Le QR imprimé reste identique.').waitFor()
  assert.equal(await dashboard.getByRole('img', { name: 'QR code Flyer Narjiss' }).getAttribute('src'), svgBefore)
  await go(page, 'http://127.0.0.1:3470/r/narjiss')
  assert.match(page.url(), /\/faq\?utm_source=/)
  await dashboard.getByRole('button', { name: 'Nouveau QR code' }).click()
  await dashboard.getByLabel('Nom de la campagne', { exact: true }).fill('Flyer Agdal')
  await dashboard.getByLabel('Identifiant du lien court').fill('agdal')
  await dashboard.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await dashboard.getByRole('img', { name: 'QR code Flyer Agdal' }).waitFor()
  await dashboard.screenshot({ path: path.join(root, 'outputs/campaign/admin.png'), fullPage: true })
  await dashboard.getByRole('button', { name: 'Modifier Flyer Narjiss' }).click()
  await dashboard.getByLabel('Lien actif').uncheck()
  await dashboard.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await dashboard.getByRole('cell', { name: 'Désactivé', exact: true }).waitFor()
  const disabled = await client.request.get('http://127.0.0.1:3470/r/narjiss', { maxRedirects: 0 })
  assert.equal(disabled.status(), 302)
  assert.equal(disabled.headers().location, 'http://127.0.0.1:3470/catalogue')
  assert.equal(disabled.headers()['set-cookie'], undefined)
  const guest = await context(), pwa = await guest.newPage()
  await go(pwa, 'http://127.0.0.1:3470/pwa-welcome?preview=pwa')
  await pwa.getByText('Tout le marché', { exact: true }).waitFor()
  assert(!pwa.url().includes('login'))
  // Registration must preserve the same pending checkout, including the existing name fields.
  await go(pwa, 'http://127.0.0.1:3470/r/agdal')
  await pwa.waitForFunction(() => document.querySelector('a[aria-label="Voir Tomates"]') && Object.keys(document.querySelector('a[aria-label="Voir Tomates"]')).some(key => key.startsWith('__reactProps$')))
  const signupDismiss = pwa.getByRole('button', { name: "Masquer l'installation" })
  if (await signupDismiss.isVisible()) await signupDismiss.click()
  await pwa.getByRole('link', { name: 'Voir Tomates', exact: true }).first().click()
  const signupProduct = pwa.getByRole('dialog', { name: 'Fiche produit Tomates' })
  await signupProduct.getByRole('button', { name: 'Augmenter', exact: true }).click()
  await signupProduct.getByRole('button', { name: /Ajouter au panier/ }).click()
  await pwa.getByRole('button', { name: /Voir le panier/ }).click()
  await pwa.getByRole('button', { name: 'Valider la commande', exact: true }).click()
  await pwa.getByRole('button', { name: "S'inscrire", exact: true }).click()
  await pwa.getByPlaceholder('Prénom', { exact: true }).fill('Salma')
  await pwa.getByPlaceholder('Nom', { exact: true }).fill('Test')
  await pwa.getByPlaceholder('votre@email.com', { exact: true }).fill('test@example.com')
  await pwa.getByPlaceholder('6XX-XXXXXX').fill('612345678')
  await pwa.locator('input[type="password"]').nth(0).fill('Password123!')
  await pwa.locator('input[type="password"]').nth(1).fill('Password123!')
  await pwa.locator('span').filter({ hasText: /^J.accepte la/ }).locator('..').locator('div').first().click()
  await pwa.getByRole('button', { name: 'Créer mon compte', exact: true }).click()
  await pwa.waitForURL('**/verify?**')
  await pwa.locator('input[data-input-otp]').fill('123456')
  await pwa.getByRole('button', { name: 'Vérifier le code', exact: true }).click()
  await pwa.waitForURL('**/checkout')
  await pwa.getByText('Tomates', { exact: true }).first().waitFor()
  assert.equal(await pwa.evaluate(() => JSON.parse(localStorage.getItem('souki:v2:user:7:cart')).length), 1)
  assert.equal(await pwa.evaluate(() => JSON.parse(localStorage.getItem('souki:v2:guest:cart')).length), 0)
  assert.deepEqual(errors, [])
  console.log('PASS: guest cart survives reload/login/signup and OTP, PWA public; real campaign create/edit/pause, unchanged QR, PNG export, repeat/unique visits and order attribution.')
} finally {
  await browser?.close()
  for (const child of children) child.kill()
  await writeFile(path.join(root, 'outputs/campaign/runtime.log'), logs.join(''))
}
