// Which ticket and branch each session and agent works on (f-agents-ticket-link, d-agents-ticket-from).
//
//   ticketIn(text)        '#37' from a task or a commit message: "#37", "issue 37", "ticket 37";
//                         the first one, null without one
//   branchTicket(branch)  '#37' from a branch name: a leading number of a part ("37-links",
//                         "feature/37-x") or "issue-37" / "ticket_37" / "gh-37"; never any number
//                         ("milestone-7-agents" names no ticket)
//   linkTickets(sessions, { worktrees, commits }) -> the sessions (readAgents) with
//                         `branch`, `ticket` and `ticketFrom` ('task' | 'branch' | 'commit' | null)
//                         on each session and each agent
//
// worktrees: `git worktree list` as [{ path, branch }], the main checkout first. An item's branch
// is that of the worktree its `cwd` lies in (the longest path that holds it); outside every
// worktree, none. commits: { branch: [{ at, subject }] }, the branch's own commits (first parent,
// no merges). The ticket comes from the agent's task (its Agent call's description), else its
// branch name, else the commits on its branch made while it ran (the oldest naming one). Commits
// on the main checkout's branch are not read: every agent there shares that branch.
// Only GitHub-style refs ("#37") are found; Build resolves them as its own links do.

const IN_TEXT = /(?:^|[^\w&/#])#(\d+)\b|\b(?:issue|ticket)\s+#?(\d+)\b/i
const IN_BRANCH = /(?:^|[/_-])(?:issue|ticket|gh)[-_]?(\d+)(?=$|[/_.-])|(?:^|\/)(\d+)(?=$|[/_.-])/i

export function ticketIn(text) {
  const m = IN_TEXT.exec(String(text ?? ''))
  return m ? '#' + (m[1] ?? m[2]) : null
}

export function branchTicket(branch) {
  const m = IN_BRANCH.exec(String(branch ?? ''))
  return m ? '#' + (m[1] ?? m[2]) : null
}

const norm = (p) => {
  const s = String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  return /^[a-z]:/i.test(s) ? s.toLowerCase() : s   // a Windows path, whose case does not matter
}

function branchAt(worktrees, cwd) {
  if (!cwd) return null
  const at = norm(cwd)
  let best = null
  for (const w of worktrees) {
    const p = norm(w.path)
    if ((at === p || at.startsWith(p + '/')) && (!best || p.length > norm(best.path).length)) best = w
  }
  return best ? best.branch ?? null : null
}

export function linkTickets(sessions, { worktrees = [], commits = {} } = {}) {
  const mainBranch = worktrees[0]?.branch ?? null
  const link = (item, task) => {
    const branch = branchAt(worktrees, item.cwd)
    let ticket = ticketIn(task), from = ticket && 'task'
    if (!ticket && (ticket = branchTicket(branch))) from = 'branch'
    if (!ticket && branch && branch !== mainBranch) {
      const ran = (c) => c.at >= item.start && (!item.end || c.at <= item.end)
      const own = (commits[branch] ?? []).filter(ran).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
      for (const c of own) if ((ticket = ticketIn(c.subject))) { from = 'commit'; break }
    }
    return { ...item, branch, ticket: ticket || null, ticketFrom: ticket ? from : null }
  }
  return sessions.map((s) => ({ ...link(s, null), agents: s.agents.map((a) => link(a, a.description)) }))
}
