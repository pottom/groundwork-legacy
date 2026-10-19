// The Agents module as the core server loads it: the Claude Code sessions and their subagents,
// as the module's hook logged them, live. It only observes (d-agents-observe).
//
//   GET /agents/              the list (index.html)
//   GET /api/agents/list      { sessions: [{ id, cwd, state, start, end,
//                                            agents: [{ id, type, description, state, start, end }] }] }
//                             newest session first (agents-log.mjs); GET and HEAD only, 405 otherwise
//   GET /api/agents/worktrees { available, base, items: [{ branch, worktree, base, ahead, behind, merged,
//                             ready, commands, agent, ticket }] }: the worktrees and local branches
//                             (git-worktrees.mjs); git is only asked to read, the commands are text
//                             to copy. A ref or a worktree changing is the topic "agents.git".
//
// The hook (hook.mjs) is a Claude Code command hook that `groundwork init` copies into the project
// and runs with `node` (claude.hooks below, `script`): it appends one redacted line per event to
// .groundwork/agents/events.jsonl, moving a full log aside to events.1.jsonl. The server only reads
// those two files; nothing else in the module writes. A change of the log is the topic
// "agents.events", on which the open page asks for the list again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { readAgents } from './agents-log.mjs'
import { openWorktrees, withAgents } from './git-worktrees.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const HOOK = path.join(HERE, 'hook.mjs')
export const DIR = '.groundwork/agents'
const LOGS = [`${DIR}/events.1.jsonl`, `${DIR}/events.jsonl`]   // oldest first

// The events the hook runs on. Before a call only the Agent tool (its description labels the
// subagent; `Task` is its older name): every other tool call runs the hook once, after it.
const EVENTS = ['SessionStart', 'SubagentStart', 'SubagentStop', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'SessionEnd']

const VIEW_FILES = ['index.html', 'agents.css', 'ui-strings.mjs', 'view/main.mjs', 'view/list.mjs', 'view/strings.mjs', 'view/time.mjs', 'view/worktrees.mjs']

// The worktrees and branches (git-worktrees.mjs). A ref, HEAD or a linked worktree's HEAD or lock
// changing is the topic "agents.git".
const GIT_REFS = /^\.git\/(HEAD|packed-refs|refs\/heads\/.+|worktrees\/[^/]+\/(HEAD|locked|gitdir))$/
async function worktrees(repo, files) {
  const text = readLog(files)
  return withAgents(await repo.read(), text, readAgents(text))
}
const readLog = (files) => LOGS.filter((f) => files.exists(f)).map((f) => files.read(f)).join('\n')

export default {
  id: 'agents',
  name: 'Agents',
  tagline: { en: 'Who works on what, live', hu: 'Ki min dolgozik, élőben' },
  icon: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><path d="M9.5 13v1M14.5 13v1"/>',   // a robot
  version: VERSION,
  tool: true,
  view: { dir: HERE, files: VIEW_FILES },
  writes: [DIR],
  public: [],
  watch: (p) => (LOGS.includes(p) ? 'agents.events' : GIT_REFS.test(p) ? 'agents.git' : null),
  claude: {
    hooks: EVENTS.map((event) => (event === 'PreToolUse' ? { event, matcher: 'Agent|Task', script: HOOK } : { event, script: HOOK })),
  },
  api({ root, files }) {
    const repo = openWorktrees(root)
    return async (req, res, sub) => {
      if (sub !== '/list' && sub !== '/worktrees') return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' }), true
      if (sub === '/worktrees') {
        try { send(res, 200, await worktrees(repo, files)) } catch (e) { send(res, 200, { available: false, error: String(e.message).split('\n')[0] }) }
        return true
      }
      try {
        send(res, 200, readAgents(LOGS.filter((f) => files.exists(f)).map((f) => files.read(f)).join('\n')))
      } catch (e) {
        send(res, 500, { error: e.message })
      }
      return true
    }
  },
}
