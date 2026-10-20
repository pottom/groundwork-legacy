import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { planMigration, applyMigration, checkRecords } from './migrate.mjs'
import { openRecords } from '../records/store.mjs'
import { CORE_RECORDS } from '../records/changes.mjs'
import { IDEA_TYPE } from '../../modules/ideas/store.mjs'
import { oldProject, snapshot, fixture } from './project.test-helper.mjs'

const IDEAS = { id: 'ideas', records: [IDEA_TYPE] }
const MODULES = [IDEAS]
const today = () => '2026-10-20'
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const exists = (root, rel) => fs.existsSync(path.join(root, rel))

test('the plan writes nothing, and proposes each milestone state from its implementation', () => {
  const root = oldProject()
  const before = snapshot(root, [])
  const plan = planMigration(root, { modules: MODULES, today })
  assert.deepEqual(snapshot(root, []), before)
  assert.deepEqual(plan.milestones.map((m) => [m.id, m.from, m.title, m.proposed]), [
    ['M-1', 'r-1', 'First release', 'done'],
    ['M-2', 'r-2', 'Payments', 'in-progress'],
    ['M-3', 'r-3', 'Reviews', 'planned'],
  ])
  assert.deepEqual(plan.changes.map((c) => [c.id, c.title, c.status]), [
    ['C-1', 'Initial state', 'done'],
    ['C-2', 'Open questions from the migration', 'grilling'],
  ])
})

test('migrate writes the Spec, C-1 merged, the open-questions change and the milestones; the records check clean', () => {
  const root = oldProject()
  const plan = planMigration(root, { modules: MODULES, today })
  applyMigration(plan, { states: 'proposed' })
  const store = openRecords(root, [...MODULES, CORE_RECORDS], { today })

  assert.deepEqual(store.spec.docs().map((d) => d.id), ['system', 'api-server/tech', 'web/prd', 'web/tech'])
  assert.deepEqual(store.spec.parts().parts.map((p) => p.slug), ['web', 'api-server'])

  const c1 = store.get('C-1')
  assert.equal(c1.file, 'docs/product/changes/C-001-initial-state.md')
  assert.deepEqual(c1.fields, { title: 'Initial state', status: 'done' })
  assert.match(c1.history.join('\n'), /^2026-10-20 · human · created by migrate from docs\/product\/mindmap\.json; status: done \(merged, 10 items\)$/)
  assert.match(c1.body, /`c-web` → `web`/)
  assert.match(c1.body, /`r-2` → M-2/)
  assert.match(c1.body, /`abc123` → I-2/)

  const c2 = store.show('C-2')
  assert.equal(c2.fields.status, 'grilling')
  assert.match(c2.outline.questions, /Do we need accounts\? · `q-1`/)
  assert.match(c2.outline.questions, /Ask the shop owners · `q-loose`/)

  assert.deepEqual(store.list('M').map((m) => [m.id, m.fields.title, m.fields.status]), [
    ['M-1', 'First release', 'done'], ['M-2', 'Payments', 'in-progress'], ['M-3', 'Reviews', 'planned'],
  ])
  assert.match(store.get('M-1').body, /The MVP\./)

  assert.deepEqual(checkRecords(store), { duplicates: [], problems: [], unknown: [] })
})

test("every node's note, link, human paragraph, section prose, progress and impl is in the written Spec", () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'proposed' })
  const { spec } = openRecords(root, [...MODULES, CORE_RECORDS], { today })
  const goal = spec.find('t-goal')
  assert.equal(goal.section.prose, 'Sell things online.\n\nTo anyone.')
  assert.deepEqual(goal.section.human, [{ id: 'hp-1', text: "The human's own words." }])
  assert.equal(goal.section.done, true)
  const d = spec.find('d-goal').item
  assert.deepEqual([d.status, d.impl, d.note, d.link, d.origin], ['decision', 'done', 'First line.\nSecond line.', 'core/shop.mjs', ['C-1']])
  assert.equal(spec.find('i-1').item.status, 'inferred')
  assert.match(read(root, 'docs/product/spec/SYSTEM.md'), /- Prices in euros · `i-1` · inferred · done · C-1/)
  assert.equal(spec.find('p-later').item.status, 'parked')
  assert.deepEqual(spec.doc('system').human, [{ id: 'hp-r', text: 'Roadmap words of the human.' }])
})

