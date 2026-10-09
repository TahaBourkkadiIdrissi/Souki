const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('../apps/client/node_modules/typescript')

function load(file, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const context = { exports: {}, Date, Intl, ...globals }
  vm.runInNewContext(code, context, { filename: file })
  return context.exports
}

const hours = load('apps/client/lib/order-hours.ts')
test('evening and midnight show the same delivery date across the year boundary', () => {
  assert.equal(hours.getOrderHours(new Date('2026-12-31T23:59:59Z')).deliveryDate, '2027-01-01')
  assert.equal(hours.getOrderHours(new Date('2027-01-01T00:59:59Z')).deliveryDate, '2027-01-01')
  assert.equal(hours.getOrderHours(new Date('2027-01-01T01:00:00Z')).deliveryDate, null)
  assert.equal(hours.getOrderHours(new Date('2027-01-01T08:00:00Z')).deliveryDate, '2027-01-02')
})

test('server schedule corrects device clock and flips the lock at closure', async () => {
  let instant = Date.parse('2026-10-09T12:00:00Z'), calls = 0
  class Clock extends Date { static now() { return instant } }
  const schedule = load('apps/client/lib/order-schedule-client.ts', {
    Date: Clock,
    require: name => name === './order-hours' ? hours : {
      getOrderSchedule: async () => { calls++; return {
        closed: false, server_time: '2026-10-10T00:59:59Z',
        next_transition: '2026-10-10T01:00:00Z', delivery_date: '2026-10-10',
      } },
    },
  })
  await Promise.all([schedule.refreshOrderSchedule(), schedule.refreshOrderSchedule()])
  assert.equal(calls, 1)
  assert.equal(schedule.getCurrentOrderHours().closed, false)
  assert.equal(schedule.getCurrentOrderHours().deliveryDate, '2026-10-10')
  instant += 1000
  assert.equal(schedule.getCurrentOrderHours().closed, true)
  instant += 7 * 3600 * 1000
  assert.equal(schedule.getCurrentOrderHours().closed, false)
  assert.equal(schedule.getCurrentOrderHours().deliveryDate, '2026-10-11')
})

test('Moroccan opening boundaries do not depend on the device timezone', () => {
  for (const tz of ['UTC', 'America/New_York', 'Asia/Tokyo', 'Africa/Casablanca']) {
    const previous = process.env.TZ
    process.env.TZ = tz
    try {
      for (const [instant, closed, remaining] of [
        ['2026-10-01T07:59:59Z', true, 1],
        ['2026-10-01T08:00:00Z', false, 17 * 3600],
        ['2026-10-01T00:59:59Z', false, 1],
        ['2026-10-01T01:00:00Z', true, 7 * 3600],
        ['2026-10-01T20:00:00Z', false, 5 * 3600],
        ['2026-10-01T23:00:00Z', false, 2 * 3600],
      ]) {
        const now = new Date(instant)
        const result = hours.getOrderHours(now)
        assert.equal(result.closed, closed, `${tz}: ${instant}`)
        assert.equal((result.nextTransition - now.getTime()) / 1000, remaining)
      }
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  }
})

test('next opening accounts for Moroccan Ramadan clock changes', () => {
  // 2026: clocks move back February 15, forward March 22.
  for (const [instant, expected] of [
    ['2026-02-15T00:00:00Z', '2026-02-15T08:00:00Z'],
    ['2026-03-22T01:00:00Z', '2026-03-22T07:00:00Z'],
  ]) assert.equal(hours.getOrderHours(new Date(instant)).nextTransition, Date.parse(expected))
})

function storageHarness() {
  const data = new Map([['souki-cart', '[{"id":99}]'], ['souki_favorites', '[99]']])
  const events = new EventTarget()
  let denyRead = false, denyWrite = false
  const window = { localStorage: {
    getItem: (key) => { if (denyRead) throw Error('denied'); return data.get(key) ?? null },
    setItem: (key, value) => { if (denyWrite) throw Error('quota'); data.set(key, value) },
  }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) }
  return { api: load('apps/client/lib/client-storage.ts', { window, Event }), data,
    deny: (read, write) => { denyRead = read; denyWrite = write } }
}

test('guest, two accounts and unresolved sessions have isolated carts/favorites/history', () => {
  const { api, data } = storageHarness()
  for (const collection of ['cart', 'favorites', 'recent-products']) {
    assert.equal(api.readClientCollection(collection, 1).length, 0)
    for (const owner of [null, 1, 2]) api.writeClientCollection(collection, owner, [owner])
    for (const owner of [null, 1, 2]) assert.equal(api.readClientCollection(collection, owner)[0], owner)
    api.writeClientCollection(collection, undefined, ['wrong'])
    assert.equal(api.readClientCollection(collection, undefined).length, 0)
  }
  assert.equal(data.get('souki-cart'), '[{"id":99}]', 'unowned legacy data is never reassigned')
})

test('late callbacks retain their original owner and snapshots update across tabs', () => {
  const { api, data } = storageHarness()
  const lateRollback = () => api.writeClientCollection('favorites', 1, [12])
  api.writeClientCollection('favorites', 2, [23])
  lateRollback()
  assert.equal(api.readClientCollection('favorites', 2)[0], 23)
  const first = api.readClientCollection('favorites', 2)
  assert.equal(first, api.readClientCollection('favorites', 2), 'stable React snapshot')
  data.set(api.clientStorageKey('favorites', 2), '[24]')
  assert.equal(api.readClientCollection('favorites', 2)[0], 24)
})

