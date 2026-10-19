// Two edits of one sketch at the same time, merged element by element (d-board-merge).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeElements } from './merge.mjs'

const el = (id, version, extra = {}) => ({ id, type: 'rectangle', version, versionNonce: 100, isDeleted: false, ...extra })

test('an element only one side has is kept, so an edit in the browser and one from Claude both survive', () => {
  const mine = [el('a', 1), el('b', 4)]
  const theirs = [el('a', 1), el('c', 1)]
  assert.deepEqual(mergeElements(theirs, mine).map((e) => e.id).sort(), ['a', 'b', 'c'])
})

test('of the same element, the higher version wins, whichever side it is on', () => {
  const merged = mergeElements([el('a', 3, { x: 30 }), el('b', 1, { x: 1 })], [el('a', 2, { x: 20 }), el('b', 5, { x: 5 })])
  assert.deepEqual(merged.map((e) => [e.id, e.x]), [['a', 30], ['b', 5]])
})

test('the same version edited on both sides ends the same on both: the lower versionNonce wins', () => {
  const one = el('a', 2, { versionNonce: 9, x: 1 })
  const two = el('a', 2, { versionNonce: 3, x: 2 })
  assert.equal(mergeElements([one], [two])[0].x, 2)
  assert.equal(mergeElements([two], [one])[0].x, 2)
})

test('a deletion is an element too (isDeleted, a higher version), so it is not undone by the other side', () => {
  const merged = mergeElements([el('a', 1)], [el('a', 2, { isDeleted: true })])
  assert.equal(merged[0].isDeleted, true)
})

test('the order (front to back) is the newer side\'s; an element only the other side has stays after its neighbour there', () => {
  const base = [el('a', 1), el('b', 1), el('c', 1)]
  const mine = [el('b', 1), el('a', 1), el('c', 1)]
  const theirs = [el('a', 1), el('x', 1), el('b', 1), el('c', 1)]
  assert.deepEqual(mergeElements(theirs, mine).map((e) => e.id), ['b', 'a', 'x', 'c'])
  assert.deepEqual(mergeElements(base, []).map((e) => e.id), ['a', 'b', 'c'])
})
