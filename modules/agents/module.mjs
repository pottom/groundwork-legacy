// The Agents module as the core server loads it: the Claude Code sessions and their subagents,
// as the module's hook logged them, live. It only observes (d-agents-observe).
//
//   GET /agents/              the list (index.html)
//   GET /api/agents/list      { sessions: [{ id, cwd, state, start, end,
//                                            agents: [{ id, type, description, state, start, end }] }] }
//                             newest session first (agents-log.mjs); GET and HEAD only, 405 otherwise
//   GET /api/agents/agent?session=<id>[&agent=<id>]
//                             { steps, report }: the agent's timeline (timeline.mjs; without
//                             `agent`, the main session's) and its final report (Markdown from
//                             reports/<agent>.md, or null until it stopped); 400 for a bad id
//
// The hook (hook.mjs) is a Claude Code command hook that `groundwork init` copies into the project
// and runs with `node` (claude.hooks below, `script`): it appends one redacted line per event to
// .groundwork/agents/events.jsonl, moving a full log aside to events.1.jsonl, and a subagent's
// redacted final report to reports/<agent>.md. The server only reads those files; nothing else in
// the module writes. A change of the log is the topic
// "agents.events", on which the open page asks for the list again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { readAgents } from './agents-log.mjs'
import { readTimeline } from './timeline.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const HOOK = path.join(HERE, 'hook.mjs')
export const DIR = '.groundwork/agents'
const LOGS = [`${DIR}/events.1.jsonl`, `${DIR}/events.jsonl`]   // oldest first
const ID = /^[\w-]{1,60}$/   // a session or agent id, as the hook keeps it in a report's file name

// The events the hook runs on. Before a call only the Agent tool (its description labels the
// subagent; `Task` is its older name): every other tool call runs the hook once, after it.
const EVENTS = ['SessionStart', 'SubagentStart', 'SubagentStop', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'SessionEnd']

const VIEW_FILES = ['index.html', 'agents.css', 'ui-strings.mjs', 'view/main.mjs', 'view/list.mjs', 'view/strings.mjs', 'view/time.mjs', 'view/detail.mjs', 'view/markdown.mjs']

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
  watch: (p) => (LOGS.includes(p) ? 'agents.events' : null),
  claude: {
    hooks: EVENTS.map((event) => (event === 'PreToolUse' ? { event, matcher: 'Agent|Task', script: HOOK } : { event, script: HOOK })),
  },
  api({ files }) {
    const log = () => LOGS.filter((f) => files.exists(f)).map((f) => files.read(f)).join('\n')
    return async (req, res, sub, url) => {
      if (sub !== '/list' && sub !== '/agent') return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' }), true
      try {
        if (sub === '/agent') {
          const session = url.searchParams.get('session'), agent = url.searchParams.get('agent')
          if (!ID.test(session ?? '') || (agent != null && !ID.test(agent))) return send(res, 400, { error: 'session (and agent) must be ids' }), true
          const report = agent && files.exists(`${DIR}/reports/${agent}.md`) ? files.read(`${DIR}/reports/${agent}.md`) : null
          return send(res, 200, { ...readTimeline(log(), { session, agent }), report }), true
        }
        send(res, 200, readAgents(log()))
      } catch (e) {
        send(res, 500, { error: e.message })
      }
      return true
    }
  },
}
