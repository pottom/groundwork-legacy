// One agent's timeline from the event log: its tool calls grouped into readable steps with times,
// test runs and commits as steps of their own.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTimeline } from './timeline.mjs'

const log = (...events) => events.map((e) => JSON.stringify({ v: 1, session: 's-1', cwd: '/p', event: 'PostToolUse', ...e })).join('\n') + '\n'
const T = (s) => `2026-10-19T10:00:${String(s).padStart(2, '0')}.000Z`
const A = { agent: 'a-1', agentType: 'general-purpose' }

test('consecutive calls of one kind make one step; a test run, a commit and a skill stand alone', () => {
  const text = log(
    { at: T(0), event: 'SubagentStart', ...A },
    { at: T(1), ...A, tool: 'Skill', skill: 'tdd' },
    { at: T(2), ...A, tool: 'Read', file: 'a.mjs' },
    { at: T(3), ...A, tool: 'Grep', file: 'core' },
    { at: T(4), ...A, tool: 'Read', file: 'a.mjs' },
    { at: T(5), ...A, tool: 'Edit', file: 'a.mjs' },
    { at: T(6), ...A, tool: 'Write', file: 'a.test.mjs' },
    { at: T(7), ...A, tool: 'Bash', commands: ['node'], test: 'failed' },
    { at: T(8), ...A, tool: 'Edit', file: 'a.mjs' },
    { at: T(9), ...A, tool: 'Bash', commands: ['npm'], test: 'passed' },
    { at: T(10), ...A, tool: 'Bash', commands: ['git'] },
    { at: T(11), event: 'PostToolUseFailure', ...A, tool: 'PowerShell', commands: ['git', 'ls'] },
    { at: T(12), ...A, tool: 'Bash', commands: ['git'], commit: '1a2b3c4' },
    { at: T(13), ...A, tool: 'ToolSearch' },
    { at: T(14), ...A, tool: 'WebSearch' },
    { at: T(15), event: 'SubagentStop', ...A },
  )
  assert.deepEqual(readTimeline(text, { session: 's-1', agent: 'a-1' }).steps, [
    { kind: 'skill', start: T(1), end: T(1), count: 1, failed: 0, skill: 'tdd' },
    { kind: 'read', start: T(2), end: T(4), count: 3, failed: 0, files: ['a.mjs', 'core'] },
    { kind: 'edit', start: T(5), end: T(6), count: 2, failed: 0, files: ['a.mjs', 'a.test.mjs'] },
    { kind: 'test', start: T(7), end: T(7), count: 1, failed: 0, outcome: 'failed', commands: ['node'] },
    { kind: 'edit', start: T(8), end: T(8), count: 1, failed: 0, files: ['a.mjs'] },
    { kind: 'test', start: T(9), end: T(9), count: 1, failed: 0, outcome: 'passed', commands: ['npm'] },
    { kind: 'command', start: T(10), end: T(11), count: 2, failed: 1, commands: ['git', 'ls'] },
    { kind: 'commit', start: T(12), end: T(12), count: 1, failed: 0, commit: '1a2b3c4' },
    { kind: 'tool', start: T(13), end: T(14), count: 2, failed: 0, tools: ['ToolSearch', 'WebSearch'] },
  ])
})

test('only the asked agent\'s steps; the main session is the events without an agent', () => {
  const text = log(
    { at: T(0), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'Explore', description: 'Look around' },
    { at: T(1), agent: 'a-2', agentType: 'Explore', tool: 'Read', file: 'x' },
    { at: T(2), tool: 'Agent', toolUse: 't1', agentId: 'a-2', status: 'completed' },
    { at: T(3), session: 's-2', tool: 'Read', file: 'y' },
    { at: T(4), event: 'Notification', notification: 'permission_prompt' },
  )
  assert.deepEqual(readTimeline(text, { session: 's-1', agent: 'a-2' }).steps.map((s) => [s.kind, s.files]), [['read', ['x']]])
  assert.deepEqual(readTimeline(text, { session: 's-1' }).steps, [
    { kind: 'agent', start: T(2), end: T(2), count: 1, failed: 0, description: 'Look around', agentId: 'a-2' },
    { kind: 'waiting', start: T(4), end: T(4), count: 1, failed: 0, notification: 'permission_prompt' },
  ])
})

test('a step names at most 12 files; a bad line is skipped; an unknown agent has no steps', () => {
  const many = Array.from({ length: 15 }, (_, k) => ({ at: T(k), ...A, tool: 'Read', file: `f${k}` }))
  const text = log(...many) + 'not json\n'
  const [step] = readTimeline(text, { session: 's-1', agent: 'a-1' }).steps
  assert.equal(step.count, 15)
  assert.deepEqual(step.files, Array.from({ length: 12 }, (_, k) => `f${k}`))
  assert.equal(step.more, 3)
  assert.deepEqual(readTimeline(text, { session: 's-1', agent: 'nobody' }).steps, [])
})
