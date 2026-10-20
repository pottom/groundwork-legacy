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
import { execFileSync } from 'node:child_process'
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
const show = async (base, id) => (await fetch(`${base}/api/changes/show?id=${encodeURIComponent(id)}`)).json()
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' })
// every file below the root, with its content: what a read must leave as it was
const snapshot = (root) => Object.fromEntries(fs.readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && !path.relative(root, d.parentPath ?? d.path).startsWith('.git'))
  .map((d) => { const f = path.join(d.parentPath ?? d.path, d.name); return [path.relative(root, f), fs.readFileSync(f, 'utf8')] }))

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

test('/api/changes/show gives one change\'s page; an unknown or missing id is refused', async () => {
  const root = project()
  const store = open(root)
  store.create('I', { fields: { title: 'Record model' } }, { by: 'human' })
  store.create('C', { fields: { title: 'Asking', ideas: ['I-1'] }, body: '## Probléma\n\nNo *home*.\n\n## Kérdések\n\n- Git or not?\n\n## Javasolt elemek\n\n- add `d-a` → `system#t-x` — A\n  Its note.\n' })
  await withServer(root, [ideas, changes], async (base) => {
    const page = await show(base, 'C-1')
    assert.deepEqual([page.id, page.title, page.stage, page.questions, page.tickets], ['C-1', 'Asking', 'grilling', 1, null], 'a body written without the tickets rule has none')
    assert.deepEqual(page.ideas, [{ id: 'I-1', name: 'idea', module: 'ideas', title: 'Record model' }])
    assert.match(page.html.sections.problem, /<em>home<\/em>/)
    assert.deepEqual(page.content.items.map((i) => [i.op, i.id, i.target, i.note]), [['add', 'd-a', 'system#t-x', 'Its note.']])
    assert.equal(page.marks, null, 'a folder without git: no marks, no error')
    assert.equal((await fetch(`${base}/api/changes/show?id=C-9`)).status, 404)
    assert.equal((await fetch(`${base}/api/changes/show?id=I-1`)).status, 404, 'an idea is no change')
    assert.equal((await fetch(`${base}/api/changes/show`)).status, 404)
    assert.equal((await fetch(`${base}/api/changes/show?id=C-1`, { method: 'POST' })).status, 405)
  })
})

test('reading the list and a page writes no file', async () => {
  const root = project()
  open(root).create('C', { fields: { title: 'Asking' }, body: '## Kérdések\n\n- Git or not?' })
  const before = snapshot(root)
  await withServer(root, [changes], async (base) => {
    await list(base)
    await show(base, 'C-1')
  })
  assert.deepEqual(snapshot(root), before)
})

test('the marks: what changed since the last commit; none for an uncommitted change, none after a commit', async () => {
  const root = project()
  git(root, 'init', '-q')
  const store = open(root)
  store.create('C', { fields: { title: 'Asking' }, body: '## Probléma\n\nNo home.\n\n## Kérdések\n\n- Git or not?\n\n## Javasolt elemek\n\n- add `d-a` → `system#t-x` — A\n- add `d-b` → `system#t-x` — B\n' })
  await withServer(root, [changes], async (base) => {
    assert.equal((await show(base, 'C-1')).marks, null, 'not committed yet')
    git(root, 'add', '.'); git(root, 'commit', '-q', '-m', 'one')
    assert.deepEqual((await show(base, 'C-1')).marks.items, {}, 'committed and unchanged: nothing marked')
    const rec = store.get('C-1')
    store.update('C-1', { body: rec.body.replace('No home.', 'No home yet.').replace('- Git or not?', '- Which name?').replace('- add `d-b` → `system#t-x` — B', '- add `d-c` → `system#t-x` — C') })
    const page = await show(base, 'C-1')
    assert.deepEqual(page.marks.sections, { problem: 'modified' })
    assert.deepEqual(page.marks.items, { 'd-c': 'new' })
    assert.deepEqual(page.marks.removed.items.map((i) => i.id), ['d-b'])
    assert.deepEqual(page.marks.questions, { 'which name?': 'new' })
    assert.deepEqual(page.marks.removed.questions.map((q) => q.text), ['Git or not?'])
    git(root, 'add', '.'); git(root, 'commit', '-q', '-m', 'two')
    const after = (await show(base, 'C-1')).marks
    assert.deepEqual([after.sections, after.items, after.removed.items], [{}, {}, []], 'after the commit the marks are gone')
  })
})

test('this repository\'s C-3 opens as a page with every proposed item', async () => {
  await withServer(REPO, MODULES, async (base) => {
    const page = await show(base, 'C-3')
    assert.equal(page.title, 'A változás lapja élőben')
    assert.ok(page.content.items.some((i) => i.id === 'd-changes-page-readonly' && i.target === 'changes/prd#t-changes-scope'))
    for (const k of ['problem', 'solution', 'scope', 'outOfScope']) assert.ok(page.html.sections[k], k)
  })
})

test('a commit is the Changes module\'s live topic too, so the marks go away on their own', () => {
  assert.equal(changes.watch('.git/refs/heads/main'), 'changes.commit')
  assert.equal(changes.watch('.git/HEAD'), 'changes.commit')
  assert.equal(changes.watch('.git/index'), null)
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
