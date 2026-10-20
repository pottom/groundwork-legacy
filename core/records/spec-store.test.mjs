// The Spec in the record store (spec-store.mjs, store.spec): its documents and parts read from
// docs/product/spec/, ids unique across the whole Spec, and canonical writes that keep a
// superseded item.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { MODULES } from '../modules.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-spec-'))
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}

const CORE_TECH = [
  '# Mag: Műszaki terv', '', '_Műszaki terv_', '',
  '## Technológiai stack {#t-stack .done}', '', 'Node.', '',
  '- npm-csomag · `d-npm` · döntés · kész · C-1',
  '- React · `d-react` · döntés · C-1 · felváltotta: C-9', '',
].join('\n')
const SYSTEM = ['# Groundwork', '', '_Rendszer-áttekintés_', '', '## Cél {#t-goal}', '', '- Egy szerver · `d-one` · döntés · C-1', ''].join('\n')
const PARTS = ['# Részek', '', '- Mag · `core` · software · A szerver és a tár. · aktív', ''].join('\n')

function seeded() {
  const root = project()
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH)
  put(root, 'docs/product/spec/SYSTEM.md', SYSTEM)
  put(root, 'docs/product/spec/parts.md', PARTS)
  return { root, spec: openRecords(root, MODULES).spec }
}

test('the store gives a Spec document by its id, with its sections and items', () => {
  const { spec } = seeded()
  const doc = spec.doc('core/tech')
  assert.equal(doc.file, 'docs/product/spec/core/TECH.md')
  assert.equal(doc.title, 'Mag: Műszaki terv')
  assert.deepEqual(doc.sections.map((s) => [s.id, s.done]), [['t-stack', true]])
  assert.deepEqual(doc.sections[0].items.map((i) => [i.id, i.status, i.impl ?? '', i.origin, i.supersededBy ?? '']), [
    ['d-npm', 'decision', 'done', ['C-1'], ''],
    ['d-react', 'decision', '', ['C-1'], 'C-9'],
  ])
  assert.match(doc.version, /^[0-9a-f]{12}$/)
  assert.deepEqual(doc.problems, [])
  assert.equal(spec.doc('system').sections[0].id, 't-goal')
  assert.equal(spec.doc('core/prd'), null)
  assert.deepEqual(spec.docs().map((d) => d.id), ['system', 'core/tech'])
})

test('the parts come from spec/parts.md, and any id of the Spec is found: part, document, section, item', () => {
  const { spec } = seeded()
  assert.deepEqual(spec.parts().parts, [{ name: 'Mag', slug: 'core', type: 'software', description: 'A szerver és a tár.', active: true }])
  assert.equal(spec.find('core').kind, 'part')
  assert.deepEqual(spec.find('core').documents, ['core/tech'])
  assert.equal(spec.find('core/tech').kind, 'document')
  assert.deepEqual([spec.find('t-stack').kind, spec.find('t-stack').document], ['section', 'core/tech'])
  const npm = spec.find('d-npm')
  assert.deepEqual([npm.kind, npm.document, npm.item.topic], ['item', 'core/tech', 'npm-csomag'])
  assert.equal(spec.find('nope'), null)
})

test('item ids are unique across the Spec: one used in two documents is reported, with every place', () => {
  const { root } = seeded()
  put(root, 'docs/product/spec/ideas/PRD.md', ['# Ötletek', '', '_Termékkövetelmény-dokumentum (PRD)_', '', '## Cél {#t-ideas}', '', '- Más · `d-npm` · döntés · C-2', ''].join('\n'))
  const { duplicates } = openRecords(root, MODULES).spec.check()
  assert.deepEqual(duplicates, [{ id: 'd-npm', documents: ['core/tech', 'ideas/prd'] }])
})

test('a write is canonical, and refuses an id another document has, a superseded item dropped, a stale version', () => {
  const { root, spec } = seeded()
  const doc = spec.doc('core/tech')
  doc.sections[0].items[0].impl = 'partial'
  const written = spec.writeDoc(doc, { base: doc.version })
  assert.equal(written.sections[0].items[0].impl, 'partial')
  assert.match(fs.readFileSync(path.join(root, 'docs/product/spec/core/TECH.md'), 'utf8'), /\n- npm-csomag · `d-npm` · döntés · részben · C-1\n/)
  assert.throws(() => spec.writeDoc(doc, { base: doc.version }), { code: 'stale' })

  const fresh = spec.doc('core/tech')
  fresh.sections[0].items.push({ id: 'd-one', topic: 'Másik', status: 'decision', origin: ['C-3'], items: [] })
  assert.throws(() => spec.writeDoc(fresh), { code: 'duplicate', message: /d-one.*system/ })

  const dropped = spec.doc('core/tech')
  dropped.sections[0].items = dropped.sections[0].items.filter((i) => i.id !== 'd-react')
  assert.throws(() => spec.writeDoc(dropped), { code: 'superseded', message: /d-react/ })

  const created = spec.writeDoc({ id: 'ideas/tech', title: 'Ötletek: Műszaki terv', lang: 'hu', prose: '', human: [], items: [], sections: [] })
  assert.equal(created.file, 'docs/product/spec/ideas/TECH.md')
  assert.equal(fs.readFileSync(path.join(root, created.file), 'utf8'), '# Ötletek: Műszaki terv\n\n_Műszaki terv_\n')
})

test('a broken document is read with its problems; the store writes only under docs/product/spec/', () => {
  const { root, spec } = seeded()
  put(root, 'docs/product/spec/core/TECH.md', CORE_TECH + '\nEgy szabad bekezdés.\n')
  const doc = spec.doc('core/tech')
  assert.deepEqual(doc.problems.map((p) => p.why), ['stray'])
  assert.deepEqual(spec.check().problems.map((p) => [p.file, p.line, p.why]), [['docs/product/spec/core/TECH.md', 12, 'stray']])
  assert.throws(() => spec.writeDoc({ ...doc, file: 'docs/product/ideas/x.md' }), /spec/)
})
