// The agents that need attention: waiting for the user, stalled, or failed; and when the answer
// changes by itself (time passing), so a page can look again without polling.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attentionOf, needingAttention, STALL_MS, RECENT_MS } from './attention.mjs'

const NOW = Date.parse('2026-10-19T12:00:00.000Z')
const ago = (ms) => new Date(NOW - ms).toISOString()
const MIN = 60_000
const agent = (extra) => ({ id: 'a-1', type: 'Explore', description: 'Implement #39', state: 'running', start: ago(30 * MIN), end: null, last: ago(MIN), waiting: null, ...extra })
const session = (extra) => ({ id: 's-1', state: 'running', start: ago(60 * MIN), end: null, last: ago(MIN), waiting: null, agents: [], ...extra })

test('a running agent that is busy needs nothing', () => {
  assert.equal(attentionOf(agent(), NOW), null)
  assert.equal(attentionOf(agent({ state: 'done', end: ago(MIN) }), NOW), null)
})

test('waiting for the user: the reason and since when', () => {
  assert.deepEqual(attentionOf(agent({ waiting: ago(2 * MIN), last: ago(2 * MIN) }), NOW), { reason: 'waiting', since: ago(2 * MIN) })
})

test('stalled: running without an event for longer than STALL_MS, since its last event', () => {
  assert.equal(attentionOf(agent({ last: ago(STALL_MS - 1) }), NOW), null)
  assert.deepEqual(attentionOf(agent({ last: ago(STALL_MS) }), NOW), { reason: 'stalled', since: ago(STALL_MS) })
})

test('failed: since it stopped', () => {
  assert.deepEqual(attentionOf(agent({ state: 'failed', end: ago(5 * MIN) }), NOW), { reason: 'failed', since: ago(5 * MIN) })
})

test('old news is not attention: anything older than RECENT_MS (a session killed long ago)', () => {
  assert.equal(attentionOf(agent({ state: 'failed', end: ago(RECENT_MS) }), NOW), null)
  assert.equal(attentionOf(agent({ last: ago(RECENT_MS) }), NOW), null)
  assert.equal(attentionOf(agent({ waiting: ago(RECENT_MS), last: ago(RECENT_MS) }), NOW), null)
})

test('a session waiting on a running agent is not stalled itself: the agent carries it', () => {
  const quiet = { last: ago(STALL_MS + MIN) }
  assert.equal(attentionOf(session({ ...quiet, agents: [agent(quiet)] }), NOW), null)
  assert.deepEqual(attentionOf(session(quiet), NOW), { reason: 'stalled', since: quiet.last })
  assert.deepEqual(attentionOf(session({ ...quiet, waiting: ago(MIN), agents: [agent(quiet)] }), NOW), { reason: 'waiting', since: ago(MIN) })
})

test('needingAttention lists sessions and agents with a key per episode, and when to look again', () => {
  const sessions = [
    session({ id: 's-1', agents: [agent({ id: 'a-1', waiting: ago(MIN) }), agent({ id: 'a-2', last: ago(4 * MIN) })] }),
    session({ id: 's-2', state: 'done', end: ago(MIN), agents: [agent({ id: 'a-3', state: 'failed', end: ago(3 * MIN) })] }),
  ]
  const { items, recheck } = needingAttention(sessions, NOW)
  assert.deepEqual(items.map(({ key, session, agent, reason, label }) => ({ key, session, agent, reason, label })), [
    { key: `s-1/a-1:waiting:${ago(MIN)}`, session: 's-1', agent: 'a-1', reason: 'waiting', label: 'Implement #39' },
    { key: `s-2/a-3:failed:${ago(3 * MIN)}`, session: 's-2', agent: 'a-3', reason: 'failed', label: 'Implement #39' },
  ])
  // a-2 goes quiet first: it stalls 4 minutes from now unless something happens
  assert.equal(recheck, new Date(NOW - 4 * MIN + STALL_MS).toISOString())
})

test('a session item has no agent and no label of its own; nothing to recheck when nothing runs or waits', () => {
  const { items } = needingAttention([session({ waiting: ago(MIN) })], NOW)
  assert.deepEqual(items.map(({ key, agent, label }) => ({ key, agent, label })), [{ key: `s-1/:waiting:${ago(MIN)}`, agent: null, label: null }])
  assert.equal(needingAttention([session({ state: 'done', end: ago(MIN) })], NOW).recheck, null)
})
