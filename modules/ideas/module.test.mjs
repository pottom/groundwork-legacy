// The Ideas module behind the core server: its manifest, its /api/ideas/ endpoint, its live
// topic, and its place in the shell.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { moduleFiles } from '../../core/files.mjs'
import { openRecords } from '../../core/records/store.mjs'
import { MODULES } from '../../core/modules.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import ideas from './module.mjs'
import changes from '../changes/module.mjs'
import { openIdeas } from './store.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-api-'))
const open = (root) => openIdeas(openRecords(root, [ideas]))

async function withServer(root, modules, fn) {
  const srv = await startServer({ root, modules, port: 0 })
  try { await fn(`http://127.0.0.1:${srv.port}`) } finally { await srv.close() }
}

test('Ideas writes nothing itself: it declares the record type I in docs/product/ideas/, which the core store writes', () => {
  assert.deepEqual(ideas.writes, [])
  assert.deepEqual(ideas.records.map((t) => [t.prefix, t.folder]), [['I', 'docs/product/ideas']])
  const root = project()
  const files = moduleFiles(root, ideas)
  assert.throws(() => files.write('docs/product/ideas/PRD.md', 'x'), /may not write/)
  assert.throws(() => files.write('docs/product/mindmap.json', '{}'), /may not write/)
})

