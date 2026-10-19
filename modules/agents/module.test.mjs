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
  assert.deepEqual(agents.public, [])
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

test('an agent\'s timeline and, once it stopped, its final report; the main session has a timeline, no report', async () => {
  await withServer(async ({ root, base }) => {
    const get = async (q) => (await fetch(`${base}/api/agents/agent?${q}`)).json()
    hook(root, { hook_event_name: 'SubagentStart', agent_id: 'a-1', agent_type: 'Explore' })
    hook(root, { hook_event_name: 'PostToolUse', agent_id: 'a-1', agent_type: 'Explore', tool_name: 'Bash', tool_use_id: 'x', tool_input: { command: 'npm test' }, tool_response: { stdout: '# pass 3\n# fail 0' } })
    const running = await get('session=s-1&agent=a-1')
    assert.deepEqual(running.steps.map((s) => [s.kind, s.outcome]), [['test', 'passed']])
    assert.equal(running.report, null, 'no report while it runs')
    hook(root, { hook_event_name: 'SubagentStop', agent_id: 'a-1', agent_type: 'Explore', last_assistant_message: '## Found\n\nThree files.' })
    assert.equal((await get('session=s-1&agent=a-1')).report, '## Found\n\nThree files.')
    assert.deepEqual(await get('session=s-1'), { steps: [], report: null })
    assert.equal((await fetch(`${base}/api/agents/agent?agent=a-1`)).status, 400, 'a session is required')
    assert.equal((await fetch(`${base}/api/agents/agent?session=s-1&agent=..%2F..%2Fx`)).status, 400)
    assert.equal((await fetch(`${base}/api/agents/agent?session=s-1`, { method: 'POST' })).status, 405)
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
