// The core's own record types, Change (C-n) and Milestone (M-n): their Markdown, read and written
// back byte for byte, and the change's body, which reads on its own as a spec (changes.mjs).
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readRecord, writeRecord } from './format.mjs'
import { openRecords } from './store.mjs'
import { MILESTONE_TYPE, CORE_RECORDS, changeBody, readChange } from './changes.mjs'
import ideasModule from '../../modules/ideas/module.mjs'
import changesModule from '../../modules/changes/module.mjs'
import { CHANGE_TYPE } from '../../modules/changes/type.mjs'

const C7 = {
  problem: 'Ideas have nowhere to go before they fit the structure.',
  solution: 'A change carries an idea until its items are approved into the Spec.',
  scope: 'The record store and the Markdown source.',
  outOfScope: 'The Changes workspace.',
  questions: 'How large may a change grow?',
  items: [
    { op: 'add', id: 'd-rec-change', target: 'records/tech#t-rec-data', text: 'Change (C-n) is a record' },
    { op: 'change', id: 'd-core-role', target: 'core/tech#t-arch' },
    { op: 'supersede', id: 'd-plan-map', target: 'plan/prd#f-map', text: 'The map belongs to a change' },
  ],
}

test('a change body is the spec: problem, solution, scope, out of scope, thoughts, an old questions list, proposed items, and the tickets rule', () => {
  assert.equal(changeBody(C7, 'C-7'), [
    '## Probléma', '', C7.problem, '',
    '## Megoldás', '', C7.solution, '',
    '## Keret', '', C7.scope, '',
    '## Kihagyjuk', '', C7.outOfScope, '',
    '## Gondolatok', '',
    '## Kérdések', '', C7.questions, '',
    '## Javasolt elemek', '',
    '- add `d-rec-change` → `records/tech#t-rec-data` — Change (C-n) is a record',
    '- change `d-core-role` → `core/tech#t-arch`',
    '- supersede `d-plan-map` → `plan/prd#f-map` — The map belongs to a change', '',
    '## Jegyek', '', 'A jegyek a `**Change:** C-7` sorukkal hivatkoznak erre a változásra.',
  ].join('\n'))
})

test('the change body reads back: its sections and the proposed items (op, id, target)', () => {
  const read = readChange(changeBody(C7, 'C-7'))
  assert.deepEqual(read.items, C7.items)
  assert.deepEqual(
    [read.problem, read.solution, read.scope, read.outOfScope, read.questions],
    [C7.problem, C7.solution, C7.scope, C7.outOfScope, C7.questions],
  )
  assert.equal(read.tickets, 'C-7')
})

test("a proposed item's note is the lines indented under it, blank lines inside included", () => {
  const items = [
    { op: 'add', id: 't-x', target: 'core/tech', text: 'A section', note: 'Its prose.\n\nMore of it.' },
    { op: 'add', id: 'd-x', target: 'core/tech#t-x', text: 'A decision · decision · missing', note: 'Why.\n<core/x.mjs>' },
    { op: 'add', id: 'd-y', target: 'core/tech#t-x' },
  ]
  const body = changeBody({ items }, 'C-2')
  assert.match(body, /— A section\n {2}Its prose\.\n\n {2}More of it\.\n- add `d-x`/)
  assert.deepEqual(readChange(body).items, items)
})

test('a hand-written change body is read patiently: English headings, -> arrows, no backticks, other lines ignored', () => {
  const body = [
    '## Problem', '', 'Too big.', '',
    '## Proposed items', '',
    'Some words about the items.',
    '- add d-x → core/tech#t-a — New thing',
    '* supersede `d-y` -> `core/tech` – Old thing',
    '- rename d-z → somewhere',
    '- add',
    '',
    '## Tickets', '', 'Tickets point here with **Change:** C-12.',
  ].join('\n')
  const read = readChange(body)
  assert.equal(read.problem, 'Too big.')
  assert.deepEqual(read.items, [
    { op: 'add', id: 'd-x', target: 'core/tech#t-a', text: 'New thing' },
    { op: 'supersede', id: 'd-y', target: 'core/tech', text: 'Old thing' },
  ])
  assert.equal(read.tickets, 'C-12')
  assert.deepEqual(readChange('').items, [])
})

