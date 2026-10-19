// The Agents hook as Claude Code runs it: `node hook.mjs` with the hook's JSON on stdin. It appends
// one summary line to .groundwork/agents/events.jsonl: what happened, never contents or secrets.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook.mjs')
const LOG = path.join('.groundwork', 'agents', 'events.jsonl')

function project() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gw-agents-hook-'))
}

// Runs the hook for one input in the project; the project is CLAUDE_PROJECT_DIR, as Claude Code sets it.
function run(root, input, env = { CLAUDE_PROJECT_DIR: root }) {
  const started = performance.now()
  const r = spawnSync(process.execPath, [HOOK], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { ...process.env, ...env },
    encoding: 'utf8',
  })
  return { ...r, ms: performance.now() - started }
}

const lines = (root) => {
  const file = path.join(root, LOG)
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []
}

const base = { session_id: 's-1', transcript_path: '/home/me/.claude/projects/x/s-1.jsonl', permission_mode: 'default' }

test('a subagent\'s tool call becomes one line with its session, agent, tool, file and time', () => {
  const root = project()
  const r = run(root, { ...base, cwd: root, hook_event_name: 'PostToolUse', agent_id: 'a-7', agent_type: 'general-purpose',
    tool_name: 'Edit', tool_use_id: 'toolu_1', duration_ms: 12,
    tool_input: { file_path: path.join(root, 'core', 'init.mjs'), old_string: 'x', new_string: 'y' },
    tool_response: { filePath: path.join(root, 'core', 'init.mjs'), structuredPatch: [] } })
  assert.equal(r.status, 0)
  assert.equal(r.stdout, '', 'says nothing: on some events Claude Code would read stdout as context')
  const [e] = lines(root)
  assert.ok(Date.now() - Date.parse(e.at) < 60_000, 'stamped with the time')
  assert.deepEqual({ ...e, at: undefined }, {
    at: undefined, v: 1, event: 'PostToolUse', session: 's-1', agent: 'a-7', agentType: 'general-purpose', cwd: root,
    tool: 'Edit', toolUse: 'toolu_1', file: 'core/init.mjs', ms: 12,
  })
})

