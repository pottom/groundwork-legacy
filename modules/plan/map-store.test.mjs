// Tests of the map store through its interface: read, apply, saveFromBrowser, takeHumanEdits.
// Run: node --test modules/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openMap } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'

// The store as the CLI and the server open it: through the writer the core grants Plan.
const open = (dir) => openMap(dir, moduleFiles(dir, plan))

function fresh() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-'))
  const store = open(dir)
  store.init('Product')
  store.apply([
    { op: 'add', id: 'doc', parent: 'root', topic: 'Product', doc: 'prd' },
    { op: 'add', id: 'goal', parent: 'doc', topic: 'Goal' },
    { op: 'add', id: 'a', parent: 'goal', topic: 'First', status: 'decision' },
  ])
  return { dir, store }
}

const find = (data, id) => {
  let hit = null
  const rec = (n) => { if (n.id === id) hit = n; for (const c of n.children || []) rec(c) }
  rec(data.nodeData)
  return hit
}

test('apply adds nodes and writes the documents', () => {
  const { dir, store } = fresh()
  const { data } = store.read()
  assert.equal(find(data, 'a').topic, 'First')
  assert.ok(fs.readFileSync(path.join(dir, 'docs/product/PRD.md'), 'utf8').includes('First'))
})

test('apply reports errors and keeps going', () => {
  const { store } = fresh()
  const { errors, data } = store.apply([{ op: 'set', id: 'nope', topic: 'x' }, { op: 'set', id: 'a', topic: 'Renamed' }])
  assert.equal(errors.length, 1)
  assert.equal(find(data, 'a').topic, 'Renamed')
})

test('a browser save on the current version keeps the browser layout and logs the human edit', () => {
  const { store } = fresh()
  const { v, data } = store.read()
  find(data, 'a').topic = 'Edited by human'
  const res = store.saveFromBrowser(v, data)
  assert.equal(res.changed, false)
  assert.equal(find(store.read().data, 'a').topic, 'Edited by human')
  const edits = store.takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.equal(edits[0].op, 'set')
  assert.equal(edits[0].topic, 'Edited by human')
  assert.deepEqual(store.takeHumanEdits(), [], 'edits are taken only once')
})

test('a node the human adds becomes "todo" and is marked as theirs', () => {
  const { store } = fresh()
  const { v, data } = store.read()
  find(data, 'goal').children.push({ id: 'h', topic: 'Human idea' })
  const res = store.saveFromBrowser(v, data)
  const node = find(res.data, 'h')
  assert.equal(node.metadata.status, 'todo')
  assert.equal(node.metadata.by, 'human')
})

test('Claude and the browser write at the same time: both changes survive', () => {
  const { store } = fresh()
  const { v, data: browser } = store.read() // the browser loads
  store.apply([{ op: 'add', id: 'b', parent: 'goal', topic: 'Claude adds' }]) // Claude writes meanwhile
  find(browser, 'a').topic = 'Human renames'
  const res = store.saveFromBrowser(v, browser)
  assert.equal(res.changed, true, 'the browser has to reload: the result differs from what it sent')
  const now = store.read().data
  assert.equal(find(now, 'b').topic, 'Claude adds')
  assert.equal(find(now, 'a').topic, 'Human renames')
})

test('the browser saves on top of an old version: Claude\'s later edits are not undone', () => {
  const { store } = fresh()
  const { v: old, data: browser } = store.read()
  store.apply([{ op: 'set', id: 'a', topic: 'Claude renamed' }])
  store.apply([{ op: 'add', id: 'c', parent: 'goal', topic: 'Claude second' }])
  find(browser, 'goal').children.push({ id: 'h', topic: 'Human add' })
  store.saveFromBrowser(old, browser)
  const now = store.read().data
  assert.equal(find(now, 'a').topic, 'Claude renamed', 'the stale topic in the browser copy is not a human edit')
  assert.ok(find(now, 'c'))
  assert.equal(find(now, 'h').metadata.by, 'human')
  assert.deepEqual(store.takeHumanEdits().map((o) => o.op), ['add'])
})

test('a human removal merges onto a newer file', () => {
  const { store } = fresh()
  const { v, data: browser } = store.read()
  store.apply([{ op: 'add', id: 'b', parent: 'goal', topic: 'Claude adds' }])
  find(browser, 'goal').children = []
  store.saveFromBrowser(v, browser)
  const now = store.read().data
  assert.equal(find(now, 'a'), null)
  assert.ok(find(now, 'b'))
})

test('human edits of the same node collapse into one', () => {
  const { store } = fresh()
  let { v, data } = store.read()
  find(data, 'goal').children.push({ id: 'h', topic: 'one' })
  ;({ v, data } = store.saveFromBrowser(v, data))
  find(data, 'h').topic = 'two'
  store.saveFromBrowser(v, data)
  const edits = store.takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.equal(edits[0].op, 'add')
  assert.equal(edits[0].topic, 'two')
})

