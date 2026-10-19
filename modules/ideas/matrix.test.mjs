// The impact–effort matrix: where an open idea sits, and the estimate a move to another quadrant sets.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { QUADRANTS, quadrantOf, placeOnMatrix, estimateFor } from './matrix.mjs'

const idea = (id, impact, effort, status = 'new') => ({ id, impact, effort, status })

test('the four quadrants, quick wins first: high impact and low effort', () => {
  assert.deepEqual(QUADRANTS.map((q) => q.id), ['quick-wins', 'big-bets', 'fill-ins', 'time-sinks'])
  assert.deepEqual(QUADRANTS[0], { id: 'quick-wins', impact: 'high', effort: 'low' })
})

test('a medium estimate leans to the less favourable half, so only a sure quick win is shown as one', () => {
  assert.equal(quadrantOf(idea('I-1', 'high', 'low')), 'quick-wins')
  assert.equal(quadrantOf(idea('I-2', 'high', 'medium')), 'big-bets')
  assert.equal(quadrantOf(idea('I-3', 'medium', 'low')), 'fill-ins')
  assert.equal(quadrantOf(idea('I-4', 'medium', 'medium')), 'time-sinks')
  assert.equal(quadrantOf(idea('I-5', 'low', 'high')), 'time-sinks')
  assert.equal(quadrantOf(idea('I-6', 'high', '')), null, 'no effort yet: unestimated')
  assert.equal(quadrantOf(idea('I-7', undefined, 'low')), null, 'no impact yet: unestimated')
})

test('the matrix holds only open ideas (New and Considering); those without a full estimate are listed apart', () => {
  const placed = placeOnMatrix([
    idea('I-1', 'high', 'low'),
    idea('I-2', 'high', 'low', 'considering'),
    idea('I-3', 'high', 'low', 'to-develop'),
    idea('I-4', 'low', 'low', 'rejected'),
    idea('I-5', 'low', 'high'),
    idea('I-6', '', 'low', 'considering'),
  ])
  assert.deepEqual(Object.fromEntries(Object.entries(placed).map(([k, v]) => [k, v.map((i) => i.id)])), {
    'quick-wins': ['I-1', 'I-2'], 'big-bets': [], 'fill-ins': [], 'time-sinks': ['I-5'], unestimated: ['I-6'],
  })
})

test('a move to another quadrant changes only the half that differs, to that half\'s level', () => {
  assert.deepEqual(estimateFor(idea('I-1', 'low', 'high'), 'quick-wins'), { impact: 'high', effort: 'low' })
  assert.deepEqual(estimateFor(idea('I-2', 'high', 'high'), 'quick-wins'), { effort: 'low' })
  assert.deepEqual(estimateFor(idea('I-3', 'high', 'low'), 'fill-ins'), { impact: 'low' })
  assert.deepEqual(estimateFor(idea('I-4', 'medium', 'low'), 'time-sinks'), { effort: 'high' }, 'medium impact already sits low')
  assert.deepEqual(estimateFor(idea('I-5', 'high', 'low'), 'quick-wins'), {}, 'already there')
  assert.deepEqual(estimateFor(idea('I-6', '', 'medium'), 'big-bets'), { impact: 'high' }, 'an unestimated idea gets the missing half')
  assert.throws(() => estimateFor(idea('I-7', 'low', 'low'), 'nowhere'), /quadrant/)
})
