// The Agents module behind the core server: its manifest, GET /api/agents/list and the live topic.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { startServer } from '../../core/server.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import { MODULES } from '../../core/modules.mjs'
import agents, { HOOK } from './module.mjs'

const DIR = path.join('.groundwork', 'agents')

async function withServer(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-agents-'))
  const srv = await startServer({ root, modules: [agents], port: 0 })
  try { await fn({ root, srv, base: `http://127.0.0.1:${srv.port}` }) } finally { await srv.close() }
}

const hook = (root, input) => spawnSync(process.execPath, [HOOK], {
  input: JSON.stringify({ session_id: 's-1', cwd: root, ...input }), env: { ...process.env, CLAUDE_PROJECT_DIR: root },
})

test('Agents is a tool after Sketch, which may write only .groundwork/agents/ and reads no other module', () => {
  assert.equal(agents.id, 'agents')
  assert.equal(agents.name, 'Agents')
  assert.equal(agents.tool, true)
  assert.deepEqual(agents.writes, ['.groundwork/agents'])
  assert.ok(agents.tagline.en && agents.tagline.hu && agents.icon)
  const tabs = MODULES.filter((m) => m.view).map((m) => m.id)
  assert.deepEqual(tabs.slice(-2), ['sketch', 'agents'], 'the shell shows Agents after Sketch')
})

test('its hooks: the events that tell of sessions and agents, the Agent tool alone before a call', () => {
  const hooks = agents.claude.hooks
  assert.deepEqual(hooks.map((h) => h.event), ['SessionStart', 'SubagentStart', 'SubagentStop', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'SessionEnd'])
  for (const h of hooks) assert.equal(h.script, HOOK, 'run with node, not npx')
  assert.equal(hooks.find((h) => h.event === 'PreToolUse').matcher, 'Agent|Task', 'one hook per ordinary tool call, not two')
})

test('the list is empty before any session, and reading writes nothing', async () => {
  await withServer(async ({ root, base }) => {
    const r = await fetch(`${base}/api/agents/list`)
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { sessions: [] })
    assert.equal(fs.existsSync(path.join(root, '.groundwork')), false)
    assert.equal((await fetch(`${base}/api/agents/list`, { method: 'POST' })).status, 405)
  })
})

test('a session with a subagent, as the hooks logged it, is listed with its agent; the moved-aside log too', async () => {
  await withServer(async ({ root, base }) => {
    fs.mkdirSync(path.join(root, DIR), { recursive: true })
    fs.writeFileSync(path.join(root, DIR, 'events.1.jsonl'), JSON.stringify({ v: 1, at: '2026-10-19T09:00:00.000Z', event: 'SessionStart', session: 's-0' }) + '\n')
    hook(root, { hook_event_name: 'SessionStart', source: 'startup' })
    hook(root, { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 't1', tool_input: { description: 'Look around', prompt: 'x', subagent_type: 'Explore' } })
    hook(root, { hook_event_name: 'SubagentStart', agent_id: 'a-1', agent_type: 'Explore' })
    const { sessions } = await (await fetch(`${base}/api/agents/list`)).json()
    assert.deepEqual(sessions.map((s) => [s.id, s.state]), [['s-1', 'running'], ['s-0', 'running']])
    assert.deepEqual(sessions[0].agents.map((a) => [a.id, a.type, a.description, a.state]), [['a-1', 'Explore', 'Look around', 'running']])
  })
})

const hasGit = spawnSync('git', ['--version']).status === 0
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
}

