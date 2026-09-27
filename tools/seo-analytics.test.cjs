const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('../apps/client/node_modules/typescript')

const code = ts.transpileModule(fs.readFileSync('apps/client/lib/analytics.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText

function client(storage = new Map(), env = {}, denied = false) {
  const window = { location: { search: '' }, localStorage: {
    getItem(key) { if (denied) throw Error('denied'); return storage.get(key) ?? null },
    setItem(key, value) { if (denied) throw Error('denied'); storage.set(key, value) },
  } }
  const context = { exports: {}, window, URLSearchParams, process: { env: {
    NODE_ENV: 'production', NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-TEST', ...env,
  } } }
  vm.runInNewContext(code, context)
  return { api: context.exports, window }
}

const order = { commande_id: 202, sous_total: 60, frais_livraison: 15, montant_total: 75,
  lignes: [{ product_id: 38, nom_produit: 'Tomates', prix_unitaire: 12, quantite: 5 }] }

test('purchase queues confirmed prices and excludes shipping from ecommerce value', () => {
  const { api, window } = client()
  api.trackPurchase(order)
  const [type, name, params] = window.dataLayer[0]
  assert.equal(type, 'event'); assert.equal(name, 'purchase')
  assert.equal(params.transaction_id, '202'); assert.equal(params.currency, 'MAD')
  assert.equal(params.value, 60); assert.equal(params.shipping, 15)
  assert.equal(params.items[0].price, 12); assert.equal(params.items[0].quantity, 5)
})

test('duplicate confirmation, reload and back-navigation share persistent deduplication', () => {
  const storage = new Map(); const first = client(storage)
  first.api.trackPurchase(order); first.api.trackPurchase(order)
  assert.equal(first.window.dataLayer.length, 1)
  const reloaded = client(storage); reloaded.api.trackPurchase(order)
  assert.equal(reloaded.window.dataLayer, undefined)
})

test('denied or corrupt local storage does not break confirmed checkout', () => {
  const denied = client(new Map(), {}, true)
  assert.doesNotThrow(() => denied.api.trackPurchase(order))
  denied.api.trackPurchase(order); assert.equal(denied.window.dataLayer.length, 1)
  const corrupt = client(new Map([['souki-ga4-purchases', '{}']]))
  assert.doesNotThrow(() => corrupt.api.trackPurchase(order))
  assert.equal(corrupt.window.dataLayer.length, 1)
})

test('older confirmed transactions remain deduplicated after many later purchases', () => {
  const storage = new Map(); const original = client(storage)
  for (let index = 0; index < 150; index++) original.api.trackPurchase({ ...order, commande_id: 202 + index })
  const reloaded = client(storage); reloaded.api.trackPurchase(order)
  assert.equal(reloaded.window.dataLayer, undefined)
})

test('old API, invalid values and unconfirmed IDs never fabricate a transaction', () => {
  const { api, window } = client()
  for (const invalid of [{ ...order, lignes: undefined }, { ...order, commande_id: undefined },
    { ...order, sous_total: NaN }, { ...order, lignes: [{ ...order.lignes[0], quantite: -1 }] }]) {
    api.trackPurchase(invalid)
  }
  assert.equal(window.dataLayer, undefined)
})

test('development traffic is disabled unless explicitly in debug mode', () => {
  const disabled = client(new Map(), { NODE_ENV: 'development' })
  disabled.api.trackPurchase(order); assert.equal(disabled.window.dataLayer, undefined)
  const debug = client(new Map(), { NODE_ENV: 'development', NEXT_PUBLIC_GA_DEBUG: 'true' })
  debug.api.trackPurchase(order)
  assert.equal(debug.window.dataLayer[0][2].debug_mode, true)
  assert.equal(debug.window.dataLayer[0][2].traffic_type, 'developer')
})
