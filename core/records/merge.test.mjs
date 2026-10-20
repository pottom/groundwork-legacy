// Merging a change into the Spec (merge.mjs, store.merge and store.merged): all or nothing, with
// the change in each item's origin, and only by the human.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'
import changesModule from '../../modules/changes/module.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-merge-'))
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const open = (root) => openRecords(root, [changesModule, CORE_RECORDS], { today: () => '2026-10-20' })
// every file under docs/product/, with its content
const snapshot = (root) => Object.fromEntries(fs.readdirSync(path.join(root, 'docs/product'), { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile()).map((d) => { const f = path.join(d.parentPath ?? d.path, d.name); return [path.relative(root, f), fs.readFileSync(f, 'utf8')] }))

const SYSTEM = ['# Groundwork', '', '_Rendszer-áttekintés_', '', '## Cél {#t-goal}', '', '- Egy szerver · `d-one` · döntés · kész · C-1', ''].join('\n')
const CORE_TECH = [
  '# Mag: Műszaki terv', '', '_Műszaki terv_', '',
  '## Biztonság {#t-sec}', '', '- Írni csak a docs/product/ alá · `d-write` · döntés · kész · C-1',
  '- React · `d-react` · döntés · C-1', '',
].join('\n')
const PARTS = ['# Részek', '', '- Mag · `core` · software · aktív', ''].join('\n')

/** A project with a Spec and one change, C-1, proposing `items` (lines of its Javasolt elemek). */
function seeded(items, { status = 'awaiting-approval' } = {}) {
  const root = project()
  put(root, 'docs/product/spec/SYSTEM.md', SYSTEM)
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH)
  put(root, 'docs/product/spec/parts.md', PARTS)
  const store = open(root)
  store.create('C', { fields: { title: 'Egy változás' }, body: `## Javasolt elemek\n\n${items.join('\n')}\n` })
  if (status !== 'grilling') store.update('C-1', { fields: { status } }, { by: 'human' })
  return { root, store }
}

test('merge writes every kind of proposed item into the Spec with the change as its origin, and moves the change to implementing', () => {
  const { root, store } = seeded([
    '- add `records` → `parts` — Rekordtár · software · A rekordok tárolása.',
    '- add `records/tech` → `records` — Rekordtár: Műszaki terv',
    '- add `t-rec-data` → `records/tech` — Adatok és tárolás',
    '  A Markdown a forrás.',
    '- add `d-rec-md` → `records/tech#t-rec-data` — Markdown a forrás · döntés · hiányzik',
    '  A fájl a forrás, a cache csak gyorsít.',
    '- add `g-types` → `system#t-goal` — **Rekordtípusok** · hiányzik',
    '- add `d-idea` → `system#g-types` — Ötlet (I-n) · döntés · hiányzik',
    '- add `x-db` → `system#t-goal` — Adatbázis · kizárt · hiányzik',
    '- change `d-write` → `core/tech#t-sec` — Írni csak a docs/product/ és a .groundwork/ alá · döntés · kész',
    '- supersede `d-react` → `core/tech#t-sec` — React helyett Lit',
  ])
  assert.equal(store.merged('C-1'), false)
  const out = store.merge('C-1', { by: 'human' })
  assert.equal(out.status, 'implementing')
  assert.deepEqual(out.documents.sort(), ['core/tech', 'parts', 'records/tech', 'system'])

  assert.match(read(root, 'docs/product/spec/parts.md'), /\n- Rekordtár · `records` · software · A rekordok tárolása\. · aktív\n/)
  assert.equal(read(root, 'docs/product/spec/records/TECH.md'), [
    '# Rekordtár: Műszaki terv', '', '_Műszaki terv_', '',
    '## Adatok és tárolás {#t-rec-data}', '', 'A Markdown a forrás.', '',
    '- Markdown a forrás · `d-rec-md` · döntés · hiányzik · C-1', '  A fájl a forrás, a cache csak gyorsít.', '',
  ].join('\n'))
  const system = read(root, 'docs/product/spec/SYSTEM.md')
  assert.match(system, /\n- \*\*Rekordtípusok\*\* · `g-types` · hiányzik · C-1\n  - Ötlet \(I-n\) · `d-idea` · döntés · hiányzik · C-1\n- Adatbázis · `x-db` · kizárt · hiányzik · C-1\n/)
  const tech = read(root, 'docs/product/spec/core/TECH.md')
  assert.match(tech, /\n- Írni csak a docs\/product\/ és a \.groundwork\/ alá · `d-write` · döntés · kész · C-1\n/, 'the change is in its origin once')
  assert.match(tech, /\n- React · `d-react` · döntés · C-1 · felváltotta: C-1\n/)

  const rec = store.get('C-1')
  assert.equal(rec.fields.status, 'implementing')
  assert.equal(rec.history.at(-1), '2026-10-20 · human · merged; status: awaiting-approval → implementing')
  assert.equal(store.merged('C-1'), true)
  assert.deepEqual(store.spec.check(), { duplicates: [], problems: [] })
  assert.throws(() => store.merge('C-1', { by: 'human' }), { code: 'merged' })
})