// A project on `main` with two worktree agents: one on a branch named for #37, one whose commit names #38.
function worktreeProject(root) {
  git(root, 'init', '-q', '-b', 'main')
  fs.writeFileSync(path.join(root, 'a.txt'), 'a')
  git(root, 'add', '.')
  git(root, 'commit', '-q', '-m', 'Start (#1)')
  const w1 = path.join(root, '.claude', 'worktrees', 'agent-1')
  const w2 = path.join(root, '.claude', 'worktrees', 'agent-2')
  git(root, 'worktree', 'add', '-q', '-b', '37-agent-links', w1)
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-2', w2)
  fs.writeFileSync(path.join(w2, 'b.txt'), 'b')
  git(w2, 'add', '.')
  git(w2, 'commit', '-q', '-m', 'Agents: the worktrees view (#38)')
  const now = Date.now()
  const at = (s) => new Date(now + s * 1000).toISOString()
  const line = (e) => JSON.stringify({ v: 1, session: 's-1', ...e })
  fs.mkdirSync(path.join(root, DIR), { recursive: true })
  fs.writeFileSync(path.join(root, DIR, 'events.jsonl'), [
    line({ at: at(-60), event: 'SessionStart', cwd: root }),
    line({ at: at(-50), event: 'PreToolUse', tool: 'Agent', toolUse: 't1', subagentType: 'general-purpose', description: 'Build the links', cwd: root }),
    line({ at: at(-49), event: 'SubagentStart', agent: 'a-1', agentType: 'general-purpose', cwd: root }),
    line({ at: at(-48), event: 'PostToolUse', agent: 'a-1', agentType: 'general-purpose', tool: 'Edit', cwd: w1 }),
    line({ at: at(-40), event: 'PreToolUse', tool: 'Agent', toolUse: 't2', subagentType: 'Explore', description: 'Worktrees', cwd: root }),
    line({ at: at(-39), event: 'SubagentStart', agent: 'a-2', agentType: 'Explore', cwd: root }),
    line({ at: at(-38), event: 'PostToolUse', agent: 'a-2', agentType: 'Explore', tool: 'Bash', cwd: w2 }),
    line({ at: at(-30), event: 'PreToolUse', tool: 'Agent', toolUse: 't3', subagentType: 'Explore', description: 'Finished #12', cwd: root }),
    line({ at: at(-29), event: 'SubagentStart', agent: 'a-3', agentType: 'Explore', cwd: root }),
    line({ at: at(-28), event: 'SubagentStop', agent: 'a-3', agentType: 'Explore', cwd: root }),
  ].join('\n') + '\n')
}

test('each agent is listed with its branch and ticket: from its task, its branch name or its commits', { skip: !hasGit }, async () => {
  await withServer(async ({ root, base }) => {
    worktreeProject(root)
    const { sessions } = await (await fetch(`${base}/api/agents/list`)).json()
    assert.deepEqual([sessions[0].branch, sessions[0].ticket], ['main', null])
    assert.deepEqual(sessions[0].agents.map((a) => [a.id, a.branch, a.ticket, a.ticketFrom]), [
      ['a-1', '37-agent-links', '#37', 'branch'],
      ['a-2', 'worktree-agent-2', '#38', 'commit'],
      ['a-3', 'main', '#12', 'task'],
    ])
  })
})

test('GET /api/agents/tickets (public, for Build): the running agents per ticket, nothing more', { skip: !hasGit }, async () => {
  assert.deepEqual(agents.public, ['GET /api/agents/tickets'])
  await withServer(async ({ root, base }) => {
    assert.deepEqual(await (await fetch(`${base}/api/agents/tickets`)).json(), { tickets: {} }, 'no log: no agent on any ticket')
    worktreeProject(root)
    const { tickets } = await (await fetch(`${base}/api/agents/tickets`)).json()
    assert.deepEqual(Object.keys(tickets).sort(), ['#37', '#38'], 'a-3 is done: #12 is not being worked on')
    assert.deepEqual(tickets['#37'], [{ id: 'a-1', session: 's-1', label: 'Build the links', branch: '37-agent-links', start: tickets['#37'][0].start }])
    assert.equal((await fetch(`${base}/api/agents/tickets`, { method: 'POST' })).status, 405)
  })
})

test('a new event in the log is the topic agents.events, so the open page reads the list again', async () => {
  await withServer(async ({ root, srv }) => {
    const sse = listen(srv.port)
    try {
      await sse.next((e) => e.event === 'hello')
      hook(root, { hook_event_name: 'SubagentStart', agent_id: 'a-1', agent_type: 'Explore' })
      await sse.change('agents.events')
    } finally { sse.close() }
  })
})
