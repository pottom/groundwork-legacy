// The sessions and agents that need the user's attention (f-agents-attention), from what
// readAgents (agents-log.mjs) gives. Plain functions, no imports: the server (the shell's count
// and toast, GET /api/agents/attention) and the page (the highlight, redrawn by its clock) share it.
//
//   attentionOf(item, now) -> { reason, since } | null      item: a session (with `agents`) or an agent
//     'waiting'  a prompt asks the user (a permission prompt), since it came
//     'stalled'  running, but no event for STALL_MS, since its last event; a session that has a
//                running agent is not stalled itself (it waits for the agent, which carries it)
//     'failed'   stopped with an error, since it stopped
//   Anything older than RECENT_MS is old news, not attention: a session killed without a word
//   would otherwise stay stalled or failed for good.
//
//   needingAttention(sessions, now) -> { items: [{ key, session, agent, reason, since, label }], recheck }
//     key: one per episode (`<session>/<agent>:<reason>:<since>`), so a page tells a new one from one
//     it saw; agent and label are null for a session. recheck: the ISO time the answer next changes
//     by time alone (something stalls, or grows old), or null: when to look again without an event.
//   now: ms.

export const STALL_MS = 10 * 60_000
export const RECENT_MS = 12 * 3_600_000

const ms = (iso) => Date.parse(iso)
const fresh = (since, now) => now - ms(since) < RECENT_MS
const runningAgent = (item) => (item.agents ?? []).some((a) => a.state === 'running')

// What it needs and since when, before it grows old.
function need(item, now) {
  if (item.state === 'failed' && item.end) return { reason: 'failed', since: item.end }
  if (item.state !== 'running') return null
  if (item.waiting) return { reason: 'waiting', since: item.waiting }
  if (!runningAgent(item) && now - ms(item.last) >= STALL_MS) return { reason: 'stalled', since: item.last }
  return null
}

export function attentionOf(item, now) {
  const found = need(item, now)
  return found && fresh(found.since, now) ? found : null
}

// When the item's attention changes by time alone, if it can.
function changesAt(item, now) {
  const found = need(item, now)
  if (found) return ms(found.since) + RECENT_MS
  if (item.state === 'running' && !runningAgent(item)) return ms(item.last) + STALL_MS
  return null
}

export function needingAttention(sessions, now) {
  const items = []
  let recheck = null
  const look = (item, session, agent) => {
    const at = changesAt(item, now)
    if (at != null && at > now && (recheck == null || at < recheck)) recheck = at
    const found = attentionOf(item, now)
    if (!found) return
    items.push({
      key: `${session}/${agent?.id ?? ''}:${found.reason}:${found.since}`,
      session, agent: agent?.id ?? null, ...found,
      label: agent ? agent.description || agent.type || null : null,
    })
  }
  for (const s of sessions) {
    look(s, s.id, null)
    for (const a of s.agents) look(a, s.id, a)
  }
  return { items, recheck: recheck == null ? null : new Date(recheck).toISOString() }
}