test('a change appends itself to the origin list of the item it changes', () => {
  const root = project()
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH)
  const store = open(root)
  store.create('C', { fields: { title: 'Első' } })
  store.create('C', { fields: { title: 'Második' }, body: '## Javasolt elemek\n\n- change `d-write` → `core/tech#t-sec` — Írni csak a docs/product/ és a .groundwork/ alá · döntés · részben\n  A .groundwork/ a gyorsítótáré.\n' })
  store.update('C-2', { fields: { status: 'awaiting-approval' } })
  store.merge('C-2', { by: 'human' })
  assert.match(read(root, 'docs/product/spec/core/TECH.md'), /\n- Írni csak a docs\/product\/ és a \.groundwork\/ alá · `d-write` · döntés · részben · C-1, C-2\n  A \.groundwork\/ a gyorsítótáré\.\n/)
  assert.equal(store.merged('C-2'), true)
})

test('an implementing change keeps its status; the history gets a merged line for the human', () => {
  const { store } = seeded(['- add `d-new` → `system#t-goal` — Új · döntés · hiányzik'], { status: 'implementing' })
  const out = store.merge('C-1', { by: 'human' })
  assert.equal(out.status, 'implementing')
  assert.equal(store.get('C-1').history.at(-1), '2026-10-20 · human · merged')
})

test('an id already in the Spec refuses the whole merge: nothing is written, and the problem names the item', () => {
  const { root, store } = seeded([
    '- add `d-fine` → `core/tech#t-sec` — Rendben · döntés · hiányzik',
    '- add `d-one` → `core/tech#t-sec` — Már van ilyen · döntés · hiányzik',
    '- add `d-lost` → `core/tech#t-nope` — Nincs ilyen fejezet · döntés · hiányzik',
    '- change `d-ghost` → `core/tech#t-sec` — Nincs ilyen elem · döntés · hiányzik',
  ])
  const before = snapshot(root)
  assert.throws(() => store.merge('C-1', { by: 'human' }), (e) => {
    assert.equal(e.code, 'merge')
    assert.deepEqual(e.problems.map((p) => [p.id, p.code]), [['d-one', 'duplicate'], ['d-lost', 'target'], ['d-ghost', 'missing']])
    assert.match(e.problems[0].message, /d-one is already in system/)
    return true
  })
  assert.deepEqual(snapshot(root), before, 'nothing written: not the Spec, not the change')
  assert.equal(store.merged('C-1'), false)
})

