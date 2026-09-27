import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '../tmp/seo-node/node_modules/@electric-sql/pglite/dist/index.js'

test('PostgreSQL trigger retains unknown historical dates and only timestamps public changes', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE TABLE public."T_Product" (
      id INTEGER PRIMARY KEY, nom_fr TEXT, nom_darija TEXT, unite TEXT, image_url TEXT,
      prix_kg DOUBLE PRECISION, prix_affiche DOUBLE PRECISION, is_active BOOLEAN,
      stock DOUBLE PRECISION, niveau INTEGER, prix_gros_saisi DOUBLE PRECISION,
      prix_khddar_reel DOUBLE PRECISION, prix_vente_manuel DOUBLE PRECISION
    ); INSERT INTO public."T_Product" (id, nom_fr, prix_kg, stock, is_active)
    VALUES (1, 'Tomates', 10, 5, true), (2, 'Carottes', 8, 0, true);`)
    const migration = await readFile('back-end/sql/2026-09-27_product_public_updated_at.sql', 'utf8')
    await db.exec(migration)
    const date = async (id = 1) => (await db.query('SELECT updated_at FROM public."T_Product" WHERE id = $1', [id])).rows[0].updated_at
    assert.equal(await date(), null)
    await db.exec('UPDATE public."T_Product" SET stock = 4, prix_vente_manuel = 99 WHERE id = 1')
    assert.equal(await date(), null, 'positive stock quantity and unpublished pricing are not public page changes')
    await db.exec('UPDATE public."T_Product" SET prix_affiche = 12 WHERE id = 1')
    const changed = await date()
    assert.ok(changed instanceof Date)
    await db.exec('UPDATE public."T_Product" SET prix_kg = 11 WHERE id = 1')
    assert.equal((await date()).toISOString(), changed.toISOString(), 'hidden wholesale price does not change displayed price')
    await db.exec('UPDATE public."T_Product" SET stock = 0 WHERE id = 2')
    assert.equal(await date(2), null, 'unchanged availability retains unknown date')
    await db.exec('UPDATE public."T_Product" SET stock = 1 WHERE id = 2')
    assert.ok(await date(2), 'availability threshold change timestamps the page')
    await db.exec(`INSERT INTO public."T_Product" (id, nom_fr, prix_kg) VALUES (3, 'Citron', 7)`)
    assert.ok(await date(3), 'new product records have a known creation date')
    await db.exec(migration)
    assert.equal((await date()).toISOString(), changed.toISOString(), 'idempotent migration never backfills')
  } finally { await db.close() }
})