test('a store opened later (the CLI, the hook) sees the edits the server logged', () => {
  const { dir, store } = fresh()
  const { v, data } = store.read()
  find(data, 'a').topic = 'Changed'
  store.saveFromBrowser(v, data)
  assert.equal(open(dir).takeHumanEdits().length, 1)
})

test('version() is the version read() gives, and follows a write made by another store (the CLI)', () => {
  const { dir, store } = fresh()
  const v = store.version()
  assert.equal(v, store.read().v)
  assert.equal(store.version(), v, 'unchanged file, same version')
  open(dir).apply([{ op: 'add', id: 'b', parent: 'goal', topic: 'Second' }])
  assert.notEqual(store.version(), v)
  assert.equal(store.version(), store.read().v)
  assert.equal(find(store.read().data, 'b').topic, 'Second')
})

test('init refuses to overwrite an existing map unless forced', () => {
  const { store } = fresh()
  assert.throws(() => store.init('Again'), /already exists/)
  store.init('Again', { force: true })
  assert.equal(store.read().data.nodeData.topic, 'Again')
})

test('the store writes only under docs/product/ and .groundwork/plan/', () => {
  const { dir, store } = fresh()
  const { v, data } = store.read()
  find(data, 'a').topic = 'Changed'
  store.saveFromBrowser(v, data)
  const top = fs.readdirSync(dir).sort()
  assert.deepEqual(top, ['.groundwork', 'docs'])
  assert.deepEqual(fs.readdirSync(path.join(dir, '.groundwork')), ['plan'])
  assert.deepEqual(fs.readdirSync(path.join(dir, 'docs')), ['product'])
  assert.ok(fs.existsSync(path.join(dir, '.groundwork/plan/edits.jsonl')))
})

test('the store refuses to run without the writer the core grants', () => {
  assert.throws(() => openMap(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-'))), /writer/)
})

test('edits left in an old .prd-maker/ folder are moved to .groundwork/plan/ and still taken', () => {
  const { dir, store } = fresh()
  const { v, data } = store.read()
  find(data, 'a').topic = 'Edited before the move'
  store.saveFromBrowser(v, data)
  // Put the state back where the prd-maker prototype kept it.
  fs.renameSync(path.join(dir, '.groundwork/plan'), path.join(dir, '.prd-maker'))
  fs.rmSync(path.join(dir, '.groundwork'), { recursive: true })
  const edits = open(dir).takeHumanEdits()
  assert.equal(edits.length, 1)
  assert.equal(edits[0].topic, 'Edited before the move')
  assert.equal(fs.existsSync(path.join(dir, '.prd-maker')), false)
  assert.ok(fs.existsSync(path.join(dir, '.groundwork/plan/edits-history.jsonl')))
  assert.ok(fs.existsSync(path.join(dir, '.groundwork/plan/written.json')))
})

test('a browser save on a version the store never saw (the server restarted) does not undo Claude\'s edits', () => {
  const { dir, store } = fresh()
  const { v: old, data: browser } = store.read()
  store.apply([{ op: 'add', id: 'b', parent: 'goal', topic: 'Claude adds' }])
  const restarted = open(dir) // a new server: it never saw `old`
  find(browser, 'a').topic = 'Human renames'
  const res = restarted.saveFromBrowser(old, browser)
  assert.equal(res.stale, true)
  assert.ok(find(res.data, 'b'), 'the answer carries the current map for the browser to show')
  const now = restarted.read().data
  assert.ok(find(now, 'b'), 'Claude\'s node is not removed')
  assert.equal(find(now, 'a').topic, 'First')
  assert.deepEqual(restarted.takeHumanEdits(), [])
})

test('the document language is set on the root and the documents follow it', () => {
  const { dir, store } = fresh()
  const prd = () => fs.readFileSync(path.join(dir, 'docs/product/PRD.md'), 'utf8')
  assert.match(prd(), /> Állapot:/, 'a map without a language is Hungarian')
  const { errors } = store.apply([{ op: 'set', id: 'root', lang: 'en' }])
  assert.deepEqual(errors, [])
  assert.equal(store.read().data.nodeData.metadata.lang, 'en')
  assert.match(prd(), /> Sections: /)
})

test('a language with no strings is refused', () => {
  const { store } = fresh()
  const { errors, data } = store.apply([{ op: 'set', id: 'root', lang: 'xx' }])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /hu, en/, 'the error names the languages there are')
  assert.equal(data.nodeData.metadata?.lang, undefined)
})

test('browser saves keep the document language', () => {
  const { store } = fresh()
  store.apply([{ op: 'set', id: 'root', lang: 'en' }])
  let { v, data } = store.read()
  find(data, 'a').topic = 'Edited by human'
  store.saveFromBrowser(v, data) // nobody wrote meanwhile: the browser's map is kept
  assert.equal(store.read().data.nodeData.metadata.lang, 'en')
  ;({ v, data } = store.read())
  store.apply([{ op: 'add', id: 'b', parent: 'goal', topic: 'Claude adds' }])
  find(data, 'a').topic = 'Edited again'
  store.saveFromBrowser(v, data) // Claude wrote meanwhile: the edit is replayed
  assert.equal(store.read().data.nodeData.metadata.lang, 'en')
})