test('corrupt storage, blocked reads and quota failures do not break account isolation', () => {
  const { api, data, deny } = storageHarness()
  data.set(api.clientStorageKey('cart', 1), 'invalid')
  assert.equal(api.readClientCollection('cart', 1).length, 0)
  deny(false, true)
  api.writeClientCollection('cart', 1, [{ id: 7 }])
  assert.equal(api.readClientCollection('cart', 1)[0].id, 7)
  deny(true, true)
  assert.equal(api.readClientCollection('cart', 1)[0].id, 7)
  assert.equal(api.readClientCollection('cart', 2).length, 0)
})

const policy = load('apps/livreur/lib/delivery-sync-policy.ts')
test('delivery events survive temporary errors and expired sessions; conflicts are distinct', () => {
  for (const status of [undefined, 408, 425, 429, 500, 502, 503, 504]) assert.equal(policy.deliverySyncFailure(status), 'retry')
  for (const status of [401, 403]) assert.equal(policy.deliverySyncFailure(status), 'session')
  assert.equal(policy.deliverySyncFailure(409), 'conflict')
  for (const status of [400, 404, 410, 422]) assert.equal(policy.deliverySyncFailure(status), 'reject')
  assert.equal(policy.deliveryRetryDelay(1), 5000)
  assert.equal(policy.deliveryRetryDelay(2), 10000)
  assert.equal(policy.deliveryRetryDelay(100), 300000)
})

test('parallax batches scrolls, avoids React state, pauses hidden/reduced motion and cleans up', () => {
  const windowEvents = new EventTarget(), docEvents = new EventTarget(), mq = new EventTarget()
  mq.matches = false
  const css = new Map(), frames = new Map(), main = { dataset: {} }
  let id = 0, cleanup
  const document = { hidden: false, addEventListener: docEvents.addEventListener.bind(docEvents), removeEventListener: docEvents.removeEventListener.bind(docEvents) }
  const window = { scrollY: 200, matchMedia: () => mq, addEventListener: windowEvents.addEventListener.bind(windowEvents), removeEventListener: windowEvents.removeEventListener.bind(windowEvents), requestAnimationFrame: (cb) => { frames.set(++id, cb); return id }, cancelAnimationFrame: (id) => frames.delete(id) }
  const api = load('apps/client/hooks/useHomeParallax.ts', { window, document, require: () => ({ useEffect: (effect) => { cleanup = effect() } }) })
  api.useHomeParallax({ current: { offsetHeight: 600, style: { setProperty: (k, v) => css.set(k, v) }, closest: () => main } }, true)
  for (let i = 0; i < 100; i++) windowEvents.dispatchEvent(new Event('scroll'))
  assert.equal(frames.size, 1)
  document.hidden = true; docEvents.dispatchEvent(new Event('visibilitychange'))
  assert.equal(frames.size, 0); assert.equal(main.dataset.motionPaused, 'true')
  document.hidden = false; mq.matches = true; docEvents.dispatchEvent(new Event('visibilitychange'))
  assert.equal(css.get('--hero-slow'), '0px')
  windowEvents.dispatchEvent(new Event('scroll')); assert.equal(frames.size, 0)
  mq.matches = false; mq.dispatchEvent(new Event('change')); assert.equal(main.dataset.motionPaused, 'false')
  cleanup(); windowEvents.dispatchEvent(new Event('scroll')); assert.equal(frames.size, 0)
})

test('countdown timer is confined to its component and stops while the app is hidden', () => {
  const events = new EventTarget(), timers = new Map()
  let cleanup, renders = 0, id = 0
  const document = { hidden: false, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) }
  const window = { setInterval: cb => { timers.set(++id, cb); return id }, clearInterval: id => timers.delete(id) }
  const hook = load('apps/client/hooks/useOrderCountdown.ts', { window, document,
    require: name => name === 'react' ? { useState: () => [null, () => { renders++ }], useEffect: effect => { cleanup = effect() } } :
      name.includes('order-schedule-client') ? { getCurrentOrderHours: hours.getOrderHours, refreshOrderSchedule: () => Promise.resolve(), subscribeOrderSchedule: () => () => {} } : hours,
  })
  hook.useOrderCountdown()
  assert.equal(timers.size, 1); assert.equal(renders, 1)
  timers.values().next().value(); assert.equal(renders, 2)
  document.hidden = true; events.dispatchEvent(new Event('visibilitychange'))
  assert.equal(timers.size, 0); assert.equal(renders, 2)
  document.hidden = false; events.dispatchEvent(new Event('visibilitychange'))
  assert.equal(timers.size, 1); assert.equal(renders, 3)
  cleanup(); assert.equal(timers.size, 0)
})

test('outdated mobile timezone data does not shift the current Moroccan order window', () => {
  const staleIntl = { DateTimeFormat: class { formatToParts() { throw Error('stale ICU must not decide current dates') } } }
  const api = load('apps/client/lib/order-hours.ts', { Intl: staleIntl })
  assert.equal(api.getOrderHours(new Date('2026-10-01T19:59:59Z')).closed, false)
  assert.equal(api.getOrderHours(new Date('2026-10-01T20:00:00Z')).closed, false)
  assert.equal(api.getOrderHours(new Date('2026-10-01T20:00:00Z')).nextTransition, Date.parse('2026-10-02T01:00:00Z'))
})
