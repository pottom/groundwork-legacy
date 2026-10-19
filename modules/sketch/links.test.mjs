// A sketch's links to ideas, map nodes, tickets and other sketches, behind the core server: the
// sketch lists them and adds them, other modules read who links to them (GET /api/sketch/links,
// Sketch's one public endpoint), and they survive renaming a sketch.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import sketch from './module.mjs'

const LINKS = path.join('docs', 'product', 'sketches', 'links.json')

async function withServer(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-sketch-links-'))
  const srv = await startServer({ root, modules: [sketch], port: 0 })
  try {
    await fn({ root, base: `http://127.0.0.1:${srv.port}` })
  } finally {
    await srv.close()
  }
}

const post = (base, sub, body, type = 'application/json') =>
  fetch(`${base}/api/sketch/${sub}`, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) })
const links = async (base) => (await fetch(`${base}/api/sketch/links`)).json()

test('a sketch lists its links, and one is added from the sketch', async () => {
  await withServer(async ({ root, base }) => {
    await post(base, 'create', { name: 'flow' })
    assert.deepEqual(await links(base), { sketches: {}, linked: { idea: {}, node: {}, ticket: {}, sketch: {} }, renamed: {} })
    assert.equal((await post(base, 'link', { name: 'flow', target: 'groundwork://idea/I-12' })).status, 200)
    assert.equal((await post(base, 'link', { name: 'flow', target: 'groundwork://node/f-board-links' })).status, 200)
    assert.equal((await post(base, 'link', { name: 'flow', target: 'groundwork://idea/I-12' })).status, 200, 'twice is once')
    const got = await links(base)
    assert.deepEqual(got.sketches, { flow: ['groundwork://idea/I-12', 'groundwork://node/f-board-links'] })
    assert.deepEqual(got.linked.idea, { 'I-12': ['flow'] })
    assert.deepEqual(got.linked.node, { 'f-board-links': ['flow'] })
    assert.ok(fs.existsSync(path.join(root, LINKS)), 'kept in git beside the sketches')
  })
})

test('a link is removed again; what is not a link, or not JSON, is refused', async () => {
  await withServer(async ({ root, base }) => {
    await post(base, 'link', { name: 'flow', target: 'groundwork://ticket/%2334' })
    assert.deepEqual((await links(base)).linked.ticket, { '#34': ['flow'] })
    assert.equal((await post(base, 'unlink', { name: 'flow', target: 'groundwork://ticket/%2334' })).status, 200)
    assert.deepEqual(await links(base), { sketches: {}, linked: { idea: {}, node: {}, ticket: {}, sketch: {} }, renamed: {} })
    assert.equal((await post(base, 'link', { name: 'flow', target: 'https://example.com' })).status, 400)
    assert.equal((await post(base, 'link', { name: '../x', target: 'groundwork://idea/I-1' })).status, 400)
    assert.equal((await post(base, 'link', { name: 'flow', target: 'groundwork://idea/I-1' }, 'text/plain')).status, 415)
    assert.equal((await fetch(`${base}/api/sketch/link`)).status, 405)
  })
})

test('links survive renaming a sketch: its own move along, and links to its old name still find it', async () => {
  await withServer(async ({ base }) => {
    await post(base, 'create', { name: 'flow' })
    await post(base, 'create', { name: 'other' })
    await post(base, 'link', { name: 'flow', target: 'groundwork://idea/I-12' })
    await post(base, 'link', { name: 'other', target: 'groundwork://sketch/flow' })
    assert.equal((await post(base, 'rename', { from: 'flow', to: 'checkout' })).status, 200)
    let got = await links(base)
    assert.deepEqual(got.sketches.checkout, ['groundwork://idea/I-12'])
    assert.equal(got.sketches.flow, undefined)
    assert.deepEqual(got.linked.idea, { 'I-12': ['checkout'] })
    assert.deepEqual(got.linked.sketch, { checkout: ['other'] }, 'a link to the old name is a link to the sketch')
    assert.deepEqual(got.renamed, { flow: 'checkout' })

    await post(base, 'rename', { from: 'checkout', to: 'pay' })
    assert.deepEqual((await links(base)).renamed, { flow: 'pay', checkout: 'pay' }, 'an old name follows every rename')
    await post(base, 'rename', { from: 'other', to: 'second' })
    got = await links(base)
    assert.deepEqual(got.linked.idea, { 'I-12': ['pay'] })
    assert.deepEqual(got.linked.sketch, { pay: ['second'] })

    await post(base, 'create', { name: 'flow' })
    assert.deepEqual((await links(base)).renamed, { checkout: 'pay', other: 'second' }, 'a new sketch takes its name back')
  })
})

test('a change of the links is a live topic of its own', () => {
  assert.equal(sketch.watch('docs/product/sketches/links.json'), 'sketch.links')
  assert.deepEqual(sketch.public, ['GET /api/sketch/links'])
})
