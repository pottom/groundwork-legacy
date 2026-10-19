// The open page following its sketch on disk (view/follow.mjs): what Claude draws appears on the
// board at once, without undoing what the developer is drawing (f-board-live, d-board-merge).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { followDisk } from './view/follow.mjs'

const el = (id, version, extra = {}) => ({ id, type: 'rectangle', version, versionNonce: 1, isDeleted: false, ...extra })

test('what Claude drew joins the board; the element the developer is moving keeps its newer state', () => {
  const board = [el('a', 5, { x: 120 })]
  const disk = [el('a', 2, { x: 0 }), el('claude', 1)]
  const next = followDisk(board, disk)
  assert.deepEqual(next.map((e) => [e.id, e.version]), [['a', 5], ['claude', 1]])
})

test('nothing to update when the file holds what the board shows, such as the page\'s own save coming back', () => {
  assert.equal(followDisk([el('a', 2), el('b', 1)], [el('b', 1), el('a', 2)]), null)
  assert.equal(followDisk([el('a', 3)], [el('a', 2)]), null)
})

test('a deletion on disk removes the element from the board', () => {
  const next = followDisk([el('a', 1)], [el('a', 2, { isDeleted: true })])
  assert.equal(next[0].isDeleted, true)
})
