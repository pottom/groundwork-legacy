// The Sketch module behind the core server: its manifest and its /api/sketch/ endpoints.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import { moduleFiles } from '../../core/files.mjs'
import sketch from './module.mjs'
import { openSketches } from './sketch-store.mjs'
import { applyOps } from './ops.mjs'

const FILE = path.join('docs', 'product', 'sketches', 'main.excalidraw')

async function withServer(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-sketch-'))
  const srv = await startServer({ root, modules: [sketch], port: 0 })
  try {
    await fn({ root, base: `http://127.0.0.1:${srv.port}` })
  } finally {
    await srv.close()
  }
}

const put = (base, body, name = 'main') =>
  fetch(`${base}/api/sketch/scene?name=${name}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) })

// What Excalidraw's serializeAsJSON(…, 'local') gives the page: the file excalidraw.com saves.
const rect = { id: 'r1', type: 'rectangle', x: 10, y: 20, width: 100, height: 60, version: 3, versionNonce: 7, isDeleted: false }
const scene = (extra = {}) => ({
  type: 'excalidraw', version: 2, source: 'https://excalidraw.com',
  elements: [rect],
  appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
  files: {},
  ...extra,
})

test('Sketch is a tool that may write only its sketches', () => {
  assert.equal(sketch.id, 'sketch')
  assert.equal(sketch.name, 'Sketch')
  assert.equal(sketch.tool, true)
  assert.deepEqual(sketch.writes, ['docs/product/sketches'])
  assert.ok(sketch.tagline.en && sketch.tagline.hu)
})

test('a sketch not drawn yet is an empty standard scene', async () => {
  await withServer(async ({ root, base }) => {
    const r = await fetch(`${base}/api/sketch/scene?name=main`)
    assert.equal(r.status, 200)
    const got = await r.json()
    assert.equal(got.type, 'excalidraw')
    assert.equal(got.version, 2)
    assert.deepEqual(got.elements, [])
    assert.deepEqual(got.files, {})
    assert.equal(fs.existsSync(path.join(root, FILE)), false, 'reading writes nothing')
  })
})

test('a drawing saves as a standard .excalidraw file in docs/product/sketches/ and reads back', async () => {
  await withServer(async ({ root, base }) => {
    const r = await put(base, scene({ appState: { viewBackgroundColor: '#ffffff', gridSize: null, zoom: { value: 2 }, scrollX: 40, selectedElementIds: { r1: true }, collaborators: [] } }))
    assert.equal(r.status, 200)
    const file = JSON.parse(fs.readFileSync(path.join(root, FILE), 'utf8'))
    assert.equal(file.type, 'excalidraw')
    assert.equal(file.version, 2)
    assert.equal(typeof file.source, 'string')
    assert.deepEqual(file.elements, [rect])
    assert.deepEqual(file.appState, { gridSize: null, viewBackgroundColor: '#ffffff' }, 'no view state (zoom, scroll, selection) in git')
    assert.deepEqual(file.files, {})
    assert.deepEqual(await (await fetch(`${base}/api/sketch/scene?name=main`)).json(), file)
  })
})

test('an embedded image above the size limit is refused and nothing is written', async () => {
  await withServer(async ({ root, base }) => {
    const big = 'data:image/png;base64,' + 'A'.repeat(3 * 1024 * 1024)
    const r = await put(base, scene({ files: { f1: { id: 'f1', mimeType: 'image/png', dataURL: big, created: 1 } } }))
    assert.equal(r.status, 413)
    assert.match((await r.json()).error, /image/i)
    assert.equal(fs.existsSync(path.join(root, FILE)), false)
    const small = 'data:image/png;base64,' + 'A'.repeat(1000)
    assert.equal((await put(base, scene({ files: { f1: { id: 'f1', mimeType: 'image/png', dataURL: small, created: 1 } } }))).status, 200)
  })
})

test('what is not a scene, or a name that is not a plain name, is refused', async () => {
  await withServer(async ({ root, base }) => {
    assert.equal((await put(base, 'not json')).status, 400)
    assert.equal((await put(base, { type: 'other', elements: [] })).status, 400)
    assert.equal((await put(base, { type: 'excalidraw', elements: 'x' })).status, 400)
    assert.equal((await put(base, scene(), '..%2Fevil')).status, 400)
    assert.equal((await fetch(`${base}/api/sketch/scene?name=a%2Fb`)).status, 400)
    assert.equal(fs.existsSync(path.join(root, 'docs')), false)
  })
})

test('a save must say it is JSON, so another site cannot post a form into the sketch', async () => {
  await withServer(async ({ root, base }) => {
    const r = await fetch(`${base}/api/sketch/scene?name=main`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(scene()) })
    assert.equal(r.status, 415)
    assert.equal(fs.existsSync(path.join(root, FILE)), false)
  })
})

test('a save merges with the sketch on disk: what Claude drew meanwhile stays, the page\'s newer edit wins', async () => {
  await withServer(async ({ root, base }) => {
    const claude = { id: 'c1', type: 'ellipse', x: 0, y: 0, width: 50, height: 50, version: 1, versionNonce: 5, isDeleted: false }
    fs.mkdirSync(path.dirname(path.join(root, FILE)), { recursive: true })
    fs.writeFileSync(path.join(root, FILE), JSON.stringify(scene({ elements: [{ ...rect, x: 0, version: 2 }, claude] })))
    // The page had read the sketch before Claude drew: it knows r1 only, and moved it.
    assert.equal((await put(base, scene({ elements: [{ ...rect, x: 99, version: 3 }] }))).status, 200)
    const file = JSON.parse(fs.readFileSync(path.join(root, FILE), 'utf8'))
    assert.deepEqual(file.elements.map((e) => [e.id, e.x]), [['r1', 99], ['c1', 0]])
  })
})

test('a change to a sketch file is the topic sketch.files, which the open page follows', () => {
  assert.equal(sketch.watch('docs/product/sketches/main.excalidraw'), 'sketch.files')
  assert.equal(sketch.watch('docs/product/mindmap.json'), null)
})

test('what Claude draws reaches the open page as a sketch.files event', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-sketch-'))
  const srv = await startServer({ root, modules: [sketch], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    const scene = openSketches(moduleFiles(root, sketch)).read('main')
    openSketches(moduleFiles(root, sketch)).save('main', { ...scene, elements: applyOps(scene.elements, [{ op: 'add', type: 'rectangle', x: 0, y: 0 }]) })
    await sse.change('sketch.files')
  } finally { sse.close(); await srv.close() }
})
