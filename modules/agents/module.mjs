// The Agents module as the core server loads it: the Claude Code sessions and their subagents,
// as the module's hook logged them, live. It only observes (d-agents-observe).
//
//   GET /agents/              the list (index.html)
//   GET /api/agents/list      { sessions: [{ id, cwd, state, start, end, branch, ticket, ticketFrom,
//                                            agents: [{ id, type, description, state, start, end, cwd,
//                                                       branch, ticket, ticketFrom }] }] }
//                             newest session first (agents-log.mjs); the branch is that of the git
//                             worktree it works in, the ticket ('#37') from its task, branch name or
//                             commits (agent-tickets.mjs, agent-git.mjs)
//   GET /api/agents/tickets   public, for Build: { tickets: { '#37': [{ id, session, label, branch, start }] } }
//                             the running agents (and sessions) per ticket, nothing more
//   GET /api/agents/agent?session=<id>[&agent=<id>]
//                             { steps, report }: the agent's timeline (timeline.mjs; without
//                             `agent`, the main session's) and its final report (Markdown from
//                             reports/<agent>.md, or null until it stopped); 400 for a bad id
//   GET /api/agents/worktrees { available, base, items: [{ branch, worktree, base, ahead, behind, fresh, merged,
//                             ready, commands, agent, ticket }] }: the worktrees and local branches
//                             (git-worktrees.mjs); git is only asked to read, the commands are text
//                             to copy. A ref or a worktree changing is the topic "agents.git".
//   GET /api/agents/attention { items: [{ key, session, agent, reason, since, label, text: { en, hu } }], recheck }
//                             the sessions and agents that need attention (attention.mjs): waiting for
//                             permission, stalled or failed, with a line for a toast in each UI language;
//                             `recheck` is when the answer changes without an event. The manifest names
//                             it as `attention`, so the shell counts them on the tab and shows a toast.
//   All: GET and HEAD only, 405 otherwise.
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
import { needingAttention } from './attention.mjs'
import { UI_STRINGS } from './ui-strings.mjs'
import { createI18n } from '../../core/shell/i18n.mjs'
import { readTimeline } from './timeline.mjs'
import { openWorktrees, withAgents } from './git-worktrees.mjs'
import { linkTickets } from './agent-tickets.mjs'
import { readGit } from './agent-git.mjs'
import { AGENT_TOOLS, agentLabel } from './agent-names.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const HOOK = path.join(HERE, 'hook.mjs')
export const DIR = '.groundwork/agents'
const LOGS = [`${DIR}/events.1.jsonl`, `${DIR}/events.jsonl`]   // oldest first
const ID = /^[\w-]{1,60}$/   // a session or agent id, as the hook keeps it in a report's file name

// The events the hook runs on. Before a call only the Agent tool (its description labels the
// subagent; `Task` is its older name): every other tool call runs the hook once, after it.
const EVENTS = ['SessionStart', 'SubagentStart', 'SubagentStop', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop', 'SessionEnd']

const VIEW_FILES = ['index.html', 'agents.css', 'ui-strings.mjs', 'attention.mjs', 'agent-names.mjs', 'view/main.mjs', 'view/address.mjs', 'view/list.mjs', 'view/strings.mjs', 'view/time.mjs', 'view/worktrees.mjs', 'view/detail.mjs', 'view/markdown.mjs']

// The worktrees and branches (git-worktrees.mjs). A ref, HEAD or a linked worktree's HEAD or lock
// changing is the topic "agents.git".
const GIT_REFS = /^\.git\/(HEAD|packed-refs|refs\/heads\/.+|worktrees\/[^/]+\/(HEAD|locked|gitdir))$/

export default {
  id: 'agents',
  name: 'Agents',
  tagline: { en: 'Who works on what, live', hu: 'Ki min dolgozik, élőben' },
  icon: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><path d="M9.5 13v1M14.5 13v1"/>',   // a robot
  version: VERSION,
  tool: true,
  view: { dir: HERE, files: VIEW_FILES },
  writes: [DIR],
  public: ['GET /api/agents/tickets'],
  attention: '/api/agents/attention',
  watch: (p) => (LOGS.includes(p) ? 'agents.events' : GIT_REFS.test(p) ? 'agents.git' : null),
  claude: {
    hooks: EVENTS.map((event) => (event === 'PreToolUse' ? { event, matcher: AGENT_TOOLS.join('|'), script: HOOK } : { event, script: HOOK })),
  },
  api({ root, files }) {
    const log = () => LOGS.filter((f) => files.exists(f)).map((f) => files.read(f)).join('\n')
    // The sessions and agents of the log, each with its branch and ticket.
    const list = async () => {
      const { sessions } = readAgents(log())
      if (!sessions.length) return []
      const since = sessions.map((s) => s.start).sort()[0]
      return linkTickets(sessions, await readGit(root, since))
    }
    const repo = openWorktrees(root)
    // The endpoints, by subpath: each answers [status, body].
    const routes = {
      '/list': async () => [200, { sessions: await list() }],
      '/tickets': async () => [200, { tickets: runningByTicket(await list()) }],
      '/attention': async () => [200, attention(readAgents(log()).sessions, Date.now())],
      '/agent': async (url) => {
        const session = url.searchParams.get('session'), agent = url.searchParams.get('agent')
        if (!ID.test(session ?? '') || (agent != null && !ID.test(agent))) return [400, { error: 'session (and agent) must be ids' }]
        const report = agent && files.exists(`${DIR}/reports/${agent}.md`) ? files.read(`${DIR}/reports/${agent}.md`) : null
        return [200, { ...readTimeline(log(), { session, agent }), report }]
      },
      // Git failing is no error of the page: nothing to show, and why.
      '/worktrees': async () => {
        try {
          const answer = await repo.read()
          return [200, answer.available ? withAgents(answer, await list()) : answer]
        } catch (e) { return [200, { available: false, error: String(e.message).split('\n')[0] }] }
      },
    }
    return async (req, res, sub, url) => {
      const route = Object.hasOwn(routes, sub) ? routes[sub] : null
      if (!route) return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' }), true
      try {
        const [status, body] = await route(url)
        send(res, status, body)
      } catch (e) {
        send(res, 500, { error: e.message })
      }
      return true
    }
  },
}

// Who needs attention, each with the toast's line in every UI language.
const TEXTS = Object.keys(UI_STRINGS).map((lang) => [lang, createI18n(UI_STRINGS, { storage: { getItem: () => lang }, win: null }).t])
function attention(sessions, now) {
  const { items, recheck } = needingAttention(sessions, now)
  return {
    items: items.map((item) => ({
      ...item,
      text: Object.fromEntries(TEXTS.map(([lang, t]) => [lang, t(`toast.${item.reason}`, { name: item.label ?? t('session', { id: item.session.slice(0, 8) }) })])),
    })),
    recheck,
  }
}

// The running sessions and agents that work on a ticket, per ticket: what Build shows as
// "being worked on", with what it needs to link to the agent.
function runningByTicket(sessions) {
  const tickets = {}
  const add = (item, session, label) => {
    if (item.state !== 'running' || !item.ticket) return
    ;(tickets[item.ticket] ??= []).push({ id: item.id, session, label, branch: item.branch, start: item.start })
  }
  for (const s of sessions) {
    add(s, s.id, null)
    for (const a of s.agents) add(a, s.id, agentLabel(a))
  }
  return tickets
}
