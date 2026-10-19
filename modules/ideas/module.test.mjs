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
import { MODULES } from '../../core/modules.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import ideas from './module.mjs'
import { openIdeas } from './store.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-api-'))
const open = (root) => openIdeas(root, moduleFiles(root, ideas))

async function withServer(root, modules, fn) {
  const srv = await startServer({ root, modules, port: 0 })
  try { await fn(`http://127.0.0.1:${srv.port}`) } finally { await srv.close() }
}

test('Ideas may write only under docs/product/ideas/items/', () => {
  assert.deepEqual(ideas.writes, ['docs/product/ideas/items'])
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

test('an idea file is Ideas\' live topic; other files are not', () => {
  assert.equal(ideas.watch('docs/product/ideas/items/I-001-x.md'), 'ideas.items')
  assert.equal(ideas.watch('docs/product/ideas/PRD.md'), null)
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
