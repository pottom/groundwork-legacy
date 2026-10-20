// The ideas on disk: one Markdown file per idea under docs/product/ideas/, numbered, kept by the
// core's record store (core/records/store.mjs) as the record type I.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from '../../core/records/store.mjs'
import ideasModule from './module.mjs'
import { openIdeas } from './store.mjs'

const ITEMS = 'docs/product/ideas'
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-'))
const open = (root) => openIdeas(openRecords(root, [ideasModule]))
const itemFiles = (root) => fs.readdirSync(path.join(root, ITEMS)).filter((f) => /^I-\d+/.test(f)).sort()
const HUMAN = { by: 'human' }

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
  assert.match(text, /^---\nid: I-1\n/)
  assert.match(text, /\n---\n\nCtrl\+1\.\.9 switches tabs\.\n\n## Történet\n\n- \d{4}-\d\d-\d\d · claude · created\n$/)
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

test('an idea\'s fields can be changed; they are saved in its file and read back', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'Quick tabs', body: 'Ctrl+1.', author: 'claude', source: 'chat' })
  const saved = store.update('I-1', {
    title: 'Quick tab switching', body: 'Ctrl+1..9 switches tabs.', source: 'review', kind: 'engineering',
    impact: 'high', effort: 'low', links: ['#42', 'n-12'], status: 'considering',
  })
  assert.equal(saved.title, 'Quick tab switching')
  const [idea] = open(root).list()
  assert.deepEqual(
    { title: idea.title, body: idea.body, source: idea.source, kind: idea.kind, impact: idea.impact, effort: idea.effort, links: idea.links, status: idea.status, author: idea.author },
    { title: 'Quick tab switching', body: 'Ctrl+1..9 switches tabs.', source: 'review', kind: 'engineering', impact: 'high', effort: 'low', links: ['#42', 'n-12'], status: 'considering', author: 'claude' })
  assert.deepEqual(itemFiles(root), ['I-001-quick-tabs.md'], 'the file keeps its name, so its number and links stay')
})

test('a change takes only known values, and rejecting needs a reason, which is kept with the idea', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'Dark mode toggle' })
  for (const bad of [{ status: 'done' }, { kind: 'other' }, { impact: 'huge' }, { effort: 'tiny' }, { title: ' ' }, { status: 'rejected' }, { status: 'rejected', reason: '  ' }]) {
    assert.throws(() => store.update('I-1', bad, HUMAN), Error, JSON.stringify(bad))
  }
  assert.equal(open(root).list()[0].status, 'new', 'a refused change writes nothing')
  store.update('I-1', { status: 'rejected', reason: 'The OS decides light or dark.' }, HUMAN)
  assert.deepEqual([open(root).list()[0].status, open(root).list()[0].reason], ['rejected', 'The OS decides light or dark.'])
  assert.match(fs.readFileSync(path.join(root, ITEMS, 'I-001-dark-mode-toggle.md'), 'utf8'), /\nreason: The OS decides light or dark\.\n/)
  store.update('I-1', { status: 'considering' }, HUMAN)
  assert.equal(open(root).list()[0].reason, undefined, 'taken back from Rejected, the old reason goes')
  assert.throws(() => store.update('I-9', { title: 'X' }), /I-9/)
})

test('a change made on an older version of the file is refused, so a newer edit is not lost', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'Seen in the browser' })
  const seen = store.list()[0].version
  assert.ok(seen)
  store.update('I-1', { source: 'Claude, meanwhile' })   // someone else saves first
  assert.throws(() => store.update('I-1', { title: 'From the browser' }, { base: seen }), (e) => e.code === 'stale')
  assert.equal(store.list()[0].title, 'Seen in the browser')
  const now = store.list()[0].version
  assert.equal(store.update('I-1', { title: 'From the browser' }, { base: now }).title, 'From the browser')
})

test('ideas live in docs/product/ideas/ beside the generated documents, which are not ideas', () => {
  const root = project()
  fs.mkdirSync(path.join(root, ITEMS), { recursive: true })
  fs.writeFileSync(path.join(root, ITEMS, 'PRD.md'), '<!-- generated by Groundwork Plan -->\n\n# Ideas\n')
  fs.writeFileSync(path.join(root, ITEMS, 'TECH.md'), '# Tech\n')
  const store = open(root)
  store.add({ title: 'One' })
  assert.deepEqual(store.list().map((i) => i.id), ['I-1'])
  assert.equal(fs.readFileSync(path.join(root, ITEMS, 'PRD.md'), 'utf8'), '<!-- generated by Groundwork Plan -->\n\n# Ideas\n')
})

