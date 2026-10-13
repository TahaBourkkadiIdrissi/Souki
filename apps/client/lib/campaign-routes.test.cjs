const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')
const routes = require('./campaign-routes.json')
const app = path.resolve(__dirname, '../app')

function collectRoutes(dir, segments = [], names = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue
    if (entry.isDirectory()) {
      collectRoutes(path.join(dir, entry.name), /^\(.+\)$|^@/.test(entry.name) ? segments : [...segments, entry.name], names)
    } else if (/^(page|route)\.[jt]sx?$/.test(entry.name) && segments.length && !segments[0].startsWith('[')) {
      names.add(segments[0])
    } else if (!segments.length && /^(robots|sitemap|manifest|opengraph-image|twitter-image|icon|apple-icon)\./.test(entry.name)) {
      const stem = entry.name.split('.')[0]
      names.add(({ robots: 'robots.txt', sitemap: 'sitemap.xml', manifest: 'manifest.webmanifest' })[stem] || stem)
    }
  }
  return names
}

test('every application route and public root asset is reserved before deployment', () => {
  const names = collectRoutes(app)
  for (const entry of fs.readdirSync(path.resolve(__dirname, '../public'))) names.add(entry)
  for (const name of names) assert(routes.reserved.includes(name.toLowerCase()), `Ajouter "${name}" à campaign-routes.json avant de créer cette route/ressource`)
  for (const name of ['admin', 'api', 'www', 'robots.txt', 'sitemap.xml', 'favicon.ico', '.well-known']) assert(routes.reserved.includes(name))
  assert.equal(routes.reserved.length, new Set(routes.reserved).size)
  assert(routes.reserved.every(name => name === name.toLowerCase()))
})

test('destination allowlist contains only existing static pages or product prefix', () => {
  for (const destination of routes.destinations) assert(fs.existsSync(path.join(app, destination, 'page.tsx')), destination)
  assert.deepEqual(routes.destinationPrefixes, ['/produit/'])
})
