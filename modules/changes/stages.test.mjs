// The stage of a change, and the row the list shows for it (stages.mjs).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, openQuestions, stageOf, changeRow } from './stages.mjs'

test('the open questions are the list items under Kérdések; a checked one is answered', () => {
  assert.equal(openQuestions(''), 0)
  assert.equal(openQuestions(undefined), 0)
  assert.equal(openQuestions('- Kell-e git?\n- Mi legyen a neve?'), 2)
  assert.equal(openQuestions('* One\n1. Two\n2) Three'), 3)
  assert.equal(openQuestions('- [ ] Open\n- [x] Answered\n- [X] Also answered'), 1)
  assert.equal(openQuestions('- A question\n  with a second line\n  - and a sub-point'), 1, 'only the top level counts')
  assert.equal(openQuestions('Nincs nyitott kérdés.'), 0, 'prose is no question')
})

test('the two interview stages are computed: open questions → Grilling, none → Awaiting approval', () => {
  assert.equal(stageOf('grilling', 0), 'awaiting-approval')
  assert.equal(stageOf('awaiting-approval', 2), 'grilling')
  assert.equal(stageOf('grilling', 1), 'grilling')
  assert.equal(stageOf(undefined, 0), 'awaiting-approval')
})

test('the later stages still come from the status field', () => {
  for (const s of ['implementing', 'done', 'dropped']) {
    assert.equal(stageOf(s, 0), s)
    assert.equal(stageOf(s, 3), s)
  }
  assert.deepEqual(STAGES, ['grilling', 'awaiting-approval', 'implementing', 'done', 'dropped'])
})

test('a row: id, title, stage, the counts, and the ideas and milestone as links', () => {
  const shown = {
    id: 'C-7', n: 7, type: 'C', file: 'docs/product/changes/C-007-x.md',
    fields: { title: 'Record store', ideas: ['I-5', 'I-9'], milestone: 'M-9', status: 'grilling' },
    body: '## Kérdések\n\n- Open?\n\n## Javasolt elemek\n\n- add `d-a` → `system#t-x` — A\n- add `d-b` → `system#t-x` — B\n',
    links: [
      { field: 'ideas', id: 'I-5', type: 'I', name: 'idea', module: 'ideas', title: 'Redesign', file: 'x' },
      { field: 'ideas', id: 'I-9', type: 'I', name: 'idea', module: 'ideas' },
      { field: 'milestone', id: 'M-9', type: 'M', name: 'milestone', module: 'core', title: 'Újratervezés' },
    ],
  }
  assert.deepEqual(changeRow(shown), {
    id: 'C-7', n: 7, title: 'Record store', status: 'grilling', stage: 'grilling', questions: 1, items: 2, merged: false,
    ideas: [
      { id: 'I-5', name: 'idea', module: 'ideas', title: 'Redesign' },
      { id: 'I-9', name: 'idea', module: 'ideas' },
    ],
    milestone: { id: 'M-9', name: 'milestone', module: 'core', title: 'Újratervezés' },
  })
})

test('a row of a change without ideas and milestone, and links to undeclared types as plain ids', () => {
  const row = changeRow({ id: 'C-1', n: 1, fields: { title: 'Start', status: 'done' }, body: '', links: [{ field: 'ideas', id: 'I-1' }] })
  assert.deepEqual([row.stage, row.questions, row.items, row.ideas, row.milestone], ['done', 0, 0, [{ id: 'I-1' }], null])
  assert.equal(changeRow({ id: 'C-1', n: 1, fields: { title: 'Start', status: 'done' }, body: '', links: [] }, { merged: true }).merged, true, 'merged is the core\'s answer, passed in')
})

test('the open questions of a change with a map are its ? nodes, at any depth; the stage follows them', () => {
  const row = (body, status = 'grilling') => changeRow({ id: 'C-4', n: 4, fields: { title: 'Map', status }, body, links: [] })
  const map = '## Gondolatok\n\n- ? Where?\n  - ~! Here\n  - ~ There\n- = Settled\n  - ? Which name?\n'
  assert.deepEqual([row(map).questions, row(map).stage], [2, 'grilling'])
  const answered = '## Gondolatok\n\n- = Here\n  - x There\n- = Settled\n'
  assert.deepEqual([row(answered).questions, row(answered).stage], [0, 'awaiting-approval'])
  assert.deepEqual([row('## Kérdések\n\n- Old?\n- [x] Done\n').questions, row('## Kérdések\n\n- Old?\n').stage], [1, 'grilling'], 'an old change computes as before')
  assert.equal(row(map + '\n## Kérdések\n\n- Old?\n').questions, 3, 'both count while an old list is left')
})