test('the log holds no file contents, prompts, command arguments, outputs or secrets', () => {
  const root = project()
  const SECRETS = ['hunter2', 'sk-live-123', 'ghp_abcdef', 'PROMPT-TEXT', 'FILE-CONTENT', 'OUTPUT-TEXT', 'REPORT-TEXT', 'NOTE-TEXT', 'ERROR-TEXT', 'https://x.test/?token=']
  const inputs = [
    { hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 't1', tool_input: { description: 'Implement #35', prompt: 'PROMPT-TEXT with hunter2', subagent_type: 'general-purpose' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 't1', tool_input: { prompt: 'PROMPT-TEXT' }, tool_response: { status: 'completed', agentId: 'a-1', content: [{ type: 'text', text: 'REPORT-TEXT' }], prompt: 'PROMPT-TEXT' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_use_id: 't2', tool_input: { file_path: 'notes.md', content: 'FILE-CONTENT sk-live-123' }, tool_response: 'FILE-CONTENT' },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_use_id: 't3', tool_input: { command: 'API_KEY=sk-live-123 curl -H "Authorization: ghp_abcdef" https://x.test/?token= && npm test -- --password hunter2', description: 'NOTE-TEXT' }, tool_response: { stdout: 'OUTPUT-TEXT', stderr: '' } },
    { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_use_id: 't4', tool_input: { command: 'cat secret.txt' }, error: 'ERROR-TEXT hunter2', is_interrupt: false },
    { hook_event_name: 'PostToolUse', tool_name: 'WebFetch', tool_use_id: 't5', tool_input: { url: 'https://x.test/?token=', prompt: 'PROMPT-TEXT' }, tool_response: 'OUTPUT-TEXT' },
    { hook_event_name: 'PostToolUse', tool_name: 'Grep', tool_use_id: 't6', tool_input: { pattern: 'hunter2', path: 'src' }, tool_response: 'OUTPUT-TEXT' },
    { hook_event_name: 'UserPromptSubmit', prompt: 'PROMPT-TEXT hunter2' },
    { hook_event_name: 'Notification', message: 'NOTE-TEXT', title: 'NOTE-TEXT', notification_type: 'permission_prompt' },
    { hook_event_name: 'SubagentStop', agent_id: 'a-1', agent_type: 'general-purpose', last_assistant_message: 'REPORT-TEXT', agent_transcript_path: '/x/REPORT-TEXT.jsonl', stop_hook_active: false },
    { hook_event_name: 'Stop', last_assistant_message: 'REPORT-TEXT', stop_hook_active: false },
  ]
  for (const i of inputs) assert.equal(run(root, { ...base, cwd: root, ...i }).status, 0)
  const text = fs.readFileSync(path.join(root, LOG), 'utf8')
  for (const s of SECRETS) assert.ok(!text.includes(s), `the log holds ${s}`)
  assert.ok(!text.includes('transcript'), 'no transcript paths')
  const got = lines(root)
  assert.equal(got.length, inputs.length)
  assert.deepEqual(got.map((e) => e.commands).filter(Boolean), [['curl', 'npm'], ['cat']], 'only the names of the commands run')
  assert.equal(got[0].description, 'Implement #35', 'a subagent\'s short description is its label')
  assert.equal(got[0].subagentType, 'general-purpose')
  assert.deepEqual([got[1].agentId, got[1].status], ['a-1', 'completed'], 'which agent the call started, and how it ended')
  assert.equal(got[2].file, 'notes.md')
  assert.equal(got[4].interrupted, false)
  assert.equal(got[8].notification, 'permission_prompt')
})

test('the hook writes only under .groundwork/agents/, and never fails the tool call', () => {
  const root = project()
  for (const input of ['not json', '', JSON.stringify({ ...base, cwd: root, hook_event_name: 'SessionStart', source: 'startup' })]) {
    const r = run(root, input)
    assert.equal(r.status, 0, 'exit 0 whatever comes in: a hook that fails must not stop Claude')
  }
  const all = fs.readdirSync(root, { recursive: true }).map((f) => String(f).split(path.sep).join('/'))
  assert.deepEqual(all.sort(), ['.groundwork', '.groundwork/agents', '.groundwork/agents/events.jsonl'])
  assert.deepEqual(lines(root).map((e) => [e.event, e.source]), [['SessionStart', 'startup']])
})

test('without CLAUDE_PROJECT_DIR the log goes to the project the hook\'s cwd names', () => {
  const root = project()
  const env = { CLAUDE_PROJECT_DIR: '' }
  assert.equal(run(root, { ...base, cwd: root, hook_event_name: 'Stop' }, env).status, 0)
  assert.deepEqual(lines(root).map((e) => e.event), ['Stop'])
})

test('a large log moves aside to events.1.jsonl, so it never grows without end', () => {
  const root = project()
  const dir = path.join(root, '.groundwork', 'agents')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'events.jsonl'), `${JSON.stringify({ v: 1, event: 'Stop', session: 'old' })}\n`.repeat(70_000))
  run(root, { ...base, cwd: root, hook_event_name: 'SessionStart', source: 'startup' })
  assert.deepEqual(lines(root).map((e) => e.event), ['SessionStart'])
  assert.ok(fs.statSync(path.join(dir, 'events.1.jsonl')).size > 2_000_000)
})

test('a hook call adds under 100 ms (the best of five, measured as Claude Code runs it)', () => {
  const root = project()
  const times = []
  for (let i = 0; i < 5; i++) times.push(run(root, { ...base, cwd: root, hook_event_name: 'PostToolUse', tool_name: 'Read', tool_use_id: `t${i}`, tool_input: { file_path: 'a.md' } }).ms)
  const best = Math.min(...times)
  assert.ok(best < 100, `best of five: ${Math.round(best)} ms (${times.map(Math.round).join(', ')})`)
})

test('the hook is one file that needs only Node: groundwork init copies it into the project', () => {
  const src = fs.readFileSync(HOOK, 'utf8')
  const specs = [...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])
  assert.ok(specs.length)
  for (const s of specs) assert.match(s, /^node:/, s)
})
