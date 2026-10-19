// The Plan module behind the core server: its view and its /api/plan/ endpoints.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { openMap, index } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'

const open = (dir) => openMap(dir, moduleFiles(dir, plan))

test('the manifest names the folders Plan may write to', () => {
  assert.deepEqual(plan.writes, ['docs/product', '.groundwork/plan'])
})

test('the map round-trips through /api/plan/map and a browser save is merged', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-api-'))
  open(root).init('Product')
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const base = `http://127.0.0.1:${srv.port}`
    assert.match(await (await fetch(`${base}/plan/`)).text(), /<html/i)
    assert.equal((await fetch(`${base}/plan/documents.mjs`)).status, 200)
    assert.equal((await fetch(`${base}/plan/doc-strings.mjs`)).status, 200, 'the document panel imports it too')

    const { v, data } = await (await fetch(`${base}/api/plan/map`)).json()
    assert.deepEqual(await (await fetch(`${base}/api/plan/map?v=${v}`)).json(), { v, same: true })

    data.nodeData.children.push({ id: 'h', topic: 'From the browser' })
    const saved = await (await fetch(`${base}/api/plan/map`, { method: 'PUT', body: JSON.stringify({ base: v, data }) })).json()
    assert.notEqual(saved.v, v)
    assert.equal(open(root).read().data.nodeData.children[0].topic, 'From the browser')
    assert.equal(open(root).takeHumanEdits().length, 1)

    assert.equal((await fetch(`${base}/api/plan/map`, { method: 'PUT', body: 'not json' })).status, 400)
    assert.deepEqual(await (await fetch(`${base}/api/plan/glossary`)).json(), { text: '' })
  } finally {
    await srv.close()
  }
})

test('/api/plan/ids gives the ids of the nodes of the map, for Build to check PRD lines against, without the map', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-ids-'))
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const base = `http://127.0.0.1:${srv.port}`
    assert.equal((await fetch(`${base}/api/plan/ids`)).status, 404, 'no map yet')
    const store = open(root)
    store.init('Product')
    store.apply([{ op: 'add', id: 'doc', parent: 'root', topic: 'Product', doc: 'prd' }, { op: 'add', id: 'goal', parent: 'doc', topic: 'Goal' }])
    const { v, ids } = await (await fetch(`${base}/api/plan/ids`)).json()
    assert.equal(v, store.read().v)
    assert.deepEqual(ids, ['root', 'doc', 'goal'])
    assert.deepEqual(await (await fetch(`${base}/api/plan/ids?v=${v}`)).json(), { v, same: true })
    store.apply([{ op: 'add', id: 'more', parent: 'goal', topic: 'More' }])
    assert.deepEqual((await (await fetch(`${base}/api/plan/ids?v=${v}`)).json()).ids, ['root', 'doc', 'goal', 'more'])
  } finally {
    await srv.close()
  }
})

// Plan's colours are aliases of the theme's tokens: its node types use the status hues, "ask about it"
// the theme's pink. Everything (page, panels, text, lines, accent, fonts) comes from the shell's theme.
test('the Plan view uses the shell theme and defines no base colours of its own', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-look-'))
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const get = async (p) => { const r = await fetch(`http://127.0.0.1:${srv.port}/plan/${p}`); assert.equal(r.status, 200, p); return r.text() }
    const html = await get('')
    assert.match(html, /<link rel="stylesheet" href="\/shell\/theme\.css">/)
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1])
    assert.deepEqual(sheets, ['view/plan.css', 'view/map.css'])
    const css = (await Promise.all(sheets.map(get))).join('\n')
    for (const name of ['--bg', '--surface', '--fg', '--muted', '--line', '--font', '--font-doc', '--shadow'])
      assert.doesNotMatch(css, new RegExp(`(^|[\\s;{])${name}:`), `Plan defines ${name}`)
    // no colour literal: every colour is a theme token
    const stray = css.split(/[;{}]/).map((d) => d.trim()).filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(d))
    assert.deepEqual(stray, [])
  } finally {
    await srv.close()
  }
})

test('the map file is Plan\'s live-update topic; other files are not', () => {
  assert.equal(plan.watch('docs/product/mindmap.json'), 'plan.map')
  assert.equal(plan.watch('GLOSSARY.md'), 'plan.glossary')
  assert.equal(plan.watch('docs/product/PRD.md'), null, 'the documents follow the map')
  assert.equal(plan.watch('.groundwork/plan/edits.jsonl'), null)
})

test('a change to the map on disk reaches the page through /api/events', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-events-'))
  open(root).init('Product')
  const srv = await startServer({ root, modules: [plan], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    open(root).apply([{ op: 'add', parent: 'root', id: 'x', topic: 'From Claude' }])
    await sse.change('plan.map')
  } finally { sse.close(); await srv.close() }
})

