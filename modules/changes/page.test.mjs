// The change page as the server gives it (page.mjs): every part of the file, rendered, and the marks
// of what changed since the version given as the base.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentOf, changePage, baseOf } from './page.mjs'
import { questionsOf } from './stages.mjs'

const CANONICAL = `## Probléma

No home for the interview.

## Megoldás

A **page** of its own.

## Keret

C-3 only.

## Kihagyjuk

The map (C-4).

## Kérdések

- Git or not?
- [x] Which module?
  It is \`modules/changes\`.

## Javasolt elemek

- add \`d-a\` → \`system#t-x\` — A page · döntés
  Why: [x](docs/x.md)
- change \`d-b\` → \`changes/prd#t-y\` — B

## Jegyek

A jegyek a \`**Change:** C-7\` sorukkal hivatkoznak erre a változásra.`

// the same change, written by hand: English headings, `->`, ids without backticks, CRLF
const PATIENT = `## Problem\r
\r
No home for the interview.\r
\r
## Solution\r
\r
A **page** of its own.\r
\r
## Scope\r
\r
C-3 only.\r
\r
## Out of scope\r
\r
The map (C-4).\r
\r
## Open questions\r
\r
* Git or not?\r
* [x] Which module?\r
  It is \`modules/changes\`.\r
\r
## Proposed items\r
\r
- add d-a -> system#t-x — A page · döntés\r
  Why: [x](docs/x.md)\r
- change d-b -> changes/prd#t-y — B\r
\r
## Tickets\r
\r
A jegyek a \`**Change:** C-7\` sorukkal hivatkoznak erre a változásra.\r
`

const shown = (over = {}) => ({
  id: 'C-7', n: 7, type: 'C', file: 'docs/product/changes/C-007-x.md', version: 'v',
  fields: { title: 'The change page', ideas: ['I-5'], milestone: 'M-9', status: 'grilling' },
  body: CANONICAL,
  history: ['2026-10-20 · human · created'],
  links: [
    { field: 'ideas', id: 'I-5', type: 'I', name: 'idea', module: 'ideas', title: 'Redesign' },
    { field: 'milestone', id: 'M-9', type: 'M', name: 'milestone', module: 'core', title: 'Újratervezés' },
  ],
  ...over,
})

test('the questions: top-level list items with their indented lines; a checked one is done; the rest is prose', () => {
  assert.deepEqual(questionsOf(''), { questions: [], text: '' })
  const { questions, text } = questionsOf('Ask these:\n\n- Git or not?\n- [x] Which  module?\n  It is a module.\n\n  Second paragraph.\n1. Numbered\nAfter.')
  assert.deepEqual(questions, [
    { key: 'git or not?', text: 'Git or not?', done: false },
    { key: 'which module? it is a module. second paragraph.', text: 'Which  module?\nIt is a module.\n\nSecond paragraph.', done: true },
    { key: 'numbered', text: 'Numbered', done: false },
  ])
  assert.equal(text, 'Ask these:\n\nAfter.')
})

test('a change written by hand in the patient form reads the same as its canonical form', () => {
  assert.deepEqual(contentOf({ fields: { title: 'X' }, body: PATIENT }), contentOf({ fields: { title: 'X' }, body: CANONICAL }))
  assert.deepEqual(changePage(shown({ body: PATIENT })), changePage(shown()), 'the whole page: parts, rendered Markdown, tickets rule')
  const c = contentOf({ fields: { title: 'X' }, body: CANONICAL })
  assert.deepEqual(Object.keys(c.sections), ['problem', 'solution', 'scope', 'outOfScope'])
  assert.deepEqual(c.items.map((i) => [i.op, i.id, i.target]), [['add', 'd-a', 'system#t-x'], ['change', 'd-b', 'changes/prd#t-y']])
})

test('the page: every part of the file, rendered, with the stage, the links, the tickets rule and the history', () => {
  const p = changePage(shown())
  assert.deepEqual([p.id, p.title, p.status, p.stage, p.questions, p.tickets], ['C-7', 'The change page', 'grilling', 'grilling', 1, 'C-7'])
  assert.deepEqual(p.ideas, [{ id: 'I-5', name: 'idea', module: 'ideas', title: 'Redesign' }])
  assert.deepEqual(p.milestone, { id: 'M-9', name: 'milestone', module: 'core', title: 'Újratervezés' })
  assert.deepEqual(p.history, ['2026-10-20 · human · created'])
  assert.equal(p.file, 'docs/product/changes/C-007-x.md')
  assert.match(p.html.sections.solution, /<strong>page<\/strong>/)
  assert.match(p.html.questions['which module? it is `modules/changes`.'], /<code>modules\/changes<\/code>/)
  assert.match(p.html.notes['d-a'], /href="docs\/x\.md"/)
  assert.equal(p.html.notes['d-b'], undefined, 'an item without a note has none')
  assert.equal(p.marks, null, 'without a base there are no marks')
  assert.equal(p.content.items[0].text, 'A page · döntés')
})

