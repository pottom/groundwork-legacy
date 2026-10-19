// The ideas on disk: one Markdown file per idea under docs/product/ideas/items/, numbered.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { moduleFiles } from '../../core/files.mjs'
import ideasModule from './module.mjs'
import { openIdeas } from './store.mjs'

const ITEMS = 'docs/product/ideas/items'
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-'))
const open = (root) => openIdeas(root, moduleFiles(root, ideasModule))
const itemFiles = (root) => fs.readdirSync(path.join(root, ITEMS)).sort()

test('an added idea becomes I-001-<slug>.md with its fields in the front matter and the body below', () => {
  const root = project()
  const idea = open(root).add({ title: 'Gyors tabváltás!', body: 'Ctrl+1..9 switches tabs.', author: 'claude', source: 'grilling 2026-10-19', kind: 'product' })
  assert.equal(idea.id, 'I-1')
  assert.deepEqual(itemFiles(root), ['I-001-gyors-tabvaltas.md'])
  const text = fs.readFileSync(path.join(root, ITEMS, 'I-001-gyors-tabvaltas.md'), 'utf8')
  assert.match(text, /^---\n/)
  assert.match(text, /\ntitle: Gyors tabváltás!\n/)
  assert.match(text, /\nauthor: claude\n/)
  assert.match(text, /\nstatus: new\n/)
  assert.match(text, /\n---\n\nCtrl\+1\.\.9 switches tabs\.\n$/)
})

test('the list reads every idea back with its fields, in number order', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'First', author: 'human' })
  store.add({ title: 'Second: with a colon', body: 'Why.', author: 'claude', source: 'chat', kind: 'engineering' })
  const list = open(root).list()
  assert.deepEqual(list.map((i) => [i.id, i.n, i.title, i.author, i.status]), [
    ['I-1', 1, 'First', 'human', 'new'],
    ['I-2', 2, 'Second: with a colon', 'claude', 'new'],
  ])
  assert.equal(list[1].source, 'chat')
  assert.equal(list[1].kind, 'engineering')
  assert.equal(list[1].body, 'Why.')
  assert.equal(list[1].file, `${ITEMS}/I-002-second-with-a-colon.md`)
})

test('the next number is one above the highest ever used, so a gap is never filled again', () => {
  const root = project()
  fs.mkdirSync(path.join(root, ITEMS), { recursive: true })
  fs.writeFileSync(path.join(root, ITEMS, 'I-007-old.md'), '---\ntitle: Old\nstatus: rejected\n---\n')
  const idea = open(root).add({ title: 'Newer' })
  assert.equal(idea.id, 'I-8')
  assert.ok(itemFiles(root).includes('I-008-newer.md'))
})

test('an idea needs a title, and author, kind and status take only their known values', () => {
  const store = open(project())
  assert.throws(() => store.add({ title: '  ' }), /title/)
  assert.throws(() => store.add({ title: 'X', author: 'robot' }), /author/)
  assert.throws(() => store.add({ title: 'X', kind: 'other' }), /kind/)
})

test('without an ideas folder the list is empty', () => {
  assert.deepEqual(open(project()).list(), [])
})
