// A change's thought map on its page (thoughts.mjs): the flat nodes, the tree the map draws, the
// open questions with their options.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readChange } from '../../core/records/changes.mjs'
import { flatThoughts, idOf, mapTree, mapMarks, openQuestions } from './thoughts.mjs'

const BODY = [
  '## Gondolatok', '',
  '- ? Where does the map live?',
  '  - ~! In the change',
  '  - ~ Apart',
  '- = Settled → `d-x`',
  '  Why.',
  '  - ? Which  name?',
  '    - ~ Same',
  '- ~ Same',
].join('\n')
const flat = () => flatThoughts(readChange(BODY).thoughts)

test('the map\'s nodes, flat in the file\'s order, known by their text; a repeated text gets a number', () => {
  const f = flat()
  assert.deepEqual(f.map((t) => [t.key, t.parent, t.kind]), [
    ['where does the map live?', null, 'question'],
    ['in the change', 'where does the map live?', 'option'],
    ['apart', 'where does the map live?', 'option'],
    ['settled', null, 'decision'],
    ['which name?', 'settled', 'question'],
    ['same', 'which name?', 'option'],
    ['same #2', null, 'option'],
  ])
  assert.equal(f[1].recommended, true)
  assert.deepEqual([f[3].item, f[3].note], ['d-x', 'Why.'])
  for (const t of f) assert.match(t.id, /^t-[\w-]+$/)
  assert.equal(new Set(f.map((t) => t.id)).size, f.length)
  assert.equal(f[0].id, idOf('where does the map live?'), 'the id follows the text, so it stays across reads')
})

test('the tree the map draws: the title as root, the nodes as they nest, removed ones under their old parent', () => {
  const f = flat()
  const removed = [{ key: 'gone', id: idOf('gone'), parent: 'settled', kind: 'thought', text: 'Gone' }, { key: 'lost', id: idOf('lost'), parent: 'nowhere', kind: 'excluded', text: 'Lost' }]
  const tree = mapTree('Thought map', f, removed)
  assert.equal(tree.topic, 'Thought map')
  assert.deepEqual(tree.children.map((n) => n.text), ['Where does the map live?', 'Settled', 'Same', 'Lost'])
  assert.deepEqual(tree.children[1].children.map((n) => n.text), ['Which  name?', 'Gone'])
  assert.deepEqual(tree.children[1].children[0].children.map((n) => n.text), ['Same'])
  assert.deepEqual(tree.children[0].children[0], { id: f[1].id, kind: 'option', text: 'In the change', recommended: true, children: [] })
  assert.equal(tree.children[1].link, 'd-x')
})

test('the open questions with their options, the latest on top: new since the commit first, then from the end', () => {
  const f = flat()
  assert.deepEqual(openQuestions(f).map((q) => [q.text, q.options.map((o) => o.text)]), [
    ['Which  name?', ['Same']],
    ['Where does the map live?', ['In the change', 'Apart']],
  ])
  assert.equal(openQuestions(f)[1].options[0].recommended, true)
  assert.deepEqual(openQuestions(f, { thoughts: { 'where does the map live?': 'new' } }).map((q) => q.key), ['where does the map live?', 'which name?'])
  assert.deepEqual(openQuestions([]), [])
})

test('a Diff\'s marks of the map, by the ids the map knows', () => {
  const gone = { key: 'gone', id: idOf('gone'), parent: null, kind: 'thought', text: 'Gone' }
  assert.deepEqual(mapMarks({ thoughts: { here: 'new', there: 'modified' }, removed: { thoughts: [gone] } }),
    { [idOf('here')]: 'new', [idOf('there')]: 'modified', [gone.id]: 'removed' })
  assert.deepEqual(mapMarks(null), {})
})
