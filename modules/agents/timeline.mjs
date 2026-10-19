// One agent's timeline from the event log (the lines hook.mjs writes, oldest first): its tool
// calls grouped into readable steps.
//
//   readTimeline(text, { session, agent? }) -> { steps: [{ kind, start, end, count, failed, ... }] }
//
// `agent` names a subagent; without it, the timeline is the main session's (its events with no
// agent). A step is one of
//   - read     files read or searched (Read, Grep, Glob ...)          files, more?
//   - edit     files changed (Edit, Write, NotebookEdit ...)           files, more?
//   - command  other shell commands                                    commands
//   - tool     any other tool (WebSearch, ToolSearch, an MCP tool ...) tools
//   - test     one test run: outcome passed | failed | ran             commands
//   - commit   one git commit: its hash, or true when the output named none
//   - skill    one skill used                                          skill
//   - agent    one subagent started (the Agent tool)                   description, agentId
//   - waiting  a notification, e.g. a permission prompt                notification
// Calls of the first four kinds in a row make one step; the others stand alone. `start` and `end`
// are the times of its first and last call, `count` its calls, `failed` how many failed. A step
// names at most 12 files; `more` counts the rest. A line that is not JSON is skipped.

const READ = new Set(['Read', 'Grep', 'Glob', 'LS', 'NotebookRead'])
const EDIT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
const SHELL = new Set(['Bash', 'PowerShell'])
const GROUPED = new Set(['read', 'edit', 'command', 'tool'])
const MAX_FILES = 12

// The step one event makes, or null when it is not a step of the timeline.
function stepOf(e, calls) {
  if (e.event === 'Notification') return e.notification ? { kind: 'waiting', notification: e.notification } : null
  if (e.event !== 'PostToolUse' && e.event !== 'PostToolUseFailure') return null
  if (e.test) return { kind: 'test', outcome: e.test, commands: e.commands ?? [] }
  if (e.commit) return { kind: 'commit', commit: e.commit }
  if (e.skill) return { kind: 'skill', skill: e.skill }
  if (e.tool === 'Agent' || e.tool === 'Task') return { kind: 'agent', description: calls.get(e.toolUse) ?? null, agentId: e.agentId ?? null }
  if (READ.has(e.tool)) return { kind: 'read', files: e.file ? [e.file] : [] }
  if (EDIT.has(e.tool)) return { kind: 'edit', files: e.file ? [e.file] : [] }
  if (SHELL.has(e.tool)) return { kind: 'command', commands: e.commands ?? [] }
  return e.tool ? { kind: 'tool', tools: [e.tool] } : null
}

const union = (a, b) => [...a, ...b.filter((x) => !a.includes(x))]

export function readTimeline(text, { session, agent } = {}) {
  const steps = []
  const calls = new Map()   // the Agent calls' labels, by tool_use_id
  for (const line of String(text).split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (!e || typeof e !== 'object' || e.session !== session || (e.agent ?? null) !== (agent ?? null)) continue
    if (e.event === 'PreToolUse' && e.toolUse && e.description) calls.set(e.toolUse, e.description)
    const s = stepOf(e, calls)
    if (!s) continue
    const failed = e.event === 'PostToolUseFailure' ? 1 : 0
    const last = steps.at(-1)
    if (last && last.kind === s.kind && GROUPED.has(s.kind)) {
      Object.assign(last, { end: e.at, count: last.count + 1, failed: last.failed + failed })
      for (const k of ['files', 'commands', 'tools']) if (s[k]) last[k] = union(last[k], s[k])
      continue
    }
    steps.push({ kind: s.kind, start: e.at, end: e.at, count: 1, failed, ...s })
  }
  for (const s of steps) {
    if (s.files?.length > MAX_FILES) Object.assign(s, { more: s.files.length - MAX_FILES, files: s.files.slice(0, MAX_FILES) })
  }
  return { steps }
}
