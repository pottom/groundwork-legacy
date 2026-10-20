import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'
import { planMigration, applyMigration } from '../migrate/migrate.mjs'
import { oldProject } from '../migrate/project.test-helper.mjs'

const today = () => '2026-10-20'
const migrated = () => {
  const root = oldProject()
  applyMigration(planMigration(root, { modules: [CORE_RECORDS], today }), { states: 'proposed' })
  return root
}
const open = (root) => openRecords(root, [CORE_RECORDS], { today })

test("an old map id resolves through a merged change's list of what the ids became", () => {
  const store = open(migrated())
  const part = store.resolve('c-web')
  assert.equal(part.kind, 'alias')
  assert.deepEqual([part.to, part.change], ['web', 'C-1'])
  assert.equal(part.target.kind, 'spec')
  assert.equal(part.target.found.kind, 'part')
  const doc = store.resolve('doc-web-prd')
  assert.equal(doc.target.found.kind, 'document')
  assert.equal(doc.target.found.id, 'web/prd')
  const ms = store.resolve('r-2')
  assert.deepEqual([ms.to, ms.target.kind, ms.target.record.id], ['M-2', 'record', 'M-2'])
})

test('a Spec id or a record id resolves as itself; an unknown id is null', () => {
  const store = open(migrated())
  assert.equal(store.resolve('d-goal').kind, 'spec')
  assert.equal(store.resolve('M-1').kind, 'record')
  assert.equal(store.resolve('nope-1'), null)
})

test('only a merged change names old ids: a change being grilled does not', () => {
  const root = migrated()
  fs.writeFileSync(path.join(root, 'docs/product/changes/C-009-x.md'),
    '---\nid: C-9\ntitle: X\nstatus: grilling\n---\n\n## Keret\n\n- `old-thing` → `web` (rész)\n\n## Történet\n')
  const store = open(root)
  assert.equal(store.resolve('old-thing'), null)
})
