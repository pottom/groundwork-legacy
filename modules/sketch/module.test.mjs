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

const post = (base, sub, body) =>
  fetch(`${base}/api/sketch/${sub}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const names = async (base) => (await (await fetch(`${base}/api/sketch/list`)).json()).sketches.map((s) => s.name)
const sketchFile = (root, name) => path.join(root, 'docs', 'product', 'sketches', `${name}.excalidraw`)

test('the list names every sketch in docs/product/sketches/; a new one is its own empty file', async () => {
  await withServer(async ({ root, base }) => {
    assert.deepEqual(await names(base), [], 'no sketches yet')
    const r = await post(base, 'create', { name: 'flow' })
    assert.equal(r.status, 201)
    const file = JSON.parse(fs.readFileSync(sketchFile(root, 'flow'), 'utf8'))
    assert.equal(file.type, 'excalidraw')
    assert.deepEqual(file.elements, [])
    await put(base, scene(), 'Architecture')
    fs.writeFileSync(path.join(root, 'docs', 'product', 'sketches', 'notes.txt'), 'not a sketch')
    assert.deepEqual(await names(base), ['Architecture', 'flow'])
  })
})

test('a sketch is not created twice, nor under a name that is not a plain name', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene(), 'flow')
    const before = fs.readFileSync(sketchFile(root, 'flow'), 'utf8')
    assert.equal((await post(base, 'create', { name: 'flow' })).status, 409)
    assert.equal(fs.readFileSync(sketchFile(root, 'flow'), 'utf8'), before, 'the drawing is kept')
    assert.equal((await post(base, 'create', { name: '../evil' })).status, 400)
    assert.equal((await post(base, 'create', {})).status, 400)
  })
})

test('a renamed sketch keeps its drawing under the new name, and the old file is gone', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene(), 'main')
    const r = await post(base, 'rename', { from: 'main', to: 'checkout-flow' })
    assert.equal(r.status, 200)
    assert.equal(fs.existsSync(sketchFile(root, 'main')), false)
    assert.deepEqual((await (await fetch(`${base}/api/sketch/scene?name=checkout-flow`)).json()).elements, [rect])
    assert.deepEqual(await names(base), ['checkout-flow'])
  })
})

test('a rename does not overwrite another sketch, and a sketch not drawn yet renames as an empty one', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene(), 'a')
    await post(base, 'create', { name: 'b' })
    assert.equal((await post(base, 'rename', { from: 'a', to: 'b' })).status, 409)
    assert.deepEqual(await names(base), ['a', 'b'])
    assert.equal((await post(base, 'rename', { from: 'a', to: 'x/y' })).status, 400)
    assert.equal((await post(base, 'rename', { from: 'main', to: 'first' })).status, 200, 'the page shows main before anything is drawn')
    assert.deepEqual(await names(base), ['a', 'b', 'first'])
    assert.equal((await post(base, 'rename', { from: 'a', to: 'a' })).status, 200, 'the same name changes nothing')
    assert.deepEqual((await (await fetch(`${base}/api/sketch/scene?name=a`)).json()).elements, [rect])
    assert.equal((await post(base, 'rename', { from: 'a', to: 'A' })).status, 200, 'only the case changes')
    assert.deepEqual(await names(base), ['A', 'b', 'first'])
    assert.deepEqual((await (await fetch(`${base}/api/sketch/scene?name=A`)).json()).elements, [rect], 'the drawing is kept')
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

// Threads pinned to shapes (f-board-threads): <name>.threads.json beside the sketch, keyed by element id.
const THREADS = (root, name = 'main') => path.join(root, 'docs', 'product', 'sketches', `${name}.threads.json`)
const threadsOf = async (base, name = 'main') => (await (await fetch(`${base}/api/sketch/threads?name=${name}`)).json()).threads
const comment = (base, body, name = 'main') => post(base, `comment?name=${name}`, body)

test('a thread pinned to a shape: comments with author and time, closed when resolved, in <name>.threads.json', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene())
    const before = fs.readFileSync(path.join(root, FILE), 'utf8')
    assert.deepEqual(await threadsOf(base), [], 'no threads yet')
    const r = await comment(base, { element: 'r1', text: 'Should this be a queue?', author: 'Ann' })
    assert.equal(r.status, 200)
    assert.equal((await comment(base, { element: 'r1', text: 'Yes, later.', author: 'Claude' })).status, 200)
    const [thread] = await threadsOf(base)
    assert.equal(thread.element, 'r1')
    assert.equal(thread.closed, false)
    assert.equal(thread.orphaned, false)
    assert.deepEqual(thread.comments.map((c) => [c.author, c.text]), [['Ann', 'Should this be a queue?'], ['Claude', 'Yes, later.']])
    assert.ok(thread.comments.every((c) => !Number.isNaN(Date.parse(c.at))), 'every comment has its time')
    assert.equal((await post(base, 'close?name=main', { element: 'r1' })).status, 200)
    assert.equal((await threadsOf(base))[0].closed, true)
    assert.equal((await post(base, 'close?name=main', { element: 'r1', closed: false })).status, 200, 'and reopened')
    assert.equal((await threadsOf(base))[0].closed, false)
    const file = JSON.parse(fs.readFileSync(THREADS(root), 'utf8'))
    assert.deepEqual(Object.keys(file.threads), ['r1'], 'keyed by element id')
    assert.equal(fs.readFileSync(path.join(root, FILE), 'utf8'), before, 'the .excalidraw file stays standard: no thread in it')
  })
})

test('a comment from the page without an author is the developer\'s: the server names one', async () => {
  await withServer(async ({ base }) => {
    await put(base, scene())
    await comment(base, { element: 'r1', text: 'Hi' })
    const [c] = (await threadsOf(base))[0].comments
    assert.equal(typeof c.author, 'string')
    assert.ok(c.author.length > 0)
  })
})

test('a deleted shape keeps its thread, orphaned, not lost', async () => {
  await withServer(async ({ base }) => {
    await put(base, scene())
    await comment(base, { element: 'r1', text: 'Why here?', author: 'Ann' })
    await put(base, scene({ elements: [{ ...rect, isDeleted: true, version: 9 }] }))
    const [thread] = await threadsOf(base)
    assert.equal(thread.orphaned, true)
    assert.equal(thread.comments[0].text, 'Why here?')
    assert.equal((await comment(base, { element: 'r1', text: 'It went.', author: 'Claude' })).status, 200, 'an orphaned thread can still be answered')
  })
})

test('a thread needs a shape that is there, a text, and JSON; nothing is written otherwise', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene())
    assert.equal((await comment(base, { element: 'nope', text: 'Hi' })).status, 404, 'no such shape')
    assert.equal((await comment(base, { element: 'r1', text: '  ' })).status, 400, 'no text')
    assert.equal((await comment(base, { element: 'r1', text: 'x'.repeat(5000) })).status, 400, 'too long')
    assert.equal((await comment(base, { text: 'Hi' })).status, 400, 'no element')
    assert.equal((await post(base, 'close?name=main', { element: 'r1' })).status, 404, 'no thread to close')
    assert.equal((await comment(base, { element: 'r1', text: 'Hi' }, '..%2Fx')).status, 400)
    const form = await fetch(`${base}/api/sketch/comment?name=main`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ element: 'r1', text: 'Hi' }) })
    assert.equal(form.status, 415)
    assert.equal(fs.existsSync(THREADS(root)), false)
  })
})

test('a renamed sketch takes its threads along', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene())
    await comment(base, { element: 'r1', text: 'Keep me', author: 'Ann' })
    assert.equal((await post(base, 'rename', { from: 'main', to: 'flow' })).status, 200)
    assert.equal(fs.existsSync(THREADS(root, 'main')), false)
    assert.equal((await threadsOf(base, 'flow'))[0].comments[0].text, 'Keep me')
    assert.deepEqual(await names(base), ['flow'], 'a threads file is not a sketch')
  })
})

test('a change of a threads file is sketch.files too, so a comment from Claude shows on the open page', () => {
  assert.equal(sketch.watch('docs/product/sketches/main.threads.json'), 'sketch.files')
})

test('a shape whose id is a built-in of JavaScript objects (__proto__, toString) gets its thread like any other', async () => {
  await withServer(async ({ root, base }) => {
    await put(base, scene({ elements: [rect, { ...rect, id: '__proto__' }, { ...rect, id: 'toString' }] }))
    assert.equal((await comment(base, { element: 'constructor', text: 'Hi' })).status, 404, 'no such shape')
    assert.equal((await post(base, 'close?name=main', { element: 'toString' })).status, 404, 'no thread to close yet')
    assert.equal((await comment(base, { element: '__proto__', text: 'One', author: 'Ann' })).status, 200)
    assert.equal((await comment(base, { element: 'toString', text: 'Two', author: 'Ann' })).status, 200)
    const got = await threadsOf(base)
    assert.deepEqual(got.map((t) => [t.element, t.comments.map((c) => c.text)]), [['__proto__', ['One']], ['toString', ['Two']]])
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(THREADS(root), 'utf8')).threads), ['__proto__', 'toString'])
  })
})