test('/api/ideas/list gives every idea with its number, title, author, source and column', async () => {
  const root = project()
  await withServer(root, [ideas], async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/ideas/list`)).json(), { ideas: [] })
    open(root).add({ title: 'Quick tabs', author: 'claude', source: 'grilling', body: 'Ctrl+1.' })
    const { ideas: list } = await (await fetch(`${base}/api/ideas/list`)).json()
    assert.equal(list.length, 1)
    assert.deepEqual({ id: list[0].id, title: list[0].title, author: list[0].author, source: list[0].source, status: list[0].status, body: list[0].body },
      { id: 'I-1', title: 'Quick tabs', author: 'claude', source: 'grilling', status: 'new', body: 'Ctrl+1.' })
    assert.equal((await fetch(`${base}/api/ideas/list`, { method: 'PUT', body: '{}' })).status, 405)
    assert.equal((await fetch(`${base}/api/ideas/nothing`)).status, 404)
  })
})

test('PUT /api/ideas/item/<id> saves the browser\'s change to the idea file, on the version it was made on', async () => {
  const root = project()
  open(root).add({ title: 'Quick tabs', author: 'claude' })
  await withServer(root, [ideas], async (base) => {
    const put = (id, body, type = 'application/json') => fetch(`${base}/api/ideas/item/${id}`, { method: 'PUT', headers: { 'content-type': type }, body: JSON.stringify(body) })
    const seen = (await (await fetch(`${base}/api/ideas/list`)).json()).ideas[0]

    const ok = await put('I-1', { base: seen.version, changes: { title: 'Quick tab switching', impact: 'high', status: 'rejected', reason: 'Too small.' } })
    assert.equal(ok.status, 200)
    const { idea } = await ok.json()
    assert.deepEqual([idea.title, idea.impact, idea.status, idea.reason], ['Quick tab switching', 'high', 'rejected', 'Too small.'])
    assert.equal(open(root).list()[0].title, 'Quick tab switching')

    const stale = await put('I-1', { base: seen.version, changes: { title: 'Lost' } })
    assert.equal(stale.status, 409)
    assert.equal((await stale.json()).idea.title, 'Quick tab switching', 'a refused save sends the idea as it is now')

    assert.equal((await put('I-1', { base: idea.version, changes: { status: 'rejected', reason: '' } })).status, 400)
    assert.equal((await put('I-1', { base: idea.version, changes: { status: 'considering' } }, 'text/plain')).status, 415, 'only a JSON request, which another site cannot send without asking')
    assert.equal((await put('I-7', { changes: { title: 'X' } })).status, 404)
    assert.equal((await fetch(`${base}/api/ideas/item/I-1`)).status, 405)
    assert.equal(open(root).list()[0].title, 'Quick tab switching')
  })
})

test('POST /api/ideas/accept accepts an idea as the human: the store writes it and the change it opens, on the route chosen', async () => {
  const root = project()
  open(root).add({ title: 'Quick tabs', body: 'Ctrl+1 opens Build.', kind: 'product' })
  open(root).add({ title: 'Lint the CSS', kind: 'engineering' })
  await withServer(root, [ideas, changes], async (base) => {
    const post = (id, body, type = 'application/json') => fetch(`${base}/api/ideas/accept?id=${id}`, { method: 'POST', headers: { 'content-type': type }, body: JSON.stringify(body) })
    const list = async () => (await (await fetch(`${base}/api/ideas/list`)).json()).ideas
    const [seen] = await list()
    assert.deepEqual(seen.changes, [])

    assert.equal((await post('I-1', { route: 'grilling' }, 'text/plain')).status, 415, 'JSON only')
    assert.equal((await fetch(`${base}/api/ideas/accept?id=I-1`)).status, 405)
    assert.equal((await post('I-1', { route: 'nowhere' })).status, 400)
    assert.equal((await post('I-9', { route: 'grilling' })).status, 404)
    const stale = await post('I-1', { route: 'grilling', base: 'old' })
    assert.equal(stale.status, 409)
    assert.equal((await stale.json()).idea.id, 'I-1', 'a stale accept sends the idea as it is now')

    const ok = await post('I-1', { route: 'grilling', base: seen.version })
    assert.equal(ok.status, 200)
    const out = await ok.json()
    assert.deepEqual(out.change, { id: 'C-1', title: 'Quick tabs', status: 'grilling' })
    assert.equal(out.idea.status, 'accepted')
    assert.deepEqual(out.idea.changes, [out.change])
    assert.deepEqual((await list())[0].changes, [out.change], 'the list shows the change on the idea')
    assert.equal((await post('I-1', { route: 'grilling' })).status, 409, 'accepted already')

    const ticket = await post('I-2', { route: 'ticket' })
    assert.equal(ticket.status, 200)
    const direct = await ticket.json()
    assert.deepEqual(direct.change, { id: 'C-2', title: 'Lint the CSS', status: 'implementing' }, 'straight to a ticket: implementing at once')
    assert.equal(direct.route, 'ticket')
  })
})

test('a move to Accepted by a plain save is refused: accepting goes through POST /api/ideas/accept; other moves stay', async () => {
  const root = project()
  open(root).add({ title: 'Quick tabs' })
  await withServer(root, [ideas, changes], async (base) => {
    const put = (body) => fetch(`${base}/api/ideas/item/I-1`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const refused = await put({ changes: { status: 'accepted' } })
    assert.equal(refused.status, 400)
    assert.equal((await refused.json()).code, 'accept')
    assert.equal(open(root).list()[0].status, 'new')
    assert.equal((await put({ changes: { status: 'considering' } })).status, 200)
    await fetch(`${base}/api/ideas/accept?id=I-1`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ route: 'grilling' }) })
    const saved = await put({ changes: { status: 'accepted', title: 'Quick tab switching' } })
    assert.equal(saved.status, 200, 'an accepted idea saves with its status as it is')
    assert.equal((await saved.json()).idea.changes[0].id, 'C-1')
  })
})

test('an idea file is Ideas\' live topic; other files are not', () => {
  assert.equal(ideas.watch('docs/product/ideas/I-001-x.md'), 'ideas.items')
  assert.equal(ideas.watch('docs/product/ideas/PRD.md'), null)
  assert.equal(ideas.watch('docs/product/ideas/I-001-x.md.123.4.tmp'), null)
  assert.equal(ideas.watch('docs/product/mindmap.json'), null)
})

test('a new idea on disk reaches the page through /api/events', async () => {
  const root = project()
  const srv = await startServer({ root, modules: [ideas], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    open(root).add({ title: 'From Claude', author: 'claude' })
    await sse.change('ideas.items')
  } finally { sse.close(); await srv.close() }
})

test('the shell lists the flow in order, Ideas, Plan, Build, and opens Ideas at /', async () => {
  const flow = MODULES.map((m) => m.id).filter((id) => ['ideas', 'plan', 'build'].includes(id))
  assert.deepEqual(flow, ['ideas', 'plan', 'build'])
  await withServer(project(), MODULES, async (base) => {
    const html = await (await fetch(`${base}/`)).text()
    const tabs = [...html.matchAll(/href="\/\?module=(\w+)"/g)].map((m) => m[1])
    assert.deepEqual(tabs.filter((id) => flow.includes(id)), flow)
    assert.match(html, /<iframe class="gw-view" data-module="ideas"/)
  })
})

// Everything (page, cards, text, accent, fonts) comes from the shell's theme.
test('the Ideas view uses the shell theme and defines no colours of its own', async () => {
  await withServer(project(), [ideas], async (base) => {
    const get = async (p) => { const r = await fetch(`${base}/ideas/${p}`); assert.equal(r.status, 200, p); return r.text() }
    const html = await get('')
    assert.match(html, /<link rel="stylesheet" href="\/shell\/theme\.css">/)
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1])
    assert.deepEqual(sheets, ['view/ideas.css'])
    const css = await get(sheets[0])
    const stray = css.split(/[;{}]/).map((d) => d.trim()).filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d))
    assert.deepEqual(stray, [])
  })
})

test('the list and a save carry each idea\'s quiet marks, computed on the read: the files stay as they were, nothing asks for attention', async () => {
  const root = project()
  const old = openIdeas(openRecords(root, [ideas], { today: () => '2000-01-01' }))
  old.add({ title: 'Snoozed long ago' })
  old.update('I-1', { status: 'snoozed', until: '2000-02-01' }, { by: 'human' })
  old.add({ title: 'Considered long ago' })
  old.update('I-2', { status: 'considering' })
  open(root).add({ title: 'Fresh' })
  const dir = path.join(root, 'docs/product/ideas')
  const files = () => Object.fromEntries(fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]))
  const before = files()
  await withServer(root, [ideas], async (base) => {
    const { ideas: list } = await (await fetch(`${base}/api/ideas/list`)).json()
    assert.deepEqual(list.map((i) => [i.id, i.status, i.marks]), [['I-1', 'snoozed', ['snooze-passed']], ['I-2', 'considering', ['stale']], ['I-3', 'new', []]])
    assert.deepEqual(files(), before, 'reading changes no file')
    const r = await fetch(`${base}/api/ideas/item/I-2`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: list[1].version, changes: { title: 'Still old' } }) })
    assert.deepEqual((await r.json()).idea.marks, ['stale'])
  })
  assert.ok(!('attention' in ideas), 'Ideas names no attention endpoint, so the tab counts none of it')
})
