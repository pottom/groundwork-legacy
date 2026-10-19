// Modules read each other only through small declared endpoints, and each keeps working when
// the other is missing (modules/README.md, "Reading another module").
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../core/server.mjs'
import { MODULES } from '../core/modules.mjs'
import { moduleFiles } from '../core/files.mjs'
import { openMap } from './plan/map-store.mjs'
import plan from './plan/module.mjs'
import build, { buildModule } from './build/module.mjs'
import ideas from './ideas/module.mjs'
import sketch from './sketch/module.mjs'

// A project with a map and a ticket that names an item.
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-alone-'))
  openMap(root, moduleFiles(root, plan)).init('Product')
  const ticket = path.join(root, '.scratch', 'core', 'issues', '01-first.md')
  fs.mkdirSync(path.dirname(ticket), { recursive: true })
  fs.writeFileSync(ticket, '# First\n\n**PRD:** d-goal\n**Status:** done\n')
  return root
}

async function withServer(modules, fn) {
  const root = project()
  const srv = await startServer({ root, modules, port: 0 })
  const base = `http://127.0.0.1:${srv.port}`
  const get = (p) => fetch(base + p)
  const send = (method, p, body, type) => fetch(base + p, { method, body, headers: { 'content-type': type } })
  try { await fn(get, send) } finally { await srv.close() }
}

const tabs = (html) => [...html.matchAll(/<a href="\/\?module=([^"]+)"/g)].map((m) => m[1])

test('with only Plan, its page and endpoints work, and Build\'s endpoint is simply not there', async () => {
  await withServer([plan], async (get) => {
    assert.deepEqual(tabs(await (await get('/')).text()), ['plan'])
    assert.match(await (await get('/plan/')).text(), /<html/i)
    assert.equal((await (await get('/api/plan/map')).json()).data.nodeData.topic, 'Product')
    assert.deepEqual((await (await get('/api/plan/ids')).json()).ids, ['root'])
    assert.equal((await get('/api/plan/glossary')).status, 200)
    const prd = await get('/api/build/prd')
    assert.equal(prd.status, 404, 'Plan reads a non-ok answer as "no ticket counts"')
    assert.deepEqual(await prd.json(), { error: 'not found' })
    assert.equal((await get('/build/')).status, 404)
  })
})

test('with only Build, its page and endpoints work, and Plan\'s endpoint is simply not there', async () => {
  await withServer([buildModule({ githubRequest: async () => [] })], async (get) => {
    assert.deepEqual(tabs(await (await get('/')).text()), ['build'])
    assert.match(await (await get('/build/')).text(), /<html/i)
    assert.equal((await (await get('/api/build/hello')).json()).api, 1)
    assert.ok((await (await get('/api/build/list')).json()).files.some((f) => f.path === '.scratch/core/issues/01-first.md'))
    assert.equal((await get('/api/build/file?path=.scratch/core/issues/01-first.md')).status, 200)
    const { total, done } = (await (await get('/api/build/prd')).json()).items['d-goal']
    assert.deepEqual({ total, done }, { total: 1, done: 1 })
    const ids = await get('/api/plan/ids')
    assert.equal(ids.status, 404, 'Build reads a non-ok answer as "no map": no PRD id counts as unknown')
    assert.equal((await get('/plan/')).status, 404)
  })
})

test('with only Ideas, its page and endpoints work; Plan, Build and Sketch are simply not there', async () => {
  await withServer([ideas], async (get, send) => {
    assert.deepEqual(tabs(await (await get('/')).text()), ['ideas'])
    assert.match(await (await get('/ideas/')).text(), /<html/i)
    assert.deepEqual((await (await get('/api/ideas/list')).json()).ideas, [])
    // The one write Ideas asks another module for: without Plan it is a 404, which the page reads
    // as "the map is unavailable" (view/plan.mjs); the idea stays as it is.
    const todo = await send('POST', '/api/plan/todo', JSON.stringify({ idea: 'I-1', title: 'x' }), 'application/json')
    assert.equal(todo.status, 404)
    for (const p of ['/api/build/ideas', '/api/sketch/links']) assert.equal((await get(p)).status, 404, `${p}: nothing to show`)
  })
})

test('with only Sketch, its page and endpoints work; the modules it links to are simply not there', async () => {
  await withServer([sketch], async (get) => {
    assert.deepEqual(tabs(await (await get('/')).text()), ['sketch'])
    assert.match(await (await get('/sketch/')).text(), /<html/i)
    assert.deepEqual((await (await get('/api/sketch/list')).json()).sketches, [])
    assert.equal((await get('/api/sketch/links')).status, 200)
    assert.equal((await get('/api/sketch/scene?name=main')).status, 200)
    for (const p of ['/api/ideas/list', '/api/plan/ids', '/api/build/prd']) assert.equal((await get(p)).status, 404, p)
  })
})