test('raw HTML in a change shows as text', () => {
  const p = changePage(shown({ body: '## Probléma\n\n<script>alert(1)</script>' }))
  assert.doesNotMatch(p.html.sections.problem, /<script>/)
})

test('the marks against a base: new, modified and removed, the removed parts rendered to show struck through', () => {
  const base = baseOf(`---\nid: C-7\ntitle: The change page\nstatus: grilling\n---\n\n${CANONICAL
    .replace('C-3 only.', 'C-3 and C-4.')
    .replace('- Git or not?', '- Git or not?\n- Dropped *question*?')
    .replace('- change `d-b`', '- add `d-old` → `system#t-x` — Old\n  Gone *now*.\n- change `d-b`')}\n\n## Történet\n\n- 2026-10-20 · human · created\n`)
  const p = changePage(shown({ body: CANONICAL.replace('No home for the interview.', 'No home.').replace('- change `d-b` → `changes/prd#t-y` — B', '- change `d-b` → `changes/prd#t-y` — B\n- add `d-new` → `system#t-x` — New') }), { base })
  assert.deepEqual(p.marks.sections, { problem: 'modified', scope: 'modified' })
  assert.deepEqual(p.marks.items, { 'd-new': 'new' })
  assert.deepEqual(p.marks.removed.items.map((i) => i.id), ['d-old'])
  assert.deepEqual(p.marks.removed.questions.map((q) => q.text), ['Dropped *question*?'])
  assert.match(p.html.notes['d-old'], /<em>now<\/em>/, 'a removed item\'s note is rendered too')
  assert.match(p.html.questions['dropped *question*?'], /<em>question<\/em>/)
})

test('a base that is no change file (or none) gives no marks', () => {
  assert.equal(baseOf(null), null)
  assert.equal(changePage(shown(), { base: null }).marks, null)
})

test('a change with a thought map: its nodes in the content, its open questions in the stage, the marks per node', () => {
  const body = '## Gondolatok\n\n- ? Where?\n  - ~! Here\n- = Settled\n'
  const shown = { id: 'C-4', n: 4, type: 'C', file: 'docs/product/changes/C-004-map.md', fields: { title: 'Map', status: 'grilling' }, body, history: [], links: [] }
  const page = changePage(shown, { base: contentOf({ fields: { title: 'Map' }, body: '## Gondolatok\n\n- ? Where?\n- ~ Gone\n' }) })
  assert.deepEqual(page.content.thoughts.map((t) => [t.key, t.kind, t.parent]), [['where?', 'question', null], ['here', 'option', 'where?'], ['settled', 'decision', null]])
  assert.deepEqual([page.stage, page.questions], ['grilling', 1])
  assert.deepEqual(page.marks?.thoughts, { here: 'new', settled: 'new' })
  assert.deepEqual(page.marks?.removed.thoughts.map((t) => t.key), ['gone'])
})

test('a moved item: its target at the base, to show struck through until the next commit; which rows move, and as what', () => {
  const body = CANONICAL.replace('- change `d-b`', '- add `t-sec` → `system` — Egy fejezet\n- change `d-b`')
  const base = baseOf(`---\nid: C-7\ntitle: The change page\nstatus: grilling\n---\n\n${body}\n`)
  const p = changePage(shown({ body: body.replace('`d-a` → `system#t-x`', '`d-a` → `core/tech#t-sec`') }), { base, targets: [{ target: 'core/tech', kind: 'document', title: 'Mag' }] })
  assert.deepEqual(p.moved, { 'd-a': 'system#t-x' })
  assert.deepEqual(p.movable, { 'd-a': 'item', 't-sec': 'section' }, 'a change is found by its id: it does not move')
  assert.deepEqual(p.targets, [{ target: 'core/tech', kind: 'document', title: 'Mag' }])
  assert.deepEqual(changePage(shown()).moved, {}, 'without a base nothing is moved')
})
