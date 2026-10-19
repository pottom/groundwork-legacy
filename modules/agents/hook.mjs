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
//     notification? (notification_type), source? (SessionStart), reason? (SessionEnd),
//     test?: passed | failed | ran (a shell call that ran tests, from a vetted list of test
//     commands; the outcome from the call failing or the output's pass/fail counts),
//     commit?: the short hash a `git commit` printed, or true }
// Never a prompt, a file's content, a command's arguments, a tool's output, an error text, a
// message, a URL or a search pattern: those can hold secrets (d-agents-redact).
//
// A log over 2 MB moves aside to events.1.jsonl (replacing an older one) before the line is written.
//
// The one exception is a subagent's final report (SubagentStop's last_assistant_message): it is
// kept apart, in reports/<agent_id>.md, with what looks like a secret (keys, tokens, passwords,
// a URL's credentials and query) taken out, capped at 40 000 characters; the newest 200 stay.

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

// The words of each part of a shell line, without leading VAR=value assignments; the first one
// without its folder or `.exe`.
function parts(line) {
  return line.split(/&&|\|\||[;|\n]/).map((part) => {
    const w = part.trim().replace(/^[({\s]+/, '').split(/\s+/).filter((x) => x && !/^[A-Za-z_]\w*=/.test(x)).map((x) => x.replace(/^["']|["']$/g, ''))
    if (w.length) w[0] = w[0].split(/[\\/]/).pop().replace(/\.exe$/i, '').toLowerCase()
    return w
  }).filter((w) => w.length)
}

const RUNNERS = new Set(['vitest', 'jest', 'mocha', 'ava', 'tap', 'pytest', 'tox', 'phpunit', 'rspec', 'playwright', 'cypress'])
const TEST_WORD = new Set(['npm', 'pnpm', 'yarn', 'bun', 'go', 'cargo', 'dotnet', 'mvn', 'gradle', 'gradlew', 'deno', 'mix', 'swift'])

// Whether a shell line runs tests: a vetted list of test commands, nothing guessed from arguments.
export function runsTests(line) {
  return parts(line).some(([cmd, a, b]) =>
    RUNNERS.has(cmd)
    || (TEST_WORD.has(cmd) && (a === 'test' || a === 't' || (a === 'run' && /^test/.test(b ?? ''))))
    || ((cmd === 'npx' || cmd === 'pnpx' || cmd === 'bunx') && RUNNERS.has(a))
    || (cmd === 'node' && line.includes('--test'))
    || (/^python3?$|^py$/.test(cmd) && a === '-m' && /^(pytest|unittest)$/.test(b ?? '')))
}

// Whether a shell line makes a git commit (`git commit`, `git -C dir commit`).
function commits(line) {
  return parts(line).some(([cmd, ...rest]) => {
    if (cmd !== 'git') return false
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '-C' || rest[i] === '-c') { i++; continue }
      if (rest[i].startsWith('-')) continue
      return rest[i] === 'commit'
    }
    return false
  })
}

// A test run's outcome: failed when the call failed or the output counts failures, passed when it
// counts none, else only that it ran. Only the word is kept, never the output.
function outcome(input, response) {
  if (input.hook_event_name === 'PostToolUseFailure') return 'failed'
  const out = [response.stdout, response.stderr].filter((x) => typeof x === 'string').join('\n').slice(-8000)
  const fails = [...out.matchAll(/\b(\d+)\s+(?:failed|failing|failures?)\b|\b(?:fail|failed|failures?)\b[ \t:=]+(\d+)/gi)].map((m) => +(m[1] ?? m[2]))
  if (fails.some((n) => n > 0) || /^FAIL\b/m.test(out)) return 'failed'
  if (fails.length || /\b\d+\s+pass(?:ed|ing)?\b|\bpass(?:ed)?\b[ \t:=]+\d+|^ok\s/im.test(out)) return 'passed'
  return 'ran'
}

// The commit a `git commit` made, from its first output line "[branch abc1234] ...", else true.
function commitOf(response) {
  const m = typeof response.stdout === 'string' && /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\]/m.exec(response.stdout)
  return m ? m[1] : true
}

// The tools that start a subagent (agent-names.mjs has the server's copy; this file stays one file).
const AGENT_TOOLS = ['Agent', 'Task']

// The line for one hook input: only what the module needs to show agents and their steps.
export function summarize(i, now = new Date()) {
  const toolInput = i.tool_input && typeof i.tool_input === 'object' ? i.tool_input : {}
  const toolResponse = i.tool_response && typeof i.tool_response === 'object' ? i.tool_response : {}
  const isAgent = AGENT_TOOLS.includes(i.tool_name)
  const ran = typeof toolInput.command === 'string' && /^Post/.test(i.hook_event_name)
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
    file: fileOf(toolInput, i.cwd),
    commands: typeof toolInput.command === 'string' ? commandNames(toolInput.command) : undefined,
    skill: i.tool_name === 'Skill' ? word(toolInput.skill) : undefined,
    test: ran && runsTests(toolInput.command) ? outcome(i, toolResponse) : undefined,
    commit: ran && commits(toolInput.command) && i.hook_event_name === 'PostToolUse' ? commitOf(toolResponse) : undefined,
    ms: Number.isFinite(i.duration_ms) ? Math.round(i.duration_ms) : undefined,
    subagentType: isAgent ? word(toolInput.subagent_type) : undefined,
    description: isAgent && i.hook_event_name === 'PreToolUse' ? label(toolInput.description) : undefined,
    agentId: isAgent ? word(toolResponse.agentId) : undefined,
    status: isAgent ? word(toolResponse.status) : undefined,
    interrupted: typeof i.is_interrupt === 'boolean' ? i.is_interrupt : undefined,
    notification: word(i.notification_type),
    source: word(i.source),
    reason: word(i.reason),
  }
  for (const k of Object.keys(e)) if (e[k] === undefined) delete e[k]
  return e
}

// A report with what looks like a secret taken out: API keys and tokens, Authorization values,
// "password: x" style pairs, private keys, a URL's user:password and query.
export function redact(text) {
  const R = '[redacted]'
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, R)
    .replace(/\b(?:sk|pk|rk)-[\w-]{8,}|\bgh[pousr]_\w{8,}|\bgithub_pat_\w+|\bxox[abprs]-[\w-]+|\bAKIA[0-9A-Z]{16}\b|\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]+|\bnpm_\w{20,}/g, R)
    .replace(/\b(Bearer|Basic|token)(\s+)[\w.~+/=-]{8,}/gi, `$1$2${R}`)
    .replace(/(\b[\w-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credentials?)\b["']?\s*[:=]\s*)(["']?)[^\s"'`,;]+/gi, `$1$2${R}`)
    .replace(/(https?:\/\/)[^\s/@?#]+@/gi, '$1')
    .replace(/(https?:\/\/[^\s?#)\]>"'`]+)\?[^\s)\]>"'`]*/gi, '$1')
}