test('Plan and Build without Ideas and Sketch: the endpoints they read from those are simply not there', async () => {
  await withServer([plan, buildModule({ githubRequest: async () => [] })], async (get) => {
    assert.equal((await get('/api/plan/ids')).status, 200)
    assert.equal((await get('/api/build/prd')).status, 200)
    assert.equal((await get('/api/sketch/links')).status, 404, 'Plan\'s nodes and Build\'s tickets show only their own sketches')
  })
})

test('each module declares the endpoints other modules may read, and the server answers them', async () => {
  assert.deepEqual(plan.public, ['GET /api/plan/ids', 'POST /api/plan/todo'])
  assert.deepEqual(build.public, ['GET /api/build/prd', 'GET /api/build/ideas'])
  // Reads are GETs. The one write another module may ask for is Plan's: an idea as a map node, and
  // only as a JSON request, so no other web site can send it (CSRF).
  const writes = { 'POST /api/plan/todo': { idea: 'I-1', title: 'From Ideas' } }
  await withServer(MODULES, async (get, send) => {
    for (const m of MODULES) for (const e of m.public) {
      const [method, p] = e.split(' ')
      if (method === 'GET') { assert.equal((await get(p)).status, 200, e); continue }
      assert.ok(writes[e], `${e}: a public endpoint is a GET, or a write listed here`)
      assert.equal((await send(method, p, JSON.stringify(writes[e]), 'text/plain')).status, 415, `${e} refuses a non-JSON request`)
      assert.equal((await send(method, p, JSON.stringify(writes[e]), 'application/json')).status, 200, e)
    }
  })
})

// Every file of a module the browser or the server runs: its view files and its own .mjs files.
function sources(m) {
  const dir = m.view.dir
  return fs.readdirSync(dir, { recursive: true })
    .map((f) => String(f).split(path.sep).join('/'))
    .filter((f) => /\.(mjs|html)$/.test(f) && !/\.test(-helper)?\.mjs$/.test(f) && !f.startsWith('skills/'))
    .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
}

test('a module asks another module only for that module\'s declared endpoints', () => {
  for (const m of MODULES) {
    const others = MODULES.filter((o) => o !== m)
    for (const [file, text] of sources(m)) {
      for (const o of others) {
        const allowed = o.public.map((e) => e.split(' ')[1])
        for (const [used] of text.matchAll(new RegExp(`/api/${o.id}/[\\w/-]*`, 'g'))) {
          assert.ok(allowed.includes(used), `${m.id}/${file} uses ${used}, which ${o.id} does not declare public`)
        }
      }
    }
  }
})

test('neither module reads the other\'s files: Build never opens the map, Plan never reads tickets', () => {
  for (const [file, text] of sources(build)) assert.doesNotMatch(text, /mindmap\.json/, `build/${file}`)
  for (const [file, text] of sources(plan)) {
    assert.doesNotMatch(text, /ticket-reader|project-tickets|\.\.\/build\//, `plan/${file}`)
  }
})

test('no module reads the files of Ideas or Sketch, nor do they read another module\'s files', () => {
  const imports = (id) => new RegExp(`['"]\\.\\.\\/(\\.\\.\\/)?${id}\\/`)   // an import from that module's folder
  const IDEA_FILES = /ideas\/items/
  const SKETCH_FILES = /docs\/product\/sketches|\.excalidraw\b|links\.json|\.threads\.json/
  for (const m of MODULES) {
    for (const [file, text] of sources(m)) {
      for (const o of MODULES.filter((x) => x !== m)) assert.doesNotMatch(text, imports(o.id), `${m.id}/${file} imports from ${o.id}`)
      if (m !== ideas) assert.doesNotMatch(text, IDEA_FILES, `${m.id}/${file} reads the idea files`)
      if (m !== sketch) assert.doesNotMatch(text, SKETCH_FILES, `${m.id}/${file} reads the sketch files`)
    }
  }
  for (const [file, text] of [...sources(ideas), ...sources(sketch)]) {
    assert.doesNotMatch(text, /mindmap\.json|ticket-reader|project-tickets/, file)
  }
  assert.deepEqual(ideas.public, [])
  assert.deepEqual(sketch.public, ['GET /api/sketch/links'])
})
