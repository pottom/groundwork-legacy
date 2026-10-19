#!/usr/bin/env node
// The Agents module's Claude Code hook: `node hook.mjs`, with the hook's JSON on stdin. It appends
// one line, a summary of what happened, to <project>/.groundwork/agents/events.jsonl, and says
// nothing (on some events Claude Code reads a hook's stdout as context).
//
// `groundwork init` copies this file into a project as .claude/hooks/groundwork-agents-hook.mjs and
// runs it with `node` for SessionStart, SubagentStart, SubagentStop, PreToolUse (the Agent tool
// only), PostToolUse, PostToolUseFailure, Notification, Stop and SessionEnd (module.mjs). So it is
// one file that needs only Node, and it stays small: a direct `node` start costs ~60 ms per call
// where `npx` costs ~0.7 s (q-agents-hook-speed).
//
// The project is CLAUDE_PROJECT_DIR (which Claude Code sets), else the hook's cwd. A subagent's
// events carry `agent_id` and `agent_type` (q-agents-hook-fields); the main session's do not.
//
// What a line holds (version 1), and nothing else:
//   { v: 1, at: ISO time, event: hook_event_name, session: session_id, agent?, agentType?, cwd,
//     tool?, toolUse?: tool_use_id, file?: the path a tool touched (relative to cwd when inside it),
//     commands?: the names of the commands a shell ran (`npm`, `git`; no arguments), skill?, ms?,
//     subagentType?, description? (the Agent tool's short label, PreToolUse), agentId?, status?
//     (the Agent tool's result, PostToolUse), interrupted? (PostToolUseFailure),
//     notification? (notification_type), source? (SessionStart), reason? (SessionEnd) }
// Never a prompt, a file's content, a command's arguments, a tool's output, an error text, a
// message, a URL or a search pattern: those can hold secrets (d-agents-redact).
//
// A log over 2 MB moves aside to events.1.jsonl (replacing an older one) before the line is written.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_BYTES = 2_000_000
const NAME = /^[\w.+@-]{1,60}$/

// A short plain value: a one-word name or status, else nothing.
const word = (v) => (typeof v === 'string' && NAME.test(v) ? v : undefined)

// A short one-line label (the Agent tool's description), cut at 80 characters.
const label = (v) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : undefined)

// The path a tool touched, relative to cwd when inside it, "/"-separated.
function fileOf(input, cwd) {
  const p = [input?.file_path, input?.notebook_path, input?.path].find((x) => typeof x === 'string' && x)
  if (!p || p.length > 400) return undefined
  const rel = cwd && path.isAbsolute(p) ? path.relative(cwd, p) : p
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel)
  return (inside ? rel : p).split(path.sep).join('/')
}

// The names of the commands a shell line runs: the first word of each part (after `&&`, `;`, `|`
// ...), without leading VAR=value assignments, its folder or `.exe`. No arguments.
export function commandNames(line) {
  if (typeof line !== 'string') return undefined
  const names = []
  for (const part of line.split(/&&|\|\||[;|\n]/)) {
    const words = part.trim().replace(/^[({\s]+/, '').split(/\s+/).filter((w) => !/^[A-Za-z_]\w*=/.test(w))
    const first = (words[0] ?? '').replace(/^["']|["']$/g, '').split(/[\\/]/).pop().replace(/\.exe$/i, '')
    if (NAME.test(first) && !names.includes(first)) names.push(first)
  }
  return names.length ? names.slice(0, 8) : undefined
}

// The line for one hook input: only what the module needs to show agents and their steps.
export function summarize(i, now = new Date()) {
  const ti = i.tool_input && typeof i.tool_input === 'object' ? i.tool_input : {}
  const tr = i.tool_response && typeof i.tool_response === 'object' ? i.tool_response : {}
  const isAgent = i.tool_name === 'Agent' || i.tool_name === 'Task'
  const e = {
    v: 1,
    at: now.toISOString(),
    event: word(i.hook_event_name),
    session: word(i.session_id),
    agent: word(i.agent_id),
    agentType: word(i.agent_type),
    cwd: typeof i.cwd === 'string' ? i.cwd : undefined,
    tool: word(i.tool_name),
    toolUse: word(i.tool_use_id),
    file: fileOf(ti, i.cwd),
    commands: typeof ti.command === 'string' ? commandNames(ti.command) : undefined,
    skill: i.tool_name === 'Skill' ? word(ti.skill) : undefined,
    ms: Number.isFinite(i.duration_ms) ? Math.round(i.duration_ms) : undefined,
    subagentType: isAgent ? word(ti.subagent_type) : undefined,
    description: isAgent && i.hook_event_name === 'PreToolUse' ? label(ti.description) : undefined,
    agentId: isAgent ? word(tr.agentId) : undefined,
    status: isAgent ? word(tr.status) : undefined,
    interrupted: typeof i.is_interrupt === 'boolean' ? i.is_interrupt : undefined,
    notification: word(i.notification_type),
    source: word(i.source),
    reason: word(i.reason),
  }
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k]
  return e
}

function main() {
  let input = {}
  try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}') } catch { return }
  if (!input || typeof input !== 'object' || !input.hook_event_name) return
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
  const dir = path.join(root, '.groundwork', 'agents')
  const log = path.join(dir, 'events.jsonl')
  fs.mkdirSync(dir, { recursive: true })
  try { if (fs.statSync(log).size > MAX_BYTES) fs.renameSync(log, path.join(dir, 'events.1.jsonl')) } catch {}
  fs.appendFileSync(log, JSON.stringify(summarize(input)) + '\n')
}

// Run as the hook (not when a test imports it); whatever happens, Claude's tool call goes on.
const self = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (self) {
  try { main() } catch (e) { process.stderr.write(`groundwork agents hook: ${e.message}\n`) }
}