test('the states: new, considering, accepted, rejected, snoozed until a date, duplicate of another idea', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'Original' })
  store.add({ title: 'Copy' })
  assert.equal(store.update('I-2', { status: 'accepted' }, HUMAN).status, 'accepted')
  assert.throws(() => store.update('I-2', { status: 'snoozed' }, HUMAN), /until/)
  assert.throws(() => store.update('I-2', { status: 'snoozed', until: 'soon' }, HUMAN), /until/)
  assert.equal(store.update('I-2', { status: 'snoozed', until: '2027-01-01' }, HUMAN).until, '2027-01-01')
  assert.throws(() => store.update('I-2', { status: 'duplicate' }, HUMAN), /duplicate/)
  assert.throws(() => store.update('I-2', { status: 'duplicate', duplicate: 'I-9' }, HUMAN), /I-9/)
  assert.throws(() => store.update('I-2', { status: 'duplicate', duplicate: 'I-2' }, HUMAN), /itself/)
  const dup = store.update('I-2', { status: 'duplicate', duplicate: 'I-1' }, HUMAN)
  assert.deepEqual([dup.status, dup.duplicate, dup.until], ['duplicate', 'I-1', undefined], 'leaving Snoozed drops its date')
  assert.match(fs.readFileSync(path.join(root, dup.file), 'utf8'), /\nstatus: duplicate\nduplicate: I-1\n/)
  assert.equal(store.update('I-2', { status: 'new' }, HUMAN).duplicate, undefined)
})

test('Claude (the default) moves an idea only between New and Considering: the store refuses the rest', () => {
  const store = open(project())
  store.add({ title: 'X' })
  assert.equal(store.update('I-1', { status: 'considering' }).status, 'considering')
  for (const status of ['accepted', 'rejected', 'snoozed', 'duplicate']) {
    assert.throws(() => store.update('I-1', { status, reason: 'r', until: '2027-01-01', duplicate: 'I-1' }), (e) => e.code === 'forbidden', status)
  }
  store.update('I-1', { status: 'accepted' }, HUMAN)
  assert.throws(() => store.update('I-1', { status: 'new' }), (e) => e.code === 'forbidden')
})

test('each move and link change is a line in the idea\'s history, kept through every edit', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'X' }, HUMAN)
  store.add({ title: 'Y' })
  store.update('I-1', { status: 'considering' })
  store.update('I-1', { links: ['I-2'] })
  store.update('I-1', { body: 'More words.', title: 'X, better' })
  const [idea] = open(root).list()
  assert.deepEqual(idea.history.map((h) => h.replace(/^\S+ · /, '')), ['human · created', 'claude · status: new → considering', 'claude · links: + I-2'])
  assert.equal(idea.body, 'More words.')
})

test('a record read and written again is the same file, byte for byte, for ideas of every shape', () => {
  const root = project()
  const store = open(root)
  store.add({ title: 'Plain' })
  store.add({ title: 'Quoted: "yes"', body: '# Heading\n\n- a\n- b\n\n## Történet\n\nnot the history', author: 'claude', source: 'review of #24', kind: 'engineering', impact: 'high', effort: 'low', rationale: 'a, b: c', links: ['I-1'] })
  store.update('I-2', { status: 'rejected', reason: 'Because: reasons' }, HUMAN)
  for (const idea of store.list()) {
    const text = fs.readFileSync(path.join(root, idea.file), 'utf8')
    store.update(idea.id, {}, HUMAN)
    assert.equal(fs.readFileSync(path.join(root, idea.file), 'utf8'), text, idea.id)
  }
})

test('each change that names an idea comes with what became of it, computed on each read: its stage, merged, its items in the Spec', async () => {
  const { default: changesModule } = await import('../changes/module.mjs')
  const root = project()
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text) }
  put('docs/product/spec/SYSTEM.md', '# Groundwork\n\n_Rendszer-áttekintés_\n\n## Cél {#t-goal}\n\n- Egy szerver · `d-one` · döntés · kész · C-1\n')
  const records = openRecords(root, [ideasModule, changesModule])
  const ideas = openIdeas(records)
  ideas.add({ title: 'Quick tabs' })
  // C-1 names the idea: one of its two items is in the Spec already; its map has an open question
  records.create('C', { fields: { title: 'Tabs', ideas: ['I-1'] }, body: [
    '## Gondolatok', '', '- ? Which keys?', '',
    '## Javasolt elemek', '',
    '- add `d-one` → `system#t-goal` — Egy szerver · döntés · kész',
    '- add `d-tabs` → `system#t-goal` — Tabs · döntés · hiányzik', '',
  ].join('\n') })
  records.update('C-1', { fields: { status: 'awaiting-approval' } }, HUMAN)
  const [idea] = ideas.list()
  assert.deepEqual(idea.changes, [{ id: 'C-1', title: 'Tabs', status: 'awaiting-approval', stage: 'grilling', merged: false, items: 2, inSpec: 1 }],
    'the stage the Changes page shows (an open question: Grilling), not the stored status')

  // answered, and without the item the Spec has already, it merges
  const body = records.get('C-1').body.replace('- ? Which keys?', '- = Ctrl+1..9').replace(/^- add `d-one`.*\n/m, '')
  records.update('C-1', { body }, HUMAN)
  assert.deepEqual(ideas.list()[0].changes.map((c) => [c.stage, c.merged, c.items, c.inSpec]), [['awaiting-approval', false, 1, 0]])
  records.merge('C-1', { by: 'human' })
  assert.deepEqual(ideas.list()[0].changes, [{ id: 'C-1', title: 'Tabs', status: 'implementing', stage: 'implementing', merged: true, items: 1, inSpec: 1 }])
  assert.deepEqual(ideas.update('I-1', { title: 'Quick tab switching' }, HUMAN).changes, ideas.list()[0].changes, 'a save answers the same')
})