test('a new change starts as the spec skeleton with its own tickets rule', () => {
  const body = CHANGE_TYPE.template?.('C-3') ?? ''
  for (const h of ['Probléma', 'Megoldás', 'Keret', 'Kihagyjuk', 'Gondolatok', 'Javasolt elemek', 'Jegyek']) assert.match(body, new RegExp(`^## ${h}$`, 'm'))
  assert.match(body, /`\*\*Change:\*\* C-3`/)
  assert.equal(readChange(body).tickets, 'C-3')
})

// Round trip on generated records: read(write(x)) = x and write(read(write(x))) = write(x), byte for byte.
function rng(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const PIECES = ['a', 'Z', ' ', ': ', '"', '#', '-', ',', '\n', 'ő', '✓', '`', '→', '->', '## Javasolt elemek', '## Történet', '- add `d-x` → `t-y`', '**Change:** C-1', '---']
function gen(next, type) {
  const str = (max) => Array.from({ length: Math.floor(next() * max) }, () => PIECES[Math.floor(next() * PIECES.length)]).join('')
  const fields = {}
  for (const k of type.fields) {
    if (next() > 0.8) continue
    if (k === 'ideas') fields.ideas = Array.from({ length: 1 + Math.floor(next() * 3) }, () => `I-${1 + Math.floor(next() * 50)}`)
    else { const v = str(8); if (v !== '') fields[k] = v }
  }
  const id = `${type.prefix}-${1 + Math.floor(next() * 999)}`
  const body = next() < 0.5 ? changeBody({ problem: str(10), solution: str(10), items: [{ op: 'add', id: 'd-a', target: 't-b', text: str(5).replace(/\s+/g, ' ').trim() }] }, id).trim() : str(40).trim()
  const history = Array.from({ length: Math.floor(next() * 4) }, () => `2026-10-${10 + Math.floor(next() * 20)} · human · ${str(6).replace(/\s+/g, ' ').trim() || 'created'}`)
  return { id, fields, body, history }
}

test('change and milestone records round-trip byte for byte, like ideas', () => {
  for (const type of [CHANGE_TYPE, MILESTONE_TYPE]) {
    const next = rng(49)
    for (let i = 0; i < 300; i++) {
      const x = gen(next, type)
      const text = writeRecord(x, type)
      assert.deepEqual(readRecord(text, type), x, text)
      assert.equal(writeRecord(readRecord(text, type), type), text)
    }
  }
})

test('a change\'s header names its ideas, its milestone and its state; a milestone is a header and a description', () => {
  const text = writeRecord({ id: 'C-7', fields: { title: 'Record store', ideas: ['I-5'], milestone: 'M-9', status: 'grilling' }, body: changeBody(C7, 'C-7'), history: ['2026-10-20 · claude · created'] }, CHANGE_TYPE)
  assert.match(text, /^---\nid: C-7\ntitle: Record store\nideas: I-5\nmilestone: M-9\nstatus: grilling\n---\n\n## Probléma\n/)
  assert.match(text, /\n## Jegyek\n\nA jegyek a `\*\*Change:\*\* C-7` sorukkal hivatkoznak erre a változásra\.\n\n## Történet\n\n- 2026-10-20 · claude · created\n$/)
  const m = writeRecord({ id: 'M-9', fields: { title: 'Redesign', status: 'in-progress' }, body: 'The record model and the conveyor.', history: [] }, MILESTONE_TYPE)
  assert.equal(m, '---\nid: M-9\ntitle: Redesign\nstatus: in-progress\n---\n\nThe record model and the conveyor.\n\n## Történet\n')
})

// On the store, beside the Ideas module: links written once, the other way computed.
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-changes-'))
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8')
const open = (root, modules = [ideasModule, changesModule, CORE_RECORDS]) => openRecords(root, modules, { today: () => '2026-10-20' })

function seed(root) {
  const store = open(root)
  store.create('I', { fields: { title: 'Record model' } }, { by: 'human' })
  store.create('M', { fields: { title: 'Redesign' } })
  store.create('C', { fields: { title: 'Record store', ideas: ['I-1'], milestone: 'M-1' } })
  store.create('C', { fields: { title: 'Changes workspace', ideas: ['I-1'] } })
  return store
}

test('a new change gets the next number, its own file under changes/, and the spec skeleton', () => {
  const root = project()
  const store = seed(root)
  const c = store.get('C-2')
  assert.equal(c.file, 'docs/product/changes/C-002-changes-workspace.md')
  assert.equal(c.fields.status, 'grilling')
  assert.equal(readChange(c.body).tickets, 'C-2')
  assert.equal(store.get('M-1').file, 'docs/product/milestones/M-001-redesign.md')
  assert.throws(() => store.create('C', { fields: { title: 'X', milestone: 'I-1' } }), /milestone/)
  assert.throws(() => store.create('C', { fields: { title: 'X', ideas: ['t-pipe'] } }), /ideas/)
  assert.throws(() => store.update('C-1', { fields: { status: 'implementing' } }), (e) => e.code === 'forbidden', 'only the human approves')
  assert.equal(store.update('C-1', { fields: { status: 'awaiting-approval' } }).fields.status, 'awaiting-approval')
})

test('an idea\'s changes and a milestone\'s changes are computed by the index, never written to their files', () => {
  const root = project()
  const store = seed(root)
  const before = [read(root, store.get('I-1').file), read(root, store.get('M-1').file)]
  assert.deepEqual(store.show('I-1').linkedFrom, ['C-1', 'C-2'])
  assert.deepEqual(store.show('M-1').linkedFrom, ['C-1'])
  assert.deepEqual([read(root, store.get('I-1').file), read(root, store.get('M-1').file)], before)
  assert.doesNotMatch(before.join('\n'), /C-\d/)
})

test('a change shows its links resolved by the id\'s shape, and its proposed items', () => {
  const root = project()
  const store = seed(root)
  store.update('C-1', { body: changeBody(C7, 'C-1') })
  const c = store.show('C-1')
  assert.deepEqual(c.links, [
    { field: 'ideas', id: 'I-1', type: 'I', name: 'idea', module: 'ideas', title: 'Record model', file: 'docs/product/ideas/I-001-record-model.md' },
    { field: 'milestone', id: 'M-1', type: 'M', name: 'milestone', module: 'core', title: 'Redesign', file: 'docs/product/milestones/M-001-redesign.md' },
  ])
  assert.deepEqual(c.outline.items, C7.items)
  assert.equal(store.show('I-1').outline, undefined, 'only a type with an outline has one')
})

test('with the declaring module missing, links to its records show as plain ids and nothing breaks', () => {
  const root = project()
  seed(root)
  const store = open(root, [changesModule, CORE_RECORDS])
  assert.deepEqual(store.list().map((r) => r.id), ['C-1', 'C-2', 'M-1'])
  assert.deepEqual(store.show('C-1').links, [
    { field: 'ideas', id: 'I-1' },
    { field: 'milestone', id: 'M-1', type: 'M', name: 'milestone', module: 'core', title: 'Redesign', file: 'docs/product/milestones/M-001-redesign.md' },
  ])
  assert.equal(store.get('I-1'), null)
  assert.equal(store.update('C-1', { fields: { title: 'Record store, renamed', ideas: ['I-1', 'I-7'] } }).fields.title, 'Record store, renamed')
  assert.equal(store.create('C', { fields: { title: 'Another', ideas: ['I-1'] } }).id, 'C-3')
  // and the other way: without the Changes module an idea still shows; its changes are not known,
  // and a link to a change is a plain id
  const ideasOnly = open(root, [ideasModule, CORE_RECORDS])
  assert.deepEqual(ideasOnly.list().map((r) => r.id), ['I-1', 'M-1'])
  assert.deepEqual(ideasOnly.show('I-1').linkedFrom, [])
  assert.equal(ideasOnly.show('I-1').fields.title, 'Record model')
  ideasOnly.update('I-1', { fields: { links: ['C-1'] } }, { by: 'human' })
  assert.deepEqual(ideasOnly.show('I-1').links, [{ field: 'links', id: 'C-1' }])
})

// The thought map (C-4): the Thoughts section, a nested list with a sign per node (d-map-in-md, d-map-signs).
const MAP = [
  '- A change carries its own map',
  '- ? Where does the map live?',
  '  The note of the question.',
  '',
  '  Its second paragraph.',
  '  - ~! In the change\'s Markdown',
  '  - ~ In a file of its own',
  '- = The root is the change\'s title → `d-map-root`',
  '  - ! One name per change',
  '  - x A root stored apart',
].join('\n')
const TREE = [
  { kind: 'thought', text: 'A change carries its own map', children: [] },
  { kind: 'question', text: 'Where does the map live?', note: 'The note of the question.\n\nIts second paragraph.', children: [
    { kind: 'option', recommended: true, text: 'In the change\'s Markdown', children: [] },
    { kind: 'option', text: 'In a file of its own', children: [] },
  ] },
  { kind: 'decision', text: 'The root is the change\'s title', item: 'd-map-root', children: [
    { kind: 'constraint', text: 'One name per change', children: [] },
    { kind: 'excluded', text: 'A root stored apart', children: [] },
  ] },
]

test('the Thoughts section reads into a tree: kinds by sign, notes, item links; and writes back unchanged', () => {
  for (const heading of ['Gondolatok', 'Thoughts']) {
    const body = `## Probléma\n\nP.\n\n## ${heading}\n\n${MAP}\n\n## Javasolt elemek\n\n- add \`d-map-root\` → \`core/tech\` — Root`
    assert.deepEqual(readChange(body).thoughts, TREE, heading)
  }
  const body = changeBody({ problem: 'P.', thoughts: TREE, items: [{ op: 'add', id: 'd-map-root', target: 'core/tech' }] }, 'C-4')
  assert.match(body, new RegExp(`## Kihagyjuk\n\n## Gondolatok\n\n${MAP.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n\n## Javasolt elemek`))
  assert.deepEqual(readChange(body).thoughts, TREE)
  assert.equal(changeBody(readChange(body), 'C-4'), body, 'byte for byte')
})

test('the thought map is read patiently: * bullets, four-space indents, -> and bare ids; an unknown sign stays a thought', () => {
  const read = readChange('## Thoughts\n\n* ? Open\n    * ~! Yes -> d-x\n- ?! Odd one\nProse is no node.')
  assert.deepEqual(read.thoughts, [
    { kind: 'question', text: 'Open', children: [{ kind: 'option', recommended: true, text: 'Yes', item: 'd-x', children: [] }] },
    { kind: 'thought', text: '?! Odd one', children: [] },
  ])
  assert.equal(readChange('## Problem\n\nNo map.').thoughts, undefined)
})

test('a new change has a Thoughts section and no Questions list any more', () => {
  const body = CHANGE_TYPE.template?.('C-3') ?? ''
  assert.match(body, /^## Gondolatok$/m)
  assert.doesNotMatch(body, /^## Kérdések$/m)
  assert.match(changeBody({ questions: '- Old one?' }, 'C-3'), /^## Kérdések\n\n- Old one\?$/m, 'an old list is still written back')
})
