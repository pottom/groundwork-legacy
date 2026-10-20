// The Changes module behind the core server: its manifest, its /api/changes/ endpoint on a project
// and on this repository's own changes, its live topic, and its place in the shell.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../../core/server.mjs'
import { moduleFiles } from '../../core/files.mjs'
import { openRecords } from '../../core/records/store.mjs'
import { CORE_RECORDS } from '../../core/records/changes.mjs'
import { MODULES } from '../../core/modules.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import ideas from '../ideas/module.mjs'
import changes from './module.mjs'

const REPO = fileURLToPath(new URL('../../', import.meta.url))
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-changes-api-'))
const open = (root) => openRecords(root, [ideas, changes, CORE_RECORDS], { today: () => '2026-10-20' })

async function withServer(root, modules, fn) {
  const srv = await startServer({ root, modules, port: 0 })
  try { await fn(`http://127.0.0.1:${srv.port}`, srv) } finally { await srv.close() }
}
const list = async (base) => (await (await fetch(`${base}/api/changes/list`)).json())

test('the Changes module declares the Change type in docs/product/changes/ and writes nothing itself', () => {
  assert.deepEqual(changes.writes, [])
  assert.deepEqual(changes.records.map((t) => [t.prefix, t.folder]), [['C', 'docs/product/changes']])
  assert.deepEqual(CORE_RECORDS.records.map((t) => t.prefix), ['M'], 'the milestone stays in the core')
  assert.throws(() => moduleFiles(project(), changes).write('docs/product/changes/C-001-x.md', 'x'), /may not write/)
})

test('/api/changes/list gives each change with its computed stage, its counts, and its ideas and milestone', async () => {
  const root = project()
  const store = open(root)
  store.create('I', { fields: { title: 'Record model' } }, { by: 'human' })
  store.create('M', { fields: { title: 'Redesign' } })
  store.create('C', { fields: { title: 'Asking', ideas: ['I-1'], milestone: 'M-1' }, body: '## Kérdések\n\n- Git or not?\n- [x] Settled\n\n## Javasolt elemek\n\n- add `d-a` → `system#t-x` — A\n' })
  store.create('C', { fields: { title: 'Asked' } })
  store.update('C-2', { fields: { status: 'awaiting-approval' } })
  store.create('C', { fields: { title: 'Asked again' }, body: '## Kérdések\n\n- One more?' })
  store.update('C-3', { fields: { status: 'awaiting-approval' } })
  store.create('C', { fields: { title: 'Building' }, body: '## Kérdések\n\n- Left open' })
  store.update('C-4', { fields: { status: 'implementing' } }, { by: 'human' })
  await withServer(root, [ideas, changes], async (base) => {
    const { stages, changes: rows } = await list(base)
    assert.deepEqual(stages, ['grilling', 'awaiting-approval', 'implementing', 'done', 'dropped'])
    assert.deepEqual(rows.map((r) => [r.id, r.status, r.stage, r.questions, r.items]), [
      ['C-1', 'grilling', 'grilling', 1, 1],
      ['C-2', 'awaiting-approval', 'awaiting-approval', 0, 0],
      ['C-3', 'awaiting-approval', 'grilling', 1, 0],
      ['C-4', 'implementing', 'implementing', 1, 0],
    ])
    assert.deepEqual(rows[0].ideas, [{ id: 'I-1', name: 'idea', module: 'ideas', title: 'Record model' }])
    assert.deepEqual(rows[0].milestone, { id: 'M-1', name: 'milestone', module: 'core', title: 'Redesign' })
    assert.equal((await fetch(`${base}/api/changes/list`, { method: 'POST' })).status, 405)
    assert.equal((await fetch(`${base}/api/changes/nothing`)).status, 404)
  })
  // without Ideas, a change's ideas are plain ids
  await withServer(root, [changes], async (base) => {
    assert.deepEqual((await list(base)).changes[0].ideas, [{ id: 'I-1' }])
  })
})

test('this repository\'s changes: C-1…C-13 (and any made since), each with a stage', async () => {
  await withServer(REPO, MODULES, async (base) => {
    const { stages, changes: rows } = await list(base)
    assert.deepEqual(rows.map((r) => r.id).slice(0, 13), Array.from({ length: 13 }, (_, i) => `C-${i + 1}`))
    for (const r of rows) assert.ok(stages.includes(r.stage), `${r.id}: ${r.stage}`)
    const c3 = rows.find((r) => r.id === 'C-3')
    assert.deepEqual(c3.ideas.map((l) => [l.id, l.module]), [['I-5', 'ideas']])
    assert.deepEqual([c3.milestone.id, c3.milestone.module], ['M-9', 'core'])
    assert.ok(c3.items > 0)
  })
})

test('a change file is the Changes module\'s live topic; other files are not', () => {
  assert.equal(changes.watch('docs/product/changes/C-003-x.md'), 'changes.items')
  assert.equal(changes.watch('docs/product/changes/C-003-x.md.123.4.tmp'), null)
  assert.equal(changes.watch('docs/product/changes/README.md'), null)
  assert.equal(changes.watch('docs/product/ideas/I-001-x.md'), null)
})

test('a new change on disk reaches the page through /api/events', async () => {
  const root = project()
  const srv = await startServer({ root, modules: [changes], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    open(root).create('C', { fields: { title: 'From Claude' } })
    await sse.change('changes.items')
  } finally { sse.close(); await srv.close() }
})

test('the shell has a Changes tab after Ideas, and serves the page, the chip and Lit', async () => {
  const ids = MODULES.map((m) => m.id)
  assert.equal(ids.indexOf('changes'), ids.indexOf('ideas') + 1)
  await withServer(project(), MODULES, async (base) => {
    const html = await (await fetch(`${base}/`)).text()
    assert.match(html, /href="\/\?module=changes"/)
    for (const p of ['/changes/', '/shell/record-chip.mjs', '/shell/record-link.mjs', '/vendor/lit-element/lit-element.js',
      '/vendor/reactive-element/reactive-element.js', '/vendor/reactive-element/css-tag.js']) {
      assert.equal((await fetch(base + p)).status, 200, p)
    }
  })
})

// Everything (page, cards, text, accent, fonts) comes from the shell's theme.
test('the Changes view uses the shell theme and defines no colours of its own', async () => {
  await withServer(project(), [changes], async (base) => {
    const get = async (p) => { const r = await fetch(`${base}/changes/${p}`); assert.equal(r.status, 200, p); return r.text() }
    const html = await get('')
    assert.match(html, /<link rel="stylesheet" href="\/shell\/theme\.css">/)
    const sheets = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"]+)">/g)].map((m) => m[1])
    assert.deepEqual(sheets, ['view/changes.css'])
    const css = await get(sheets[0])
    const stray = css.split(/[;{}]/).map((d) => d.trim()).filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i.test(d))
    assert.deepEqual(stray, [])
  })
})