// What Ideas sends (POST /api/plan/todo): Plan alone writes the map. A node it adds sits in an "Ideas"
// section of the first PRD, so the PRD's open questions or non-goals list it, and links back to the idea.
const post = (base, body, type = 'application/json') => fetch(`${base}/api/plan/todo`, {
  method: 'POST', headers: { 'content-type': type }, body: typeof body === 'string' ? body : JSON.stringify(body),
})

test('POST /api/plan/todo adds a todo node linked to the idea, in an Ideas section of the PRD, once', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-todo-'))
  const store = open(root)
  store.init('Product')
  store.apply([{ op: 'add', id: 'sys', parent: 'root', topic: 'Overview', doc: 'system' }, { op: 'add', id: 'prd', parent: 'root', topic: 'Product', doc: 'prd' }])
  const srv = await startServer({ root, modules: [plan], port: 0 })
  const sse = listen(srv.port)
  const base = `http://127.0.0.1:${srv.port}`
  try {
    await sse.next((e) => e.event === 'hello')
    const res = await post(base, { idea: 'I-12', title: 'Quick tab switching' })
    assert.equal(res.status, 200)
    const { id } = await res.json()
    await sse.change('plan.map')
    const nodes = index(store.read().data)
    const node = nodes.get(id).node
    assert.deepEqual({ topic: node.topic, status: node.metadata.status, link: node.hyperLink, by: node.metadata.by },
      { topic: 'Quick tab switching', status: 'todo', link: '/?module=ideas&idea=I-12', by: 'ideas' })
    const section = nodes.get(id).parent
    assert.equal(section.topic, 'Ötletek', 'in the document language')
    assert.equal(nodes.get(section.id).parent.id, 'prd')
    assert.match(fs.readFileSync(path.join(root, 'docs/product/PRD.md'), 'utf8'), /Quick tab switching/)

    const again = await (await post(base, { idea: 'I-12', title: 'Quick tab switching' })).json()
    assert.equal(again.id, id, 'the same idea gets the same node')
    const second = await (await post(base, { idea: 'I-13', title: 'Dark export' })).json()
    assert.equal(index(store.read().data).get(second.id).parent.id, section.id, 'one Ideas section')
  } finally { sse.close(); await srv.close() }
})

test('POST /api/plan/todo makes a rejected idea a non-goal with its reason', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-excluded-'))
  const store = open(root)
  store.init('Product')
  store.apply([{ op: 'add', id: 'prd', parent: 'root', topic: 'Product', doc: 'prd' }, { op: 'set', id: 'root', lang: 'en' }])
  const srv = await startServer({ root, modules: [plan], port: 0 })
  const base = `http://127.0.0.1:${srv.port}`
  try {
    const { id } = await (await post(base, { idea: 'I-4', title: 'Offline sync', status: 'excluded', reason: 'Git already syncs' })).json()
    const { node, parent } = index(store.read().data).get(id)
    assert.deepEqual({ status: node.metadata.status, note: node.note, section: parent.topic }, { status: 'excluded', note: 'Git already syncs', section: 'Ideas' })
    assert.match(fs.readFileSync(path.join(root, 'docs/product/PRD.md'), 'utf8'), /## Non-goals[\s\S]*Offline sync/)

    // An idea already on the map as a todo, rejected later, becomes the non-goal itself.
    const todo = await (await post(base, { idea: 'I-5', title: 'Tabs' })).json()
    const ex = await (await post(base, { idea: 'I-5', title: 'Tabs', status: 'excluded', reason: 'Not now' })).json()
    assert.equal(ex.id, todo.id)
    assert.equal(index(store.read().data).get(todo.id).node.metadata.status, 'excluded')
  } finally { await srv.close() }
})

test('POST /api/plan/todo takes only a JSON request with an idea and a title, and needs a map', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-todo-bad-'))
  const srv = await startServer({ root, modules: [plan], port: 0 })
  const base = `http://127.0.0.1:${srv.port}`
  try {
    assert.equal((await post(base, { idea: 'I-1', title: 'x' })).status, 404, 'no map yet')
    open(root).init('Product')
    assert.equal((await post(base, '{"idea":"I-1","title":"x"}', 'text/plain')).status, 415, 'no other web site can post one')
    assert.equal((await post(base, { title: 'x' })).status, 400)
    assert.equal((await post(base, { idea: 'I-1', title: ' ' })).status, 400)
    assert.equal((await post(base, { idea: 'I-1', title: 'x', status: 'done' })).status, 400)
    assert.equal((await post(base, { idea: 'I-1', title: 'x', status: 'excluded' })).status, 400, 'a non-goal needs its reason')
    assert.equal((await fetch(`${base}/api/plan/todo`)).status, 405)
  } finally { await srv.close() }
})
