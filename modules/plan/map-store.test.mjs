// Tests of the map store through its interface: read, apply, saveFromBrowser, takeHumanEdits.
// The map is the Spec (docs/product/spec/, read and written through the record store's Spec);
// a project that only has the old docs/product/mindmap.json is shown read-only.
// Run: node --test modules/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openMap, nodeIds } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'

// The store as the CLI and the server open it: through the writer the core grants Plan.
const open = (dir) => openMap(dir, moduleFiles(dir, plan))
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const file = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-'))

// A small Spec as a human or another tool would leave it: written by hand, in the canonical form.
const SYSTEM = ['# Shop', '', '_System overview_', '', '## Goal {#t-goal .done}', '', 'Sell things.', '',
  '- One server · `d-one` · decision · done · C-1', ''].join('\n')
const APP_PRD = ['# App: Product', '', '_Product requirements document (PRD)_', '',
  '## Users {#t-users}', '', '<!-- human: hp-1 -->', 'Written by the human.', '<!-- /human -->', '',
  '- **Buyers** · `g-buyers` · C-1', '  - Pays by card · `f-card` · decision · partial · C-1', '    Card only for now.', '    [app/pay.mjs](../../../../app/pay.mjs)',
  '  - Gift cards · `x-gift` · excluded · C-1 · superseded by: C-4', ''].join('\n')
const PARTS = ['# Parts', '', '- App · `app` · software · The web shop. · active', ''].join('\n')

function seeded() {
  const dir = project()
  put(dir, 'docs/product/spec/SYSTEM.md', SYSTEM)
  put(dir, 'docs/product/spec/app/PRD.md', APP_PRD)
  put(dir, 'docs/product/spec/parts.md', PARTS)
  return { dir, store: open(dir) }
}

const find = (data, id) => {
  let hit = null
  const rec = (n) => { if (n.id === id) hit = n; for (const c of n.children || []) rec(c) }
  rec(data.nodeData)
  return hit
}

test('the map shows the Spec: the system document and the parts with their documents, sections and items', () => {
  const { store } = seeded()
  const { data } = store.read()
  const root = data.nodeData
  assert.equal(root.topic, 'Shop', 'the root is named after the system document')
  assert.equal(root.metadata.lang, 'en')
  assert.deepEqual(root.children.map((n) => n.id), ['system', 'app'])
  const app = find(data, 'app')
  assert.deepEqual({ topic: app.topic, type: app.metadata.component, note: app.note }, { topic: 'App', type: 'software', note: 'The web shop.' })
  const prd = find(data, 'app/prd')
  assert.deepEqual({ topic: prd.topic, kind: prd.metadata.doc }, { topic: 'App: Product', kind: 'prd' })
  const users = find(data, 't-users')
  assert.deepEqual(users.metadata.humanProse, [{ id: 'hp-1', text: 'Written by the human.' }])
  assert.equal(find(data, 't-goal').metadata.progress, 'done')
  assert.equal(find(data, 't-goal').metadata.prose, 'Sell things.')
  const card = find(data, 'f-card')
  assert.deepEqual({ topic: card.topic, status: card.metadata.status, impl: card.metadata.impl, note: card.note, link: card.hyperLink },
    { topic: 'Pays by card', status: 'decision', impl: 'partial', note: 'Card only for now.', link: 'app/pay.mjs' })
  assert.equal(find(data, 'g-buyers').metadata.status, 'topic')
})

test('a Spec file read and written back without a change is left byte for byte as it was', () => {
  const { dir, store } = seeded()
  store.apply([{ op: 'add', id: 'd-two', parent: 't-goal', topic: 'Two servers later', status: 'parked' }])
  assert.equal(file(dir, 'docs/product/spec/app/PRD.md'), APP_PRD, 'a document the ops did not touch is not rewritten')
  assert.equal(file(dir, 'docs/product/spec/parts.md'), PARTS)
})

