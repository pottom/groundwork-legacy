// The sessions and agents the event log tells of (the lines hook.mjs writes, oldest first).
//
//   readAgents(text) -> { sessions: [{ id, cwd, state, start, end,
//                                       agents: [{ id, type, description, state, start, end, cwd }] }] }
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
// the call's result (PostToolUse, `agentId`) then confirms which agent it started.
// A line that is not JSON is skipped.

export function readAgents(text) {
  const sessions = new Map()
  const session = (e) => {
    let s = sessions.get(e.session)
    if (!s) {
      s = { id: e.session, cwd: e.cwd ?? null, state: 'running', start: e.at, end: null, last: e.at, agents: new Map(), calls: [] }
      sessions.set(e.session, s)
    }
    return s
  }
  const agentOf = (s, e) => {
    let a = s.agents.get(e.agent)
    if (!a) {
      a = { id: e.agent, type: e.agentType ?? null, description: null, state: 'running', start: e.at, end: null, cwd: null }
      s.agents.set(e.agent, a)
    }
    return a
  }
  const finish = (a, state, at) => { if (a.state === 'running') Object.assign(a, { state, end: at }) }

  for (const line of String(text).split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (!e || typeof e !== 'object' || !e.session || !e.event) continue
    const s = session(e)
    s.last = e.at
    if (e.event === 'Stop' || e.event === 'SessionEnd') Object.assign(s, { state: 'done', end: e.at })
    else if (!e.agent || e.event !== 'SubagentStop') Object.assign(s, { state: 'running', end: null })
    if (e.event === 'SessionEnd') for (const a of s.agents.values()) finish(a, 'failed', e.at)

    if (e.agent) {
      const a = agentOf(s, e)
      if (e.cwd) a.cwd = e.cwd
      if (e.event === 'SubagentStart') {
        const call = s.calls.find((c) => !c.agent && c.type === a.type)
        if (call) { call.agent = a.id; a.description = call.description }
      }
      if (e.event === 'SubagentStop') finish(a, 'done', e.at)
      continue
    }
    if (e.tool !== 'Agent' && e.tool !== 'Task') continue
    if (e.event === 'PreToolUse') s.calls.push({ id: e.toolUse, type: e.subagentType ?? null, description: e.description ?? null, agent: null })
    const call = s.calls.find((c) => c.id === e.toolUse)
    if (!call) continue
    if (e.event === 'PostToolUse' && e.agentId) {
      call.agent = e.agentId
      const a = s.agents.get(e.agentId)
      if (a) a.description = call.description
    }
    if (e.event === 'PostToolUseFailure' && call.agent && s.agents.get(call.agent)) finish(s.agents.get(call.agent), 'failed', e.at)
  }

  return {
    sessions: [...sessions.values()]
      .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0))
      .map(({ id, cwd, state, start, end, agents }) => ({ id, cwd, state, start, end, agents: [...agents.values()] })),
  }
}
