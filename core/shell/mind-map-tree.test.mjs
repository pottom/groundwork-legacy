// What <gw-mind-map> draws, as plain data (mind-map-tree.mjs), and that the component cannot edit.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { ROOT_ID, KINDS, toMindElixir, indexTree, iconUrl } from './mind-map-tree.mjs'

const TREE = { topic: 'Thought map', children: [
  { id: 'q1', kind: 'question', text: 'Where?', note: 'Why.', children: [
    { id: 'o1', kind: 'option', text: 'Here', recommended: true, children: [] },
    { id: 'o2', kind: 'option', text: 'There' },
  ] },
  { id: 'd1', kind: 'decision', text: 'Settled', link: 'd-x', children: [] },
] }

test('a tree becomes Mind Elixir\'s data: the root\'s topic, the nodes by id and text, every branch open', () => {
  assert.deepEqual(toMindElixir(TREE), { nodeData: { id: ROOT_ID, topic: 'Thought map', root: true, expanded: true, children: [
    { id: 'q1', topic: 'Where?', expanded: true, children: [
      { id: 'o1', topic: 'Here', expanded: true, children: [] },
      { id: 'o2', topic: 'There', expanded: true, children: [] },
    ] },
    { id: 'd1', topic: 'Settled', expanded: true, children: [] },
  ] } })
  assert.deepEqual(toMindElixir(null).nodeData.children, [])
})

test('the index finds a node by id with the path to it, root first', () => {
  const index = indexTree(TREE)
  assert.deepEqual([...index.keys()], ['q1', 'o1', 'o2', 'd1'])
  assert.deepEqual(index.get('o2')?.path, [ROOT_ID, 'q1'])
  assert.equal(index.get('d1')?.node.link, 'd-x')
})

test('every kind of a thought map has an icon', () => {
  assert.deepEqual(Object.keys(KINDS).sort(), ['constraint', 'decision', 'excluded', 'option', 'question', 'thought'])
  assert.match(iconUrl('question'), /^url\("data:image\/svg\+xml,/)
  assert.equal(iconUrl('nope'), iconUrl('thought'))
})

test('<gw-mind-map> is read-only: no editing, no node menu, no keys, no drag', () => {
  const src = fs.readFileSync(new URL('./mind-map.mjs', import.meta.url), 'utf8')
  assert.match(src, /editable: false/)
  assert.match(src, /contextMenu: false/)
  assert.match(src, /keypress: false/)
  assert.doesNotMatch(src, /enableEdit|beginEdit|addChild|removeNodes?\(|moveNode/)
  assert.match(src, /customElements\.define\('gw-mind-map'/)
})