test('plan apply ops change the Markdown of the Spec', () => {
  const { dir, store } = seeded()
  const { errors } = store.apply([
    { op: 'add', id: 'f-paypal', parent: 'g-buyers', topic: 'Pays by PayPal', status: 'todo', note: 'Ask the shop owner.' },
    { op: 'set', id: 'f-card', impl: 'done' },
    { op: 'set', id: 't-users', prose: 'Who buys.', progress: 'done' },
    { op: 'remove', id: 'd-one' },
  ])
  assert.deepEqual(errors, [])
  const prd = file(dir, 'docs/product/spec/app/PRD.md')
  assert.match(prd, /^## Users \{#t-users \.done\}\n\nWho buys\.\n\n<!-- human: hp-1 -->$/m)
  assert.match(prd, /^  - Pays by card · `f-card` · decision · done · C-1$/m)
  assert.match(prd, /^  - Pays by PayPal · `f-paypal` · todo\n    Ask the shop owner\.$/m)
  assert.match(prd, /superseded by: C-4/, 'what the map does not show stays in the file')
  assert.doesNotMatch(file(dir, 'docs/product/spec/SYSTEM.md'), /d-one/)
})

test('an item moved from one document to another is moved in the files', () => {
  const { dir, store } = seeded()
  const { errors } = store.apply([{ op: 'move', id: 'd-one', parent: 't-users' }])
  assert.deepEqual(errors, [])
  assert.doesNotMatch(file(dir, 'docs/product/spec/SYSTEM.md'), /d-one/)
  assert.match(file(dir, 'docs/product/spec/app/PRD.md'), /One server · `d-one`/)
})

test('a part and a document added by ops become a folder and a file, with the Spec\'s ids', () => {
  const { dir, store } = seeded()
  const { errors, renamed, data } = store.apply([
    { op: 'add', id: 'c-api', parent: 'root', topic: 'Api', component: 'service', dir: 'api' },
    { op: 'add', id: 'doc-api-tech', parent: 'c-api', topic: 'Api: Technical design', doc: 'tech' },
    { op: 'add', id: 't-stack', parent: 'doc-api-tech', topic: 'Stack' },
    { op: 'add', id: 'd-node', parent: 't-stack', topic: 'Node', status: 'decision' },
  ])
  assert.deepEqual(errors, [])
  assert.deepEqual(renamed, [['c-api', 'api'], ['doc-api-tech', 'api/tech']])
  assert.match(file(dir, 'docs/product/spec/api/TECH.md'), /^# Api: Technical design\n\n_Technical design_\n\n## Stack \{#t-stack\}\n\n- Node · `d-node` · decision\n$/)
  assert.match(file(dir, 'docs/product/spec/parts.md'), /^- Api · `api` · service · active$/m)
  assert.ok(find(data, 'api/tech'))
})

test('nodes the Spec has no place for are refused, and the rest is written', () => {
  const { dir, store } = seeded()
  const { errors, data } = store.apply([
    { op: 'add', id: 'stray', parent: 'root', topic: 'A loose thought' },
    { op: 'add', id: 'd-ok', parent: 't-goal', topic: 'Kept', status: 'decision' },
  ])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /stray.*only the parts/)
  assert.equal(find(data, 'stray'), null)
  assert.match(file(dir, 'docs/product/spec/SYSTEM.md'), /d-ok/)
})

test('a section\'s prose with list lines is refused: they would be read back as items', () => {
  const { store } = seeded()
  const { errors } = store.apply([{ op: 'set', id: 't-goal', prose: 'Intro\n- not an item' }])
  assert.equal(errors.length, 1)
  assert.equal(find(store.read().data, 't-goal').metadata.prose, 'Sell things.')
})

test('a hand edit of a Spec file is on the map at the next read, with a new version', () => {
  const { dir, store } = seeded()
  const { v } = store.read()
  put(dir, 'docs/product/spec/SYSTEM.md', SYSTEM.replace('One server', 'One small server'))
  assert.notEqual(store.version(), v)
  assert.equal(find(store.read().data, 'd-one').topic, 'One small server')
})

test('lines without a mark are on the map with an id of its own, and are written back without one', () => {
  const { dir, store } = seeded()
  put(dir, 'docs/product/spec/SYSTEM.md', SYSTEM + '- Typed by hand\n')
  const { data } = store.read()
  const loose = find(data, 't-goal').children.find((n) => n.topic === 'Typed by hand')
  assert.match(loose.id, /^~/)
  assert.ok(!nodeIds(data).includes(loose.id), 'not an id Build can check against')
  store.apply([{ op: 'set', id: loose.id, note: 'Noted.' }])
  assert.match(file(dir, 'docs/product/spec/SYSTEM.md'), /^- Typed by hand\n  Noted\.$/m)
})

test('a browser save on the current version lands in the Markdown and logs the human edit', () => {
  const { dir, store } = seeded()
  const { v, data } = store.read()
  find(data, 'f-card').topic = 'Pays by card or cash'
  const res = store.saveFromBrowser(v, data)
  assert.equal(res.changed, false)
  assert.match(file(dir, 'docs/product/spec/app/PRD.md'), /Pays by card or cash · `f-card`/)
  const edits = store.takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.deepEqual([edits[0].op, edits[0].topic], ['set', 'Pays by card or cash'])
  assert.deepEqual(store.takeHumanEdits(), [], 'edits are taken only once')
})

test('a paragraph the human writes in the browser is kept in the file as theirs', () => {
  const { dir, store } = seeded()
  const { v, data } = store.read()
  find(data, 't-goal').metadata.humanProse = [{ id: 'ab12', text: 'My own words.' }]
  store.saveFromBrowser(v, data)
  assert.match(file(dir, 'docs/product/spec/SYSTEM.md'), /<!-- human: ab12 -->\nMy own words\.\n<!-- \/human -->/)
})

test('a node the human adds becomes "todo"', () => {
  const { store } = seeded()
  const { v, data } = store.read()
  find(data, 't-goal').children.push({ id: 'h1', topic: 'Human idea' })
  const res = store.saveFromBrowser(v, data)
  assert.equal(find(res.data, 'h1').metadata.status, 'todo')
})

test('Claude and the browser write at the same time: both changes survive', () => {
  const { store } = seeded()
  const { v, data: browser } = store.read() // the browser loads
  store.apply([{ op: 'add', id: 'd-b', parent: 't-goal', topic: 'Claude adds' }]) // Claude writes meanwhile
  find(browser, 'f-card').topic = 'Human renames'
  const res = store.saveFromBrowser(v, browser)
  assert.equal(res.changed, true, 'the browser has to reload: the result differs from what it sent')
  const now = store.read().data
  assert.equal(find(now, 'd-b').topic, 'Claude adds')
  assert.equal(find(now, 'f-card').topic, 'Human renames')
})

test('the browser saves on top of an old version: Claude\'s later edits are not undone', () => {
  const { store } = seeded()
  const { v: old, data: browser } = store.read()
  store.apply([{ op: 'set', id: 'f-card', topic: 'Claude renamed' }])
  store.apply([{ op: 'add', id: 'd-c', parent: 't-goal', topic: 'Claude second' }])
  find(browser, 't-goal').children.push({ id: 'h1', topic: 'Human add' })
  store.saveFromBrowser(old, browser)
  const now = store.read().data
  assert.equal(find(now, 'f-card').topic, 'Claude renamed', 'the stale topic in the browser copy is not a human edit')
  assert.ok(find(now, 'd-c'))
  assert.ok(find(now, 'h1'))
  assert.deepEqual(store.takeHumanEdits().map((o) => o.op), ['add'])
})

test('a human removal merges onto a newer Spec', () => {
  const { store } = seeded()
  const { v, data: browser } = store.read()
  store.apply([{ op: 'add', id: 'd-b', parent: 't-goal', topic: 'Claude adds' }])
  find(browser, 't-goal').children = []
  store.saveFromBrowser(v, browser)
  const now = store.read().data
  assert.equal(find(now, 'd-one'), null)
  assert.ok(find(now, 'd-b'))
})

test('human edits of the same node collapse into one', () => {
  const { store } = seeded()
  let { v, data } = store.read()
  find(data, 't-goal').children.push({ id: 'h1', topic: 'one' })
  ;({ v, data } = store.saveFromBrowser(v, data))
  find(data, 'h1').topic = 'two'
  store.saveFromBrowser(v, data)
  const edits = store.takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.deepEqual([edits[0].op, edits[0].topic], ['add', 'two'])
})

test('a store opened later (the CLI, the hook) sees the edits the server logged', () => {
  const { dir, store } = seeded()
  const { v, data } = store.read()
  find(data, 'f-card').topic = 'Changed'
  store.saveFromBrowser(v, data)
  assert.equal(open(dir).takeHumanEdits().length, 1)
})

test('a browser save on a version the store never saw (the server restarted) does not undo Claude\'s edits', () => {
  const { dir, store } = seeded()
  const { v: old, data: browser } = store.read()
  store.apply([{ op: 'add', id: 'd-b', parent: 't-goal', topic: 'Claude adds' }])
  const restarted = open(dir) // a new server: it never saw `old`
  find(browser, 'f-card').topic = 'Human renames'
  const res = restarted.saveFromBrowser(old, browser)
  assert.equal(res.stale, true)
  assert.ok(find(res.data, 'd-b'), 'the answer carries the current map for the browser to show')
  assert.equal(find(restarted.read().data, 'f-card').topic, 'Pays by card')
  assert.deepEqual(restarted.takeHumanEdits(), [])
})

test('version() is the version read() gives, and follows a write made by another store (the CLI)', () => {
  const { dir, store } = seeded()
  const v = store.version()
  assert.equal(v, store.read().v)
  assert.equal(store.version(), v, 'unchanged Spec, same version')
  open(dir).apply([{ op: 'add', id: 'd-b', parent: 't-goal', topic: 'Second' }])
  assert.notEqual(store.version(), v)
  assert.equal(store.version(), store.read().v)
})

test('the document language is the documents\', and set on the root it rewrites them', () => {
  const { dir, store } = seeded()
  const { errors } = store.apply([{ op: 'set', id: 'root', lang: 'hu' }])
  assert.deepEqual(errors, [])
  assert.equal(store.read().data.nodeData.metadata.lang, 'hu')
  assert.match(file(dir, 'docs/product/spec/app/PRD.md'), /Pays by card · `f-card` · döntés · részben · C-1/)
  assert.match(file(dir, 'docs/product/spec/parts.md'), /^# Részek/)
})

test('a language with no strings is refused', () => {
  const { store } = seeded()
  const { errors, data } = store.apply([{ op: 'set', id: 'root', lang: 'xx' }])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /hu, en/, 'the error names the languages there are')
  assert.equal(data.nodeData.metadata.lang, 'en')
})

test('init starts a Spec with its system document, and never starts it again', () => {
  const dir = project()
  const store = open(dir)
  assert.equal(store.exists(), false)
  store.init('Product')
  assert.equal(store.read().data.nodeData.topic, 'Product')
  assert.match(file(dir, 'docs/product/spec/SYSTEM.md'), /^# Product\n/)
  assert.throws(() => store.init('Again'), /already exists/)
})

test('the store writes only under docs/product/ and .groundwork/plan/', () => {
  const { dir, store } = seeded()
  const { v, data } = store.read()
  find(data, 'f-card').topic = 'Changed'
  store.saveFromBrowser(v, data)
  assert.deepEqual(fs.readdirSync(dir).sort(), ['.groundwork', 'docs'])
  assert.deepEqual(fs.readdirSync(path.join(dir, '.groundwork')), ['plan'])
  assert.deepEqual(fs.readdirSync(path.join(dir, 'docs')), ['product'])
  assert.ok(fs.existsSync(path.join(dir, '.groundwork/plan/edits.jsonl')))
})

test('edits left in an old .prd-maker/ folder are moved to .groundwork/plan/ and still taken', () => {
  const { dir, store } = seeded()
  const { v, data } = store.read()
  find(data, 'f-card').topic = 'Edited before the move'
  store.saveFromBrowser(v, data)
  fs.renameSync(path.join(dir, '.groundwork/plan'), path.join(dir, '.prd-maker'))
  fs.rmSync(path.join(dir, '.groundwork'), { recursive: true })
  const edits = open(dir).takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.equal(edits[0].topic, 'Edited before the move')
  assert.equal(fs.existsSync(path.join(dir, '.prd-maker')), false)
  assert.ok(fs.existsSync(path.join(dir, '.groundwork/plan/edits-history.jsonl')))
})

// Until `groundwork migrate` turns it into the Spec, an old project's map is shown as it is.
const OLD_MAP = { nodeData: { id: 'root', topic: 'Old', children: [{ id: 'd-x', topic: 'X', metadata: { status: 'decision' } }] }, direction: 1 }
function old() {
  const dir = project()
  put(dir, 'docs/product/mindmap.json', JSON.stringify(OLD_MAP, null, 2))
  return { dir, store: open(dir) }
}

test('a project with only the old mindmap.json is shown read-only, and every write says to migrate', () => {
  const { dir, store } = old()
  const before = file(dir, 'docs/product/mindmap.json')
  assert.equal(store.exists(), true)
  assert.equal(store.source(), 'mindmap')
  const { v, data, readOnly } = store.read()
  assert.equal(readOnly, true)
  assert.deepEqual(nodeIds(data), ['root', 'd-x'])
  const applied = store.apply([{ op: 'set', id: 'd-x', topic: 'Y' }])
  assert.match(applied.errors[0], /groundwork migrate/)
  find(data, 'd-x').topic = 'Y'
  const saved = store.saveFromBrowser(v, data)
  assert.equal(saved.readOnly, true)
  assert.match(saved.error, /groundwork migrate/)
  assert.throws(() => store.init('New'), /groundwork migrate/)
  assert.equal(file(dir, 'docs/product/mindmap.json'), before, 'nothing written')
  assert.deepEqual(store.takeHumanEdits(), [])
})

test('once there is a Spec, the old mindmap.json is not read any more', () => {
  const { dir } = old()
  put(dir, 'docs/product/spec/SYSTEM.md', SYSTEM)
  const store = open(dir)
  assert.equal(store.source(), 'spec')
  assert.equal(store.read().data.nodeData.topic, 'Shop')
})

test('nodeIds lists the ids of the map, the root first and each node before its children', () => {
  const data = { nodeData: { id: 'root', children: [{ id: 'doc', children: [{ id: 'f-x' }, { id: 'd-y', children: [] }] }, { id: 'n' }] } }
  assert.deepEqual(nodeIds(data), ['root', 'doc', 'f-x', 'd-y', 'n'])
  assert.deepEqual(nodeIds(null), [])
})

test('the store refuses to run without the writer the core grants', () => {
  assert.throws(() => openMap(project()), /writer/)
})
