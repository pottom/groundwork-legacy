// The sessions and agents the event log tells of (the lines hook.mjs writes, oldest first).
//
//   readAgents(text) -> { sessions: [{ id, cwd, state, start, end, last, waiting,
//                                       agents: [{ id, type, description, state, start, end, cwd, last, waiting }] }] }
//
// An agent's cwd is that of its latest event: a worktree agent works in its worktree.
// Newest session first (by its latest event); its agents in the order they started. Times are the
// hook's ISO stamps; `end` is null while running. States:
//   - a session is `running` until a Stop or SessionEnd, `done` after one; any later event (the
//     next prompt's tool calls) makes it running again;
//   - an agent (a subagent: the events with an `agent` id) is `running` from SubagentStart (or its
//     first event, when the start was rotated away) until SubagentStop (`done`); `failed` when the
//     Agent call that started it failed (PostToolUseFailure), or when its session ended first.
// An agent's label is the `description` of the Agent call that started it. SubagentStart does not
// name that call, so a start takes the oldest open call of its session for the same agent type;
// the call's result (PostToolUse, `agentId`) then confirms which agent it started. Parallel
// agents of one type may start in another order than their calls: when a result names an agent
// that had taken another call, the two swap, so the agent the result's call had been given takes
// the other's call (and its label).
// `last` is the time of its latest event (a session's counts its agents' events too): what
// attention.mjs measures a stall by. `waiting` is the time a prompt that asks the user (a
// Notification of a WAITS type, e.g. permission_prompt) came, until the next event of the same
// agent (or, for the session, any next event of it): null when nothing waits. A Notification
// carries the subagent's agent_id only if Claude Code sends one (the docs show none): without it,
// the session waits, which is where the user answers anyway.
// A line that is not JSON is skipped (log-lines.mjs).

import { logEvents } from './log-lines.mjs'
import { isAgentTool } from './agent-names.mjs'

export const WAITS = new Set(['permission_prompt', 'elicitation_dialog', 'elicitation_url_dialog'])

export function readAgents(text) {
  const sessions = new Map()
  const session = (e) => {
    let s = sessions.get(e.session)
    if (!s) {
      s = { id: e.session, cwd: e.cwd ?? null, state: 'running', start: e.at, end: null, last: e.at, waiting: null, agents: new Map(), calls: [] }
      sessions.set(e.session, s)
    }
    return s
  }
  const agentOf = (s, e) => {
    let a = s.agents.get(e.agent)
    if (!a) {
      a = { id: e.agent, type: e.agentType ?? null, description: null, state: 'running', start: e.at, end: null, cwd: null, last: e.at, waiting: null }
      s.agents.set(e.agent, a)
    }
    return a
  }
  const finish = (a, state, at) => { if (a.state === 'running') Object.assign(a, { state, end: at, waiting: null }) }

  for (const e of logEvents(text)) {
    if (!e.session || !e.event) continue
    const s = session(e)
    s.last = e.at
    const asks = e.event === 'Notification' && WAITS.has(e.notification)
    if (asks && !e.agent) s.waiting = e.at
    else if (e.event !== 'Notification') s.waiting = null
    if (e.event === 'Stop' || e.event === 'SessionEnd') Object.assign(s, { state: 'done', end: e.at })
    else if (!e.agent || e.event !== 'SubagentStop') Object.assign(s, { state: 'running', end: null })
    if (e.event === 'SessionEnd') for (const a of s.agents.values()) finish(a, 'failed', e.at)

    if (e.agent) {
      const a = agentOf(s, e)
      if (e.cwd) a.cwd = e.cwd
      a.last = e.at
      if (asks) a.waiting = e.at
      else if (e.event !== 'Notification') a.waiting = null
      if (e.event === 'SubagentStart') {
        const call = s.calls.find((c) => !c.agent && c.type === a.type)
        if (call) { call.agent = a.id; a.description = call.description }
      }
      if (e.event === 'SubagentStop') finish(a, 'done', e.at)
      continue
    }
    if (!isAgentTool(e.tool)) continue
    if (e.event === 'PreToolUse') s.calls.push({ id: e.toolUse, type: e.subagentType ?? null, description: e.description ?? null, agent: null, confirmed: false })
    const call = s.calls.find((c) => c.id === e.toolUse)
    if (!call) continue
    if (e.event === 'PostToolUse' && e.agentId) {
      // The agent the start gave this call, and the call the start gave the named agent, swap.
      const guessed = call.agent
      const taken = s.calls.find((c) => c !== call && c.agent === e.agentId && !c.confirmed)
      if (taken) {
        taken.agent = guessed
        const other = guessed && s.agents.get(guessed)
        if (other) other.description = taken.description
      }
      Object.assign(call, { agent: e.agentId, confirmed: true })
      const a = s.agents.get(e.agentId)
      if (a) a.description = call.description
    }
    if (e.event === 'PostToolUseFailure' && call.agent && s.agents.get(call.agent)) finish(s.agents.get(call.agent), 'failed', e.at)
  }

  return {
    sessions: [...sessions.values()]
      .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
      .map(({ id, cwd, state, start, end, last, waiting, agents }) => ({ id, cwd, state, start, end, last, waiting, agents: [...agents.values()] })),
  }
}