test('a document changed while the merge was being put together refuses it all: no other document is written either', () => {
  const { root, store } = seeded([
    '- add `d-a` → `system#t-goal` — A · döntés · hiányzik',
    '- add `d-b` → `core/tech#t-sec` — B · döntés · hiányzik',
  ])
  const real = store.spec.writeMany
  // someone saves core/TECH.md between the read and the write
  store.spec.writeMany = (input) => { put(root, 'docs/product/spec/core/TECH.md', CORE_TECH.replace('React', 'Preact')); return real(input) }
  const before = { ...snapshot(root), 'docs/product/spec/core/TECH.md': CORE_TECH.replace('React', 'Preact') }
  assert.throws(() => store.merge('C-1', { by: 'human' }), (e) => {
    assert.equal(e.code, 'merge')
    assert.deepEqual(e.problems.map((p) => [p.id, p.code]), [['d-b', 'stale']])
    return true
  })
  store.spec.writeMany = real
  assert.deepEqual(snapshot(root), before, 'SYSTEM.md is not written, the change stays awaiting approval')
  assert.equal(store.get('C-1').fields.status, 'awaiting-approval')
})

test('a change changed since the page read it is refused; so is a closed one and one without items', () => {
  const { store } = seeded(['- add `d-a` → `system#t-goal` — A · döntés · hiányzik'])
  assert.throws(() => store.merge('C-1', { by: 'human', base: 'old' }), { code: 'stale' })
  assert.throws(() => store.merge('C-9', { by: 'human' }), { code: 'missing' })
  store.create('C', { fields: { title: 'Üres' } })
  assert.throws(() => store.merge('C-2', { by: 'human' }), { code: 'empty' })
  store.update('C-1', { fields: { status: 'dropped' } }, { by: 'human' })
  assert.throws(() => store.merge('C-1', { by: 'human' }), { code: 'state' })
  assert.equal(store.merged('C-2'), false)
  assert.equal(store.merged('C-9'), null)
})

test('a superseded item cannot be superseded again', () => {
  const root = project()
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH.replace('`d-react` · döntés · C-1', '`d-react` · döntés · C-1 · felváltotta: C-7'))
  const store = open(root)
  store.create('C', { fields: { title: 'Megint' }, body: '## Javasolt elemek\n\n- supersede `d-react` → `core/tech#t-sec`\n' })
  assert.throws(() => store.merge('C-1', { by: 'human' }), (e) => e.code === 'merge' && e.problems[0].code === 'superseded')
})

test('Claude (the command line, by default) cannot merge; a module may only when it declares the changes and writes the Spec', () => {
  const { root, store } = seeded(['- add `d-a` → `system#t-goal` — A · döntés · hiányzik'])
  const before = snapshot(root)
  assert.throws(() => store.merge('C-1'), { code: 'forbidden' })
  assert.throws(() => store.merge('C-1', { by: 'claude' }), { code: 'forbidden' })
  assert.deepEqual(snapshot(root), before)
  assert.throws(() => store.forModule({ id: 'other', writes: ['docs/product'] }).merge('C-1', { by: 'human' }), { code: 'forbidden' })
  assert.throws(() => store.forModule({ id: 'changes', records: changesModule.records, writes: [] }).merge('C-1', { by: 'human' }), { code: 'forbidden' })
  assert.equal(store.forModule(changesModule).merge('C-1', { by: 'human' }).status, 'implementing')
})