test('the ideas move to ideas/ with their numbers and history; to-develop becomes accepted', () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'proposed' })
  assert.ok(!exists(root, 'docs/product/ideas/items'))
  const store = openRecords(root, [...MODULES, CORE_RECORDS], { today })
  assert.deepEqual(store.list('I').map((r) => [r.id, r.file, r.fields.status]), [
    ['I-1', 'docs/product/ideas/I-001-wish-lists.md', 'considering'],
    ['I-2', 'docs/product/ideas/I-002-gift-cards.md', 'accepted'],
    ['I-4', 'docs/product/ideas/I-004-coupons.md', 'rejected'],
  ])
  assert.deepEqual(store.get('I-2').history, [
    '2026-10-02 · claude · created',
    '2026-10-03 · human · status: considering → to-develop',
    '2026-10-20 · human · status: to-develop → accepted',
  ])
  assert.equal(store.get('I-2').body, 'Sell gift cards.')
  assert.equal(store.get('I-4').fields.reason, 'not now')
  assert.equal(store.create('I', { fields: { title: 'Next' } }, { by: 'human' }).id, 'I-5')
})

test('the old generated documents and the map leave docs/product/; the human\'s own files stay', () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'proposed' })
  for (const f of ['docs/product/SYSTEM.md', 'docs/product/web/PRD.md', 'docs/product/web/TECH.md', 'docs/product/api-server', 'docs/product/mindmap.json']) assert.ok(!exists(root, f), `${f} is gone`)
  assert.equal(read(root, 'docs/product/web/NOTES.md'), '# Notes the human wrote\n')
  assert.equal(read(root, 'docs/product/research/flow.md'), '# Research\n')
  assert.equal(read(root, '.groundwork/migrate/mindmap.json'), fixture('small-map.json'))
})

test('it writes only under docs/product/ and .groundwork/', () => {
  const root = oldProject()
  const before = snapshot(root)
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'proposed' })
  assert.deepEqual(snapshot(root), before)
})

test('every milestone needs a state the human approved: by number, by old id, in order, or the proposal', () => {
  const root = oldProject()
  const plan = planMigration(root, { modules: MODULES, today })
  assert.throws(() => applyMigration(plan, {}), /M-1.*M-2.*M-3/s)
  assert.throws(() => applyMigration(plan, { states: 'M-1=done' }), /M-2/)
  assert.throws(() => applyMigration(plan, { states: 'M-1=finished,M-2=done,M-3=done' }), /finished/)
  assert.ok(!exists(root, 'docs/product/spec'), 'nothing written on a refusal')
  applyMigration(plan, { states: 'r-1=planned,M-2=done,proposed' })
  const store = openRecords(root, [...MODULES, CORE_RECORDS], { today })
  assert.deepEqual(store.list('M').map((m) => m.fields.status), ['planned', 'done', 'planned'])
})

test('states in order, one per milestone', () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'done,done,in-progress' })
  const store = openRecords(root, [...MODULES, CORE_RECORDS], { today })
  assert.deepEqual(store.list('M').map((m) => m.fields.status), ['done', 'done', 'in-progress'])
})

test('a second run is refused and changes nothing', () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: MODULES, today }), { states: 'proposed' })
  const before = snapshot(root, [])
  assert.throws(() => planMigration(root, { modules: MODULES, today }), (e) => e.code === 'migrated')
  assert.deepEqual(snapshot(root, []), before)
})

test('a project with a Spec already, or without a map, is refused', () => {
  const root = oldProject()
  fs.mkdirSync(path.join(root, 'docs/product/changes'), { recursive: true })
  fs.writeFileSync(path.join(root, 'docs/product/changes/C-001-x.md'), '---\nid: C-1\ntitle: X\nstatus: grilling\n---\n')
  assert.throws(() => planMigration(root, { modules: MODULES, today }), (e) => e.code === 'migrated')
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-migrate-'))
  assert.throws(() => planMigration(empty, { modules: MODULES, today }), (e) => e.code === 'no-map')
})

test("a map shaped like Groundwork's own migrates, and its records check clean", () => {
  const root = oldProject('groundwork-map.json')
  const plan = planMigration(root, { modules: MODULES, today })
  assert.equal(plan.milestones.length, 9)
  assert.deepEqual(plan.changes.map((c) => c.id), ['C-1'])
  applyMigration(plan, { states: 'proposed' })
  const store = openRecords(root, [...MODULES, CORE_RECORDS], { today })
  assert.equal(store.spec.docs().length, 15)
  assert.deepEqual(checkRecords(store), { duplicates: [], problems: [], unknown: [] })
  assert.equal(store.list('M')[8].fields.title, 'Újratervezés: rekordmodell és futószalag (I-5)')
  assert.equal(store.get('C-1').fields.title, 'Kiinduló állapot')
})
