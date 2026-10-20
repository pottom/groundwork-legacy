// Moving a proposed item to another target (move.mjs, store.move and store.targets): the change's
// file gets the new target in its canonical line, and nothing else of it changes.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'
import changesModule from '../../modules/changes/module.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-move-'))
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const open = (root) => openRecords(root, [changesModule, CORE_RECORDS], { today: () => '2026-10-20' })

const SYSTEM = ['# Groundwork', '', '_Rendszer-áttekintés_', '', '## Cél {#t-goal}', '', '- Egy szerver · `d-one` · döntés · kész · C-1', '', '## Elvek {#t-rules}', ''].join('\n')
const CORE_TECH = ['# Mag: Műszaki terv', '', '_Műszaki terv_', '', '## Biztonság {#t-sec}', '', '- React · `d-react` · döntés · C-1', ''].join('\n')

function seeded() {
  const root = project()
  put(root, 'docs/product/spec/SYSTEM.md', SYSTEM)
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH)
  put(root, 'docs/product/spec/parts.md', '# Részek\n\n- Mag · `core` · software · aktív\n')
  const store = open(root)
  store.create('C', { fields: { title: 'Mozgat' }, body: ['## Probléma', '', 'Valami.', '', '## Javasolt elemek', '',
    '- add `d-a` → `system#t-goal` — Egy elem · döntés · hiányzik',
    '  A jegyzete marad.',
    '- add `t-new` → `system` — Új fejezet',
    '- change `d-one` → `system#t-goal` — Másképp · döntés · kész',
    '- add `records/tech` → `records` — Rekordtár: Műszaki terv', ''].join('\n') })
  store.create('C', { fields: { title: 'Másik' }, body: ['## Javasolt elemek', '',
    '- add `records` → `parts` — Rekordtár · software · A rekordok.',
    '- add `rec/prd` → `rec` — Rekord: PRD',
    '- add `t-rec-data` → `core/tech` — Adatok',
    '- add `d-x` → `core/tech#t-sec` — Elem · döntés · hiányzik', ''].join('\n') })
  for (const id of ['C-1', 'C-2']) store.update(id, { fields: { status: 'awaiting-approval' } }, { by: 'human' })
  return { root, store }
}

test('the targets: the Spec\'s documents and sections, then those the pending changes propose, marked with the change', () => {
  const { store } = seeded()
  const t = store.targets()
  assert.deepEqual(t.filter((x) => !x.change).map((x) => [x.target, x.kind]), [
    ['system', 'document'], ['system#t-goal', 'section'], ['system#t-rules', 'section'], ['core/tech', 'document'], ['core/tech#t-sec', 'section']])
  assert.deepEqual(t.find((x) => x.target === 'core/tech#t-sec'), { target: 'core/tech#t-sec', kind: 'section', title: 'Biztonság', document: 'core/tech' })
  assert.deepEqual(t.filter((x) => x.change).map((x) => [x.target, x.kind, x.change]), [
    ['system#t-new', 'section', 'C-1'], ['records/tech', 'document', 'C-1'], ['rec/prd', 'document', 'C-2'], ['core/tech#t-rec-data', 'section', 'C-2']])
  assert.deepEqual(t.find((x) => x.target === 'core/tech#t-rec-data'), { target: 'core/tech#t-rec-data', kind: 'section', title: 'Adatok', document: 'core/tech', change: 'C-2' })
})

test('moving an item rewrites its line in the change file, the canonical form, and nothing else', () => {
  const { root, store } = seeded()
  const file = path.join(root, store.get('C-1').file)
  const before = fs.readFileSync(file, 'utf8')
  const out = store.move('C-1', { item: 'd-a', target: 'core/tech#t-rec-data', by: 'human', base: store.get('C-1').version })
  assert.deepEqual([out.id, out.item, out.from, out.target], ['C-1', 'd-a', 'system#t-goal', 'core/tech#t-rec-data'])
  const after = fs.readFileSync(file, 'utf8')
  assert.equal(after.replace('- add `d-a` → `core/tech#t-rec-data` — Egy elem', '- add `d-a` → `system#t-goal` — Egy elem').replace(/\n- 2026-10-20 · human · moved d-a: system#t-goal → core\/tech#t-rec-data/, ''), before)
  assert.match(after, /\n- add `d-a` → `core\/tech#t-rec-data` — Egy elem · döntés · hiányzik\n  A jegyzete marad\.\n/)
  assert.equal(store.get('C-1').history.at(-1), '2026-10-20 · human · moved d-a: system#t-goal → core/tech#t-rec-data')
  assert.equal(out.version, store.get('C-1').version)
  // a section goes to another document
  store.move('C-1', { item: 't-new', target: 'core/tech', by: 'human' })
  assert.equal(store.show('C-1').outline.items[1].target, 'core/tech')
  assert.deepEqual(store.spec.check().problems, [])
})

test('a move is refused for an unknown target, one that does not fit, a stale base, an item that does not move, and a merged or closed change', () => {
  const { root, store } = seeded()
  const file = path.join(root, store.get('C-1').file)
  const before = fs.readFileSync(file, 'utf8')
  const move = (item, target, more = {}) => () => store.move('C-1', { item, target, by: 'human', ...more })
  assert.throws(move('d-a', 'system#t-nope'), { code: 'target' })
  assert.throws(move('d-a', 'parts'), { code: 'target' })
  assert.throws(move('t-new', 'system#t-rules'), { code: 'target' }, 'a section goes into a document only')
  assert.throws(move('d-a', 'core/tech', { base: 'old' }), { code: 'stale' })
  assert.throws(move('d-ghost', 'core/tech'), { code: 'missing' })
  assert.throws(move('d-one', 'core/tech#t-sec'), { code: 'bad' }, 'a change stays where the item is')
  assert.throws(move('records/tech', 'core/tech'), { code: 'bad' }, 'a document goes into its own part')
  assert.throws(() => store.move('C-9', { item: 'd-a', target: 'core/tech', by: 'human' }), { code: 'missing' })
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'nothing written')
  // the same target: nothing to write
  assert.equal(store.move('C-1', { item: 'd-a', target: 'system#t-goal', by: 'human' }).version, store.get('C-1').version)
  assert.equal(fs.readFileSync(file, 'utf8'), before)
  store.update('C-1', { fields: { status: 'dropped' } }, { by: 'human' })
  assert.throws(move('d-a', 'core/tech'), { code: 'state' })
})

test('a merged change\'s items do not move any more', () => {
  const root = project()
  put(root, 'docs/product/spec/SYSTEM.md', SYSTEM)
  const store = open(root)
  store.create('C', { fields: { title: 'Egy' }, body: '## Javasolt elemek\n\n- add `d-a` → `system#t-goal` — A · döntés · hiányzik\n' })
  store.update('C-1', { fields: { status: 'awaiting-approval' } }, { by: 'human' })
  store.merge('C-1', { by: 'human' })
  assert.throws(() => store.move('C-1', { item: 'd-a', target: 'system#t-rules', by: 'human' }), { code: 'merged' })
})

test('a module moves items only when it declares the changes', () => {
  const { store } = seeded()
  assert.throws(() => store.forModule({ id: 'other', writes: ['docs/product'] }).move('C-1', { item: 'd-a', target: 'core/tech', by: 'human' }), { code: 'forbidden' })
  assert.equal(store.forModule(changesModule).move('C-1', { item: 'd-a', target: 'core/tech', by: 'human' }).target, 'core/tech')
})