// Changes merge in order (d-merge-in-order): an item whose target another pending change brings
// waits for that change, and the merge is refused until that one is merged.
function chained() {
  const root = project()
  put(root, 'docs/product/spec/SYSTEM.md', SYSTEM)
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH)
  put(root, 'docs/product/spec/parts.md', PARTS)
  const store = open(root)
  // C-1 brings a part, its document and a section, and an item
  store.create('C', { fields: { title: 'Alap' }, body: ['## Javasolt elemek', '',
    '- add `records` → `parts` — Rekordtár · software · A rekordok.',
    '- add `records/tech` → `records` — Rekordtár: Műszaki terv',
    '- add `t-rec-data` → `records/tech` — Adatok',
    '- add `d-base` → `system#t-goal` — Alap · döntés · hiányzik', ''].join('\n') })
  // C-2 builds on it, and on what is in the Spec already
  store.create('C', { fields: { title: 'Ráépül' }, body: ['## Javasolt elemek', '',
    '- add `d-fine` → `system#t-goal` — A Specben van a célja · döntés · hiányzik',
    '- add `d-rec` → `records/tech#t-rec-data` — A C-1 fejezetébe · döntés · hiányzik',
    '- add `t-more` → `records/tech` — A C-1 dokumentumába',
    '- add `d-more` → `records/tech#t-more` — A saját fejezetébe, ami a C-1 dokumentumában van · döntés · hiányzik',
    '- change `d-base` → `system#t-goal` — A C-1 eleme, másképp · döntés · hiányzik',
    '- add `d-own` → `system#d-fine` — A saját eleme alá · döntés · hiányzik',
    '- change `d-one` → `system#t-goal` — Ezt a C-1 is említhetné, de a Specben van · döntés · kész', ''].join('\n') })
  for (const id of ['C-1', 'C-2']) store.update(id, { fields: { status: 'awaiting-approval' } }, { by: 'human' })
  return { root, store }
}

test('an item whose target a pending change brings waits for it: the merge is refused, nothing is written', () => {
  const { root, store } = chained()
  const waits = store.waits('C-2')
  assert.deepEqual(waits.map((w) => [w.id, w.waitsFor]), [['d-rec', 'C-1'], ['t-more', 'C-1'], ['d-more', 'C-1'], ['d-base', 'C-1']])
  assert.deepEqual(waits[0], { id: 'd-rec', op: 'add', target: 'records/tech#t-rec-data', waitsFor: 'C-1', on: 'records/tech' })
  assert.deepEqual(store.waits('C-1'), [], 'C-1 waits for nothing')
  const before = snapshot(root)
  assert.throws(() => store.merge('C-2', { by: 'human' }), (e) => {
    assert.equal(e.code, 'merge')
    assert.deepEqual(e.problems.map((p) => [p.id, p.code, p.waitsFor]), [['d-rec', 'waiting', 'C-1'], ['t-more', 'waiting', 'C-1'], ['d-more', 'waiting', 'C-1'], ['d-base', 'waiting', 'C-1']])
    assert.match(e.problems[0].message, /d-rec waits for C-1: records\/tech is in C-1, not merged yet/)
    return true
  })
  assert.deepEqual(snapshot(root), before, 'nothing written')
  assert.equal(store.merged('C-2'), false)
})

test('once the change it waits for is merged, the waiting one merges', () => {
  const { root, store } = chained()
  store.merge('C-1', { by: 'human' })
  assert.deepEqual(store.waits('C-2'), [])
  assert.equal(store.merge('C-2', { by: 'human' }).status, 'implementing')
  assert.match(read(root, 'docs/product/spec/records/TECH.md'), /- A C-1 fejezetébe · `d-rec` · döntés · hiányzik · C-2\n/)
  assert.match(read(root, 'docs/product/spec/SYSTEM.md'), /- A C-1 eleme, másképp · `d-base` · döntés · hiányzik · C-1, C-2\n/)
  assert.equal(store.merged('C-2'), true)
})

test('a dropped or done change brings nothing to wait for; a target in a grilling change waits too', () => {
  const { store } = chained()
  store.update('C-1', { fields: { status: 'grilling' } }, { by: 'human' })
  assert.equal(store.waits('C-2').length, 4)
  store.update('C-1', { fields: { status: 'dropped' } }, { by: 'human' })
  assert.deepEqual(store.waits('C-2'), [])
  assert.throws(() => store.merge('C-2', { by: 'human' }), (e) => e.code === 'merge' && e.problems.every((p) => p.code !== 'waiting'))
})