const REPORT_MAX = 40_000
const REPORTS_KEPT = 200

// SubagentStop: the agent's closing message, redacted and capped, as reports/<agent>.md; only
// the newest 200 reports stay. It is written before the log line, so the line's change shows it.
function saveReport(input, dir) {
  const text = input.last_assistant_message
  if (input.hook_event_name !== 'SubagentStop' || typeof text !== 'string' || !/^[\w-]{1,60}$/.test(input.agent_id ?? '')) return
  const reports = path.join(dir, 'reports')
  fs.mkdirSync(reports, { recursive: true })
  const body = redact(text)
  fs.writeFileSync(path.join(reports, `${input.agent_id}.md`), body.length > REPORT_MAX ? body.slice(0, REPORT_MAX) + '\n\n…' : body)
  const names = fs.readdirSync(reports).filter((f) => f.endsWith('.md'))
  if (names.length <= REPORTS_KEPT) return
  const byAge = names.map((f) => [f, fs.statSync(path.join(reports, f)).mtimeMs]).sort((a, b) => a[1] - b[1])
  for (const [f] of byAge.slice(0, names.length - REPORTS_KEPT)) fs.rmSync(path.join(reports, f), { force: true })
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
  saveReport(input, dir)
  fs.appendFileSync(log, JSON.stringify(summarize(input)) + '\n')
}

// Run as the hook (not when a test imports it); whatever happens, Claude's tool call goes on.
const self = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (self) {
  try { main() } catch (e) { process.stderr.write(`groundwork agents hook: ${e.message}\n`) }
}
