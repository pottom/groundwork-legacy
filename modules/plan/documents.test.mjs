// Tests of the document panel's model through its interface: listDocs and buildPrd. The files are
// the Spec's own Markdown (the record store writes them); the panel computes what is not in them.
// Run: node --test modules/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrd, listDocs, docOf, progressSummary } from './documents.mjs'

// A map of a Spec, in the shape spec-map.mjs gives: the system document and a part with a PRD.
const SHOP = {
  nodeData: {
    id: 'root', topic: 'Shop', metadata: { spec: true, lang: 'en' }, children: [
      { id: 'system', topic: 'Shop', metadata: { doc: 'system', file: 'SYSTEM.md' }, children: [] },
      { id: 'app', topic: 'App', metadata: { component: 'software', dir: 'app' }, children: [
        { id: 'app/prd', topic: 'App: Product', metadata: { doc: 'prd', file: 'PRD.md' }, children: [
          { id: 't-goal', topic: 'Goal', metadata: { prose: 'Sell things.', progress: 'done' }, children: [
            { id: 'd-cart', topic: 'Cart', metadata: { status: 'decision', impl: 'done' } },
            { id: 'x-cash', topic: 'Cash', note: 'No shop', metadata: { status: 'excluded' } },
            { id: 'p-gift', topic: 'Gift cards', metadata: { status: 'parked' } },
          ] },
          { id: 't-users', topic: 'Users', metadata: {} },
        ] },
      ] },
    ],
  },
}

test('the documents of a Spec map are its files under docs/product/spec/', () => {
  assert.deepEqual(listDocs(SHOP).map((d) => [d.id, d.file, d.component?.id ?? null]), [
    ['system', 'spec/SYSTEM.md', null],
    ['app/prd', 'spec/app/PRD.md', 'app'],
  ])
  assert.equal(docOf(SHOP, 'd-cart'), 'app/prd')
})

test('the panel shows a Spec document under its own title, with what is computed from it', () => {
  const prd = buildPrd(SHOP, 'app/prd')
  assert.equal(prd.title, 'App: Product')
  assert.deepEqual(prd.sections.map((s) => [s.id, s.progress]), [['t-goal', 'done'], ['t-users', 'untouched']])
  assert.deepEqual(prd.nonGoals.map((r) => r.id), ['x-cash'])
  assert.deepEqual(prd.later.map((r) => r.id), ['p-gift'])
  assert.deepEqual(prd.open.map((r) => r.id), ['t-users'])
  assert.equal(prd.cross.nonGoals, 'Non-goals', 'in the document language')
  assert.deepEqual(progressSummary(prd).impl, { done: 1, partial: 0, missing: 0 })
})

test('an old map (mindmap.json) keeps its own document titles and files', () => {
  const data = { nodeData: { id: 'root', topic: 'Shop', children: [
    { id: 'c', topic: 'App', metadata: { component: 'software' }, children: [{ id: 'd', topic: 'Product', metadata: { doc: 'prd' }, children: [] }] },
  ] } }
  assert.deepEqual(listDocs(data).map((d) => d.file), ['app/PRD.md'])
  assert.equal(buildPrd(data, 'd').title, 'Shop — App: Product')
})
