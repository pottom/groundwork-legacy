// What a module gets of the project's record store (project.mjs, store.mjs: forModule): it reads
// everything, and writes only the record types it declares, and the Spec only when its own folders
// cover it.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openProjectRecords } from './project.mjs'
import ideas from '../../modules/ideas/module.mjs'
import plan from '../../modules/plan/module.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-project-records-'))
const doc = { id: 'system', lang: 'en', title: 'System', prose: '', human: [], items: [], sections: [] }
const forbidden = (e) => e.code === 'forbidden'

test('Ideas writes its own ideas, and cannot write a change, a milestone or the Spec', () => {
  const root = project()
  const store = openProjectRecords(root)
  const change = store.create('C', { fields: { title: 'Record store' } })
  const own = store.forModule(ideas)
  const idea = own.create('I', { fields: { title: 'An idea', links: ['C-1'] } })
  own.update(idea.id, { fields: { title: 'Renamed' } })
  assert.throws(() => own.create('C', { fields: { title: 'Sneaky' } }), forbidden)
  assert.throws(() => own.create('M', { fields: { title: 'Sneaky' } }), forbidden)
  assert.throws(() => own.update(change.id, { fields: { title: 'Changed' } }), forbidden)
  assert.throws(() => own.spec.writeDoc(doc), forbidden)
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs/product')).sort(), ['changes', 'ideas'])
  assert.equal(store.get('C-1').fields.title, 'Record store')
  // Reads stay global.
  assert.deepEqual(own.list().map((r) => r.id), ['I-1', 'C-1'])
  assert.equal(own.show('I-1').links[0].title, 'Record store')
})

test('Plan, whose folders cover the Spec, writes it, and no record type', () => {
  const root = project()
  const own = openProjectRecords(root).forModule(plan)
  own.spec.writeDoc(doc)
  assert.equal(own.spec.doc('system').title, 'System')
  assert.throws(() => own.create('I', { fields: { title: 'An idea' } }), forbidden)
})
