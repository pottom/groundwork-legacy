// Accepting an idea (accept.mjs, store.accept): the idea's status and the change it opens, written
// together or not at all, and only by the human.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { CORE_RECORDS, readChange } from './changes.mjs'
import { acceptIdea, ROUTES } from './accept.mjs'
import changesModule from '../../modules/changes/module.mjs'
import ideasModule from '../../modules/ideas/module.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-accept-'))
const open = (root, modules = [ideasModule, changesModule, CORE_RECORDS]) => openRecords(root, modules, { today: () => '2026-10-20' })
// every file under docs/product/, with its content
const snapshot = (root) => {
  const dir = path.join(root, 'docs/product')
  if (!fs.existsSync(dir)) return {}
  return Object.fromEntries(fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile()).map((d) => { const f = path.join(d.parentPath ?? d.path, d.name); return [path.relative(root, f), fs.readFileSync(f, 'utf8')] }))
}

function seeded() {
  const root = project()
  const store = open(root)
  store.create('I', { fields: { title: 'Gyors fülváltás', kind: 'product' }, body: 'Ctrl+1 a Build fülre.\n\nMert sokat váltok.' }, { by: 'human' })
  store.update('I-1', { fields: { status: 'considering' } })
  return { root, store }
}

test('the grilling route: the idea is accepted and a change in grilling opens with its title, its text as the problem, linked to it', () => {
  const { store } = seeded()
  const seen = store.get('I-1')
  const out = store.accept('I-1', { route: 'grilling', by: 'human', base: seen?.version })
  assert.equal(out.route, 'grilling')
  assert.equal(out.change.id, 'C-1')
  assert.equal(out.idea.fields.status, 'accepted')

  const change = store.get('C-1')
  assert.ok(change)
  assert.deepEqual(change.fields, { title: 'Gyors fülváltás', ideas: ['I-1'], status: 'grilling' })
  assert.equal(change.fields.milestone, undefined, 'no milestone: the interview gives it')
  const parts = readChange(change.body)
  assert.equal(parts.problem, 'Ctrl+1 a Build fülre.\n\nMert sokat váltok.')
  assert.equal(parts.tickets, 'C-1', 'the tickets rule names the new change')
  assert.deepEqual(parts.items, [])
  assert.deepEqual(change.history, ['2026-10-20 · human · created from I-1'])

  const idea = store.get('I-1')
  assert.equal(idea?.fields.status, 'accepted')
  assert.equal(idea?.history.at(-1), '2026-10-20 · human · accepted → C-1; status: considering → accepted')
  assert.deepEqual(store.show('I-1')?.linkedFrom, ['C-1'], 'the change names the idea; the store computes the other way')
})

test('Claude (the command line) cannot accept an idea, on any route; nothing is written', () => {
  const { root, store } = seeded()
  const before = snapshot(root)
  for (const by of [undefined, 'claude']) {
    assert.throws(() => store.accept('I-1', { route: 'grilling', by: /** @type {any} */ (by) }), { code: 'forbidden' })
  }
  assert.deepEqual(snapshot(root), before)
})

test('the ticket route is refused until it is built; an unknown route, a missing idea, an accepted one and a stale base too', () => {
  const { root, store } = seeded()
  assert.deepEqual(ROUTES, ['grilling', 'ticket'])
  const before = snapshot(root)
  assert.throws(() => store.accept('I-1', { route: 'ticket', by: 'human' }), { code: 'route' })
  assert.throws(() => store.accept('I-1', { route: 'other', by: 'human' }), { code: 'bad' })
  assert.throws(() => store.accept('I-1', { by: 'human' }), { code: 'bad' })
  assert.throws(() => store.accept('I-9', { route: 'grilling', by: 'human' }), { code: 'missing' })
  assert.throws(() => store.accept('C-1', { route: 'grilling', by: 'human' }), { code: 'missing' })
  assert.throws(() => store.accept('I-1', { route: 'grilling', by: 'human', base: 'old' }), { code: 'stale' })
  assert.deepEqual(snapshot(root), before)

  store.accept('I-1', { route: 'grilling', by: 'human' })
  const after = snapshot(root)
  assert.throws(() => store.accept('I-1', { route: 'grilling', by: 'human' }), { code: 'state' })
  assert.deepEqual(snapshot(root), after, 'accepted once, one change')
})

test('all or nothing: a refused write of either record leaves every file as it was', () => {
  // the change's own rule refuses it: the idea is not accepted
  const root = project()
  const strict = { ...changesModule, records: [{ ...changesModule.records[0], rules: () => { throw new Error('no change today') } }] }
  const store = open(root, [ideasModule, strict, CORE_RECORDS])
  store.create('I', { fields: { title: 'X' } }, { by: 'human' })
  const before = snapshot(root)
  assert.throws(() => store.accept('I-1', { route: 'grilling', by: 'human' }), /no change today/)
  assert.deepEqual(snapshot(root), before)

  // the idea's own rule refuses it: no change opens
  const root2 = project()
  const picky = { ...ideasModule, records: [{ ...ideasModule.records[0], rules: (/** @type {any} */ next) => { if (next.status === 'accepted') throw new Error('not this one'); return next } }] }
  const store2 = open(root2, [picky, changesModule, CORE_RECORDS])
  store2.create('I', { fields: { title: 'Y' } }, { by: 'human' })
  const before2 = snapshot(root2)
  assert.throws(() => store2.accept('I-1', { route: 'grilling', by: 'human' }), /not this one/)
  assert.deepEqual(snapshot(root2), before2)
})

test('all or nothing: when the idea\'s write fails after the change is written, the change file goes again', () => {
  const { root, store } = seeded()
  const before = snapshot(root)
  const flaky = {
    ...store,
    discard: (/** @type {{ file: string }} */ rec) => fs.rmSync(path.join(root, rec.file)),
    /** @type {typeof store.update} */
    update: (id, input, opts) => { if (opts?.dry) return store.update(id, input, opts); throw new Error('disk full') },
  }
  assert.throws(() => acceptIdea(flaky, 'I-1', { route: 'grilling', by: 'human' }), /disk full/)
  assert.deepEqual(snapshot(root), before)
  // the number is not reused: the next change is C-2
  assert.equal(store.next('C'), 2)
})

test('only the Ideas module may accept through its store; and no change opens without the Changes module', () => {
  const { store } = seeded()
  assert.throws(() => store.forModule(changesModule).accept('I-1', { route: 'grilling', by: 'human' }), { code: 'forbidden' })
  assert.equal(store.forModule(ideasModule).accept('I-1', { route: 'grilling', by: 'human' }).change.id, 'C-1')

  const root = project()
  const alone = open(root, [ideasModule])
  alone.create('I', { fields: { title: 'Z' } }, { by: 'human' })
  assert.throws(() => alone.accept('I-1', { route: 'grilling', by: 'human' }), { code: 'state' })
  assert.equal(alone.get('I-1')?.fields.status, 'new')
})

test('create runs dry and takes the history line and a body made from the new id', () => {
  const { root, store } = seeded()
  const before = snapshot(root)
  const dry = store.create('C', { fields: { title: 'Próba' }, body: (id) => `## Probléma\n\n${id}` }, { by: 'human', event: 'created from I-1', dry: true })
  assert.equal(dry.id, 'C-1')
  assert.deepEqual(dry.history, ['2026-10-20 · human · created from I-1'])
  assert.equal(dry.body, '## Probléma\n\nC-1')
  assert.deepEqual(snapshot(root), before)
})
