// What changed between two versions of a change (compare.mjs): per part, per question, per proposed item.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareChanges, NO_CHANGES } from './compare.mjs'

const content = (over = {}) => ({
  title: 'The change page',
  sections: { problem: 'No home.', solution: 'A page.' },
  questions: [{ key: 'git or not?', text: 'Git or not?', done: false }],
  items: [{ op: 'add', id: 'd-a', target: 'system#t-x', text: 'A' }, { op: 'add', id: 'd-b', target: 'system#t-x', text: 'B', note: 'Why.' }],
  ...over,
})

test('two equal versions differ in nothing', () => {
  assert.deepEqual(compareChanges(content(), content()), NO_CHANGES)
})

test('a part is new, modified or removed; whitespace alone is no change', () => {
  const after = content({ sections: { problem: 'No  home.\n', solution: 'A live page.', scope: 'C-3 only.' } })
  const d = compareChanges(content(), after)
  assert.deepEqual(d.sections, { solution: 'modified', scope: 'new' })
  const gone = compareChanges(content(), content({ sections: { problem: 'No home.' } }))
  assert.deepEqual(gone.sections, { solution: 'removed' })
  assert.deepEqual(gone.removed.sections, { solution: 'A page.' }, 'the removed text is kept, to show it struck through')
})

test('the title is marked like a part', () => {
  assert.equal(compareChanges(content(), content({ title: 'The live change page' })).title, 'modified')
  assert.equal(compareChanges(content(), content()).title, null)
})

test('a proposed item is new, modified (op, target, text or note) or removed, by its id', () => {
  const after = content({ items: [
    { op: 'change', id: 'd-a', target: 'system#t-x', text: 'A' },
    { op: 'add', id: 'd-c', target: 'system#t-y', text: 'C' },
  ] })
  const d = compareChanges(content(), after)
  assert.deepEqual(d.items, { 'd-a': 'modified', 'd-c': 'new' })
  assert.deepEqual(d.removed.items.map((i) => i.id), ['d-b'])
  const note = compareChanges(content(), content({ items: [content().items[0], { ...content().items[1], note: 'Why not.' }] }))
  assert.deepEqual(note.items, { 'd-b': 'modified' })
  const moved = compareChanges(content(), content({ items: [content().items[1], content().items[0]] }))
  assert.deepEqual(moved.items, {}, 'the order alone is no change')
})

test('a question is new or removed by its text; checking it modifies it', () => {
  const after = content({ questions: [
    { key: 'git or not?', text: 'Git or not?', done: true },
    { key: 'which name?', text: 'Which name?', done: false },
  ] })
  const d = compareChanges(content(), after)
  assert.deepEqual(d.questions, { 'git or not?': 'modified', 'which name?': 'new' })
  const gone = compareChanges(content(), content({ questions: [] }))
  assert.deepEqual(gone.removed.questions.map((q) => q.text), ['Git or not?'])
})

test('without an earlier version nothing is marked; NO_CHANGES is frozen', () => {
  const d = compareChanges(null, content())
  assert.deepEqual(d, NO_CHANGES, 'no earlier version: nothing to compare with, so nothing is marked')
  assert.ok(Object.isFrozen(NO_CHANGES))
})

test('a node of the thought map is new, modified (kind, recommendation, note, link, parent) or removed, by its text', () => {
  const t = (key, over = {}) => ({ key, id: `t-${key}`, parent: null, kind: 'question', text: key, ...over })
  const before = content({ thoughts: [t('where?'), t('here', { parent: 'where?', kind: 'option' }), t('apart', { parent: 'where?', kind: 'option' })] })
  const after = content({ thoughts: [t('where?', { kind: 'decision' }), t('here', { parent: 'where?', kind: 'option', recommended: true }), t('new one', { kind: 'thought' })] })
  const d = compareChanges(before, after)
  assert.deepEqual(d.thoughts, { 'where?': 'modified', here: 'modified', 'new one': 'new' })
  assert.deepEqual(d.removed.thoughts.map((x) => x.key), ['apart'])
  assert.deepEqual(compareChanges(before, before).thoughts, {})
  assert.deepEqual(compareChanges(content(), content()).removed.thoughts, [], 'a version without a map has none')
})
