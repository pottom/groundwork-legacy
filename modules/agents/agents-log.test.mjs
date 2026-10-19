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
    id: 's-1', cwd: '/p', state: 'running', start: T(0), end: null, last: T(3), waiting: null,
    agents: [{ id: 'a-1', type: 'general-purpose', description: 'Implement #35', state: 'running', start: T(2), end: null, cwd: '/p', last: T(3), waiting: null }],
  }])
  const done = readAgents(log(...start,
    { at: T(9), event: 'SubagentStop', agent: 'a-1', agentType: 'general-purpose' },
    { at: T(10), event: 'PostToolUse', tool: 'Agent', toolUse: 't1', agentId: 'a-1', status: 'completed' },
    { at: T(12), event: 'Stop' }))
  assert.equal(done.sessions[0].state, 'done')
  assert.equal(done.sessions[0].end, T(12))
  assert.deepEqual(done.sessions[0].agents[0], { id: 'a-1', type: 'general-purpose', description: 'Implement #35', state: 'done', start: T(2), end: T(9), cwd: '/p', last: T(9), waiting: null })
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

test('parallel agents of one type started out of order: the first result to name its agent puts the other one right too', () => {
  const s = readAgents(log(
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'Explore', description: 'first' },
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't2', subagentType: 'Explore', description: 'second' },
    { at: T(1), event: 'SubagentStart', agent: 'a-2', agentType: 'Explore' },
    { at: T(1), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(4), event: 'PostToolUse', tool: 'Agent', toolUse: 't1', agentId: 'a-1', status: 'completed' },
    { at: T(5), event: 'PostToolUseFailure', tool: 'Agent', toolUse: 't2', interrupted: true },
  )).sessions[0]
  assert.deepEqual(s.agents.map((a) => [a.id, a.description, a.state]), [['a-2', 'second', 'failed'], ['a-1', 'first', 'running']])
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
  assert.deepEqual(sessions[0].agents, [{ id: 'a-9', type: 'Explore', description: null, state: 'running', start: T(5), end: null, cwd: '/p', last: T(5), waiting: null }])
})

test('each session and agent knows its latest event: a session counts its agents\' events too', () => {
  const s = readAgents(log(
    { at: T(0), event: 'SessionStart' },
    { at: T(1), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(4), event: 'PostToolUse', agent: 'a-1', agentType: 'Explore', tool: 'Read' },
  )).sessions[0]
  assert.equal(s.last, T(4))
  assert.equal(s.agents[0].last, T(4))
})

test('a permission prompt with the agent\'s id makes that agent wait, until its next event', () => {
  const events = [
    { at: T(0), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(2), event: 'Notification', agent: 'a-1', agentType: 'Explore', notification: 'permission_prompt' },
  ]
  const waiting = readAgents(log(...events)).sessions[0]
  assert.equal(waiting.agents[0].waiting, T(2))
  assert.equal(waiting.waiting, null, 'the agent waits, not its session')
  const answered = readAgents(log(...events, { at: T(5), event: 'PostToolUse', agent: 'a-1', agentType: 'Explore', tool: 'Bash' })).sessions[0]
  assert.equal(answered.agents[0].waiting, null)
})

test('a permission prompt without an agent id makes the session wait, until any later event of it, its agents\' too', () => {
  const events = [
    { at: T(0), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore' },
    { at: T(2), event: 'Notification', notification: 'permission_prompt' },
  ]
  const waiting = readAgents(log(...events)).sessions[0]
  assert.equal(waiting.waiting, T(2))
  assert.equal(waiting.agents[0].waiting, null)
  const answered = readAgents(log(...events, { at: T(5), event: 'PostToolUse', agent: 'a-1', agentType: 'Explore', tool: 'Bash' })).sessions[0]
  assert.equal(answered.waiting, null)
})

test('only a prompt that asks the user waits: idle and other notifications do not', () => {
  const s = readAgents(log({ at: T(1), event: 'Stop' }, { at: T(61), event: 'Notification', notification: 'idle_prompt' })).sessions[0]
  assert.equal(s.waiting, null)
  const asked = readAgents(log({ at: T(1), event: 'Notification', notification: 'elicitation_dialog' })).sessions[0]
  assert.equal(asked.waiting, T(1))
})
