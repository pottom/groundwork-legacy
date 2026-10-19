// Which ticket and branch each agent works on: from its task, its branch name or its commits.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ticketIn, branchTicket, linkTickets } from './agent-tickets.mjs'
import { readAgents } from './agents-log.mjs'

test('a task or a commit message names its ticket as #N, or as "issue N" / "ticket N"', () => {
  assert.equal(ticketIn('Implement #37'), '#37')
  assert.equal(ticketIn('Agents: link tickets (#37)'), '#37')
  assert.equal(ticketIn('Build issue 12 now'), '#12')
  assert.equal(ticketIn('ticket #8: the badge'), '#8')
  assert.equal(ticketIn('Fix #3, then #4'), '#3', 'the first one')
  assert.equal(ticketIn('Look around the code'), null)
  assert.equal(ticketIn('see https://x.test/page#12 and &#38;'), null, 'an anchor or an entity is no ticket')
  assert.equal(ticketIn(null), null)
})

test('a branch names its ticket by a leading number or an issue-N part, not by any number', () => {
  assert.equal(branchTicket('37-agent-links'), '#37')
  assert.equal(branchTicket('feature/37-agent-links'), '#37')
  assert.equal(branchTicket('issue-37'), '#37')
  assert.equal(branchTicket('agents/gh-37'), '#37')
  assert.equal(branchTicket('fix/ticket_8'), '#8')
  assert.equal(branchTicket('milestone-7-agents'), null, 'a milestone is no ticket')
  assert.equal(branchTicket('worktree-agent-a56629dde7b5275cc'), null)
  assert.equal(branchTicket('main'), null)
  assert.equal(branchTicket(null), null)
})

const T = (m) => `2026-10-19T10:${String(m).padStart(2, '0')}:00.000Z`
const session = (over = {}) => ({ id: 's-1', cwd: 'D:\\p', state: 'running', start: T(0), end: null, agents: [], ...over })
const agent = (over = {}) => ({ id: 'a-1', type: 'general-purpose', description: null, state: 'running', start: T(1), end: null, cwd: 'D:\\p', ...over })
const WORKTREES = [
  { path: 'D:/p', branch: 'milestone-7-agents' },
  { path: 'D:/p/.claude/worktrees/agent-a1', branch: 'worktree-agent-a1' },
  { path: 'D:/p/.claude/worktrees/agent-a12', branch: '37-links' },
]

test('an agent gets the branch of the worktree it works in, and the ticket its task names', () => {
  const [s] = linkTickets([session({ agents: [agent({ description: 'Implement #37', cwd: 'D:\\p\\.claude\\worktrees\\agent-a1\\modules' })] })], { worktrees: WORKTREES })
  assert.deepEqual([s.agents[0].branch, s.agents[0].ticket, s.agents[0].ticketFrom], ['worktree-agent-a1', '#37', 'task'])
  assert.deepEqual([s.branch, s.ticket], ['milestone-7-agents', null], 'the session, in the main checkout, names no ticket')
})

test('without a ticket in its task, an agent takes it from its branch name, then from its own commits', () => {
  const inBranch = linkTickets([session({ agents: [agent({ cwd: 'D:/p/.claude/worktrees/agent-a12' })] })], { worktrees: WORKTREES })[0].agents[0]
  assert.deepEqual([inBranch.branch, inBranch.ticket, inBranch.ticketFrom], ['37-links', '#37', 'branch'], 'the longest worktree path wins')

  const commits = { 'worktree-agent-a1': [
    { at: T(30), subject: 'Later work for #40' },   // after the agent stopped: someone else's
    { at: T(5), subject: 'Agents: links (#38)' },
    { at: T(0), subject: 'Before it started (#36)' },
  ] }
  const a = agent({ cwd: 'D:/p/.claude/worktrees/agent-a1', end: T(20), state: 'done' })
  const linked = linkTickets([session({ agents: [a] })], { worktrees: WORKTREES, commits })[0].agents[0]
  assert.deepEqual([linked.ticket, linked.ticketFrom], ['#38', 'commit'])
})

test('commits on the main checkout\'s branch name no ticket: every agent shares that branch', () => {
  const commits = { 'milestone-7-agents': [{ at: T(5), subject: 'Merge #35' }] }
  const [s] = linkTickets([session({ agents: [agent()] })], { worktrees: WORKTREES, commits })
  assert.deepEqual([s.ticket, s.agents[0].branch, s.agents[0].ticket], [null, 'milestone-7-agents', null])
})

test('the log tells where each agent works: the cwd of its latest event (a worktree agent\'s worktree)', () => {
  const line = (e) => JSON.stringify({ v: 1, session: 's-1', ...e })
  const text = [
    line({ at: T(0), event: 'SessionStart', cwd: '/p' }),
    line({ at: T(1), event: 'SubagentStart', agent: 'a-1', agentType: 'Explore', cwd: '/p' }),
    line({ at: T(2), event: 'PostToolUse', agent: 'a-1', agentType: 'Explore', tool: 'Bash', cwd: '/p/.claude/worktrees/agent-a1' }),
  ].join('\n')
  const [s] = readAgents(text).sessions
  assert.equal(s.cwd, '/p')
  assert.equal(s.agents[0].cwd, '/p/.claude/worktrees/agent-a1')
})

test('outside any worktree (or without git) there is no branch, and the task still names the ticket', () => {
  const [s] = linkTickets([session({ cwd: '/elsewhere', agents: [agent({ cwd: '/elsewhere', description: 'Do #5' })] })], { worktrees: [] })
  assert.deepEqual([s.branch, s.agents[0].branch, s.agents[0].ticket], [null, null, '#5'])
})
