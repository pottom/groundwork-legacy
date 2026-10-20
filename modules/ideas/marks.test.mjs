// The quiet marks of an idea, computed on each read (d-snooze-manual, d-stale-quiet).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marks, consideringSince, STALE_DAYS } from './marks.mjs'

const at = (d) => new Date(`${d}T12:00:00Z`)

test('a snoozed idea whose date has passed gets the quiet snooze-passed mark; on its date or before, none', () => {
  const idea = { status: 'snoozed', until: '2026-10-19', history: [] }
  assert.deepEqual(marks(idea, at('2026-10-20')), ['snooze-passed'])
  assert.deepEqual(marks(idea, at('2026-10-19')), [])
  assert.deepEqual(marks(idea, at('2026-10-01')), [])
  assert.deepEqual(marks({ status: 'considering', until: '2020-01-01', history: [] }, at('2026-10-20')), [], 'only a snoozed one')
  assert.deepEqual(marks({ status: 'snoozed', history: [] }, at('2026-10-20')), [], 'no date, no mark')
})

test('an idea in Considering for more than 90 days gets the quiet stale mark, counted from the move there', () => {
  assert.equal(STALE_DAYS, 90)
  const idea = {
    status: 'considering', created: '2026-01-01',
    history: ['2026-01-01 · claude · created', '2026-03-01 · claude · status: new → considering', '2026-04-01 · human · links: + I-3',
      '2026-05-01 · human · status: considering → new', '2026-06-01 · claude · status: new → considering; links: + I-4'],
  }
  assert.equal(consideringSince(idea), '2026-06-01', 'the last move to considering')
  assert.deepEqual(marks(idea, at('2026-08-30')), [], '90 days is not more than 90')
  assert.deepEqual(marks(idea, at('2026-08-31')), ['stale'])
  assert.deepEqual(marks({ ...idea, status: 'new' }, at('2027-01-01')), [], 'only one in Considering')
})

test('without a history line of the move, the idea counts from its created date', () => {
  const idea = { status: 'considering', created: '2026-01-01', history: ['2026-01-01 · claude · created'] }
  assert.equal(consideringSince(idea), '2026-01-01')
  assert.deepEqual(marks(idea, at('2026-06-01')), ['stale'])
  assert.deepEqual(marks({ status: 'considering', history: [] }, at('2026-06-01')), [], 'no date at all, no mark')
})
