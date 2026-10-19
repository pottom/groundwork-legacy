// The sessions and agents the event log tells of: who runs, who is done, who failed, and when.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readAgents } from './agents-log.mjs'

const log = (...events) => events.map((e) => JSON.stringify({ v: 1, session: 's-1', cwd: '/p', ...e })).join('\n') + '\n'
const T = (s) => `2026-10-19T10:00:${String(s).padStart(2, '0')}.000Z`

test('a session with a subagent: both listed, the agent labelled by its Agent call, running then done', () => {
  const start = [
    { at: T(0), event: 'SessionStart', source: 'startup' },
    { at: T(1), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'general-purpose', description: 'Implement #35' },
    { at: T(2), event: 'SubagentStart', agent: 'a-1', agentType: 'general-purpose' },
    { at: T(3), event: 'PostToolUse', agent: 'a-1', agentType: 'general-purpose', tool: 'Bash', commands: ['npm'] },
  ]
  const running = readAgents(log(...start))
  assert.deepEqual(running.sessions, [{
    id: 's-1', cwd: '/p', state: 'running', start: T(0), end: null,
    agents: [{ id: 'a-1', type: 'general-purpose', description: 'Implement #35', state: 'running', start: T(2), end: null }],
  }])
  const done = readAgents(log(...start,
    { at: T(9), event: 'SubagentStop', agent: 'a-1', agentType: 'general-purpose' },
    { at: T(10), event: 'PostToolUse', tool: 'Agent', toolUse: 't1', agentId: 'a-1', status: 'completed' },
    { at: T(12), event: 'Stop' }))
  assert.equal(done.sessions[0].state, 'done')
  assert.equal(done.sessions[0].end, T(12))
  assert.deepEqual(done.sessions[0].agents[0], { id: 'a-1', type: 'general-purpose', description: 'Implement #35', state: 'done', start: T(2), end: T(9) })
})

test('a session that goes on after a Stop is running again', () => {
  const s = readAgents(log({ at: T(0), event: 'SessionStart' }, { at: T(1), event: 'Stop' }, { at: T(5), event: 'PostToolUse', tool: 'Read' })).sessions[0]
  assert.deepEqual([s.state, s.end], ['running', null])
})

test('two agents of one type each get their own call\'s label, in order; the result confirms who is who', () => {
  const s = readAgents(log(
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'Explore', description: 'first' },
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't2', subagentType: 'Explore', description: 'second' },
    { at: T(1), event: 'SubagentStart', agent: 'a-2', agentType: 'Explore' },
    { at: T(1), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(4), event: 'PostToolUse', tool: 'Agent', toolUse: 't1', agentId: 'a-1', status: 'completed' },
    { at: T(5), event: 'PostToolUse', tool: 'Agent', toolUse: 't2', agentId: 'a-2', status: 'completed' },
  )).sessions[0]
  assert.deepEqual(s.agents.map((a) => [a.id, a.description]), [['a-2', 'second'], ['a-1', 'first']])
})

test('an Agent call that fails marks its agent failed; an agent never stopped when its session ended failed too', () => {
  const s = readAgents(log(
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'Explore', description: 'look' },
    { at: T(1), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(2), event: 'SubagentStart', agent: 'a-2', agentType: 'Plan' },
    { at: T(3), event: 'PostToolUseFailure', tool: 'Agent', toolUse: 't1', interrupted: true },
    { at: T(6), event: 'SessionEnd', reason: 'other' },
  )).sessions[0]
  assert.deepEqual(s.agents.map((a) => [a.id, a.state, a.end]), [['a-1', 'failed', T(3)], ['a-2', 'failed', T(6)]])
  assert.deepEqual([s.state, s.end], ['done', T(6)])
})

test('newest session first; an agent whose start was rotated away is still listed; a bad line is skipped', () => {
  const text = log({ at: T(0), event: 'SessionStart', session: 'old' }, { at: T(1), event: 'Stop', session: 'old' })
    + 'not json\n'
    + log({ at: T(5), event: 'PostToolUse', session: 'new', agent: 'a-9', agentType: 'Explore', tool: 'Read' })
  const { sessions } = readAgents(text)
  assert.deepEqual(sessions.map((s) => s.id), ['new', 'old'])
  assert.deepEqual(sessions[0].agents, [{ id: 'a-9', type: 'Explore', description: null, state: 'running', start: T(5), end: null }])
})
