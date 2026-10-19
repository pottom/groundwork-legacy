// The project's git worktrees and local branches, as the Agents page shows them (f-agents-worktrees,
// d-agents-git). Git is only asked to read: GIT_OPTIONAL_LOCKS=0 keeps `git status` from
// refreshing the index on the side, and the clean-up commands are only text to copy.
//
//   const repo = openWorktrees(root)
//   await repo.read() -> { available: false }
//                      | { available: true, base, items: [{ branch, head, date, worktree, base, ahead, behind,
//                                                           merged, ready, commands }] }
//
// `base` (top level) is the default branch: what origin/HEAD names, else main, master, trunk or
// develop. Each branch is measured against the integration branch it was cut from, guessed from the
// graph: among the local branches not checked out in a linked worktree (an agent's branch is never
// another's integration branch) and not merged into another of them that has moved on since, the
// one it has the fewest commits of its own against; on a tie the default branch, else the one it
// is least behind. A branch that is wholly in the branch
// (behind 0) counts only when that branch's tip is on its first-parent line: a branch merged into
// this one is not where it was cut from. One at the same commit counts only for a branch in a
// linked worktree (an agent's branch with nothing of its own yet). The default branch has no base.
//
// `merged`: nothing of its own beyond its base (`ahead` 0). `worktree` is null for a branch no
// worktree has checked out, else { path, main, locked, missing, dirty } with `dirty` the number of
// changed or untracked files. `ready`: merged, not the default branch, and either in no worktree or
// in a linked worktree that is there, unlocked (Claude Code locks an agent's worktree while it runs)
// and clean; `commands` are then the `git worktree remove` / `git branch -d` lines to copy. A
// worktree on a detached HEAD has `branch` null and is never ready.

import { execFile } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import path from 'node:path'

const MAX_BRANCHES = 100
const US = '\x1f'

export function openWorktrees(root) {
  let ROOT = root
  try { ROOT = realpathSync(root) } catch { /* not there: not a repository below */ }

  const git = (args, cwd = ROOT) => new Promise((resolve, reject) => {
    execFile('git', ['--no-pager', '-c', 'core.quotepath=off', ...args], {
      cwd, timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
    }, (error, stdout) => (error ? reject(error) : resolve(stdout)))
  })
  const gitOr = (args, fallback, cwd) => git(args, cwd).catch(() => fallback)

  // Only when the root is itself the top of a repository (path.relative: the drive letter's case may differ).
  async function available() {
    const top = (await gitOr(['rev-parse', '--show-toplevel'], '')).trim()
    try { return Boolean(top) && path.relative(ROOT, realpathSync(top)) === '' } catch { return false }
  }

  // `git worktree list --porcelain`: blocks of "worktree <path>", "HEAD <hash>", "branch <ref>" or
  // "detached", "locked [reason]", "prunable [reason]"; the first block is the main worktree.
  async function worktrees() {
    const blocks = (await git(['worktree', 'list', '--porcelain'])).replace(/\r/g, '').split('\n\n').filter((b) => b.trim())
    return blocks.map((block, i) => {
      const w = { path: '', head: '', branch: null, main: i === 0, locked: false, missing: false }
      for (const line of block.split('\n')) {
        const [key, ...rest] = line.split(' ')
        const value = rest.join(' ')
        if (key === 'worktree') w.path = path.resolve(value)
        else if (key === 'HEAD') w.head = value
        else if (key === 'branch') w.branch = value.replace(/^refs\/heads\//, '')
        else if (key === 'locked') w.locked = true
        else if (key === 'prunable') w.missing = true
      }
      if (!existsSync(w.path)) w.missing = true
      return w
    })
  }

  // The changed and untracked files of a worktree, or null when git could not tell.
  async function dirty(w) {
    if (w.missing) return null
    const out = await gitOr(['status', '--porcelain=v1', '--untracked-files=normal'], null, w.path)
    return out === null ? null : out.split('\n').filter(Boolean).length
  }

  async function defaultBranch(names) {
    const origin = (await gitOr(['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], '')).trim().replace(/^refs\/remotes\/origin\//, '')
    for (const name of [origin, 'main', 'master', 'trunk', 'develop']) if (name && names.has(name)) return name
    return null
  }

  // ahead/behind of every branch against one, in one call where git has %(ahead-behind) (2.41),
  // else one rev-list per branch.
  let oneCall = true
  async function measure(against, branches) {
    if (oneCall) {
      try {
        const out = await git(['for-each-ref', `--format=%(refname:lstrip=2)${US}%(ahead-behind:refs/heads/${against})`, 'refs/heads'])
        const counts = new Map()
        for (const line of out.split('\n').filter(Boolean)) {
          const [name, ab] = line.split(US)
          const [ahead, behind] = ab.split(' ').map(Number)
          counts.set(name, { ahead, behind })
        }
        return counts
      } catch { oneCall = false }
    }
    const counts = new Map()
    await Promise.all(branches.map(async (b) => {
      const lr = (await gitOr(['rev-list', '--left-right', '--count', `refs/heads/${against}...refs/heads/${b.name}`], '')).trim().split(/\s+/)
      if (lr.length === 2) counts.set(b.name, { behind: Number(lr[0]), ahead: Number(lr[1]) })
    }))
    return counts
  }

  // Is `tip` on the first-parent line of `branch` (below it)?
  async function onFirstParentLine(branch, tip) {
    const out = await gitOr(['rev-list', '--first-parent', '--parents', `${tip}..refs/heads/${branch}`], '')
    return out.split('\n').some((line) => line.split(' ')[1] === tip)
  }

  async function read() {
    if (!(await available())) return { available: false }
    const refLines = (await git(['for-each-ref', '--sort=-committerdate', `--format=%(refname:lstrip=2)${US}%(objectname)${US}%(committerdate:unix)${US}%(upstream)`, 'refs/heads'])).split('\n').filter(Boolean)
    const branches = refLines.slice(0, MAX_BRANCHES).map((line) => {
      const [name, hash, date, upstream] = line.split(US)
      return { name, hash, date: Number(date) || 0, upstream: Boolean(upstream) }
    })
    const names = new Set(branches.map((b) => b.name))
    const trees = await worktrees()
    await Promise.all(trees.map(async (w) => { w.dirty = await dirty(w) }))
    const treeOf = new Map(trees.filter((w) => w.branch).map((w) => [w.branch, w]))
    const base = await defaultBranch(names)

    const unlinked = branches.filter((b) => !treeOf.get(b.name) || treeOf.get(b.name).main)
    const counts = new Map(await Promise.all(unlinked.map(async (c) => [c.name, await measure(c.name, branches)])))
    // A branch merged into another that has moved on since is no longer anyone's integration branch.
    const spent = (c) => c.name !== base && unlinked.some((d) => d !== c && counts.get(d.name)?.get(c.name)?.ahead === 0 && counts.get(d.name).get(c.name).behind > 0)
    const candidates = unlinked.filter((c) => !spent(c))

    async function baseOf(b) {
      if (b.name === base) return null
      const linked = Boolean(treeOf.get(b.name) && !treeOf.get(b.name).main)
      const options = candidates.filter((c) => c.name !== b.name && counts.get(c.name)?.get(b.name))
        .map((c) => ({ c, ...counts.get(c.name).get(b.name) }))
        .sort((x, y) => x.ahead - y.ahead || (y.c.name === base) - (x.c.name === base) || x.behind - y.behind ||y.c.upstream - x.c.upstream || y.c.date - x.c.date || (x.c.name < y.c.name ? -1 : 1))
      for (const o of options) {
        if (o.behind === 0 && o.ahead === 0 && !linked) continue
        if (o.behind === 0 && o.ahead > 0 && !(await onFirstParentLine(b.name, o.c.hash))) continue
        return o
      }
      return null
    }

    const items = await Promise.all(branches.map(async (b) => {
      const w = treeOf.get(b.name) ?? null
      const o = await baseOf(b)
      const merged = Boolean(o) && o.ahead === 0
      const ready = merged && (!w || (!w.main && !w.missing && !w.locked && w.dirty === 0))
      const commands = !ready ? [] : w ? [`git worktree remove ${quote(w.path)}`, `git branch -d ${b.name}`] : [`git branch -d ${b.name}`]
      return {
        branch: b.name, head: b.hash.slice(0, 7), date: b.date,
        worktree: w && { path: w.path, main: w.main, locked: w.locked, missing: w.missing, dirty: w.dirty },
        base: o ? o.c.name : null, ahead: o ? o.ahead : null, behind: o ? o.behind : null, merged, ready, commands,
      }
    }))
    for (const w of trees.filter((t) => !t.branch)) {
      items.push({ branch: null, head: w.head.slice(0, 7), date: 0, worktree: { path: w.path, main: w.main, locked: w.locked, missing: w.missing, dirty: w.dirty }, base: null, ahead: null, behind: null, merged: false, ready: false, commands: [] })
    }
    // Worktrees first (the main one at the top), then the other branches, newest first.
    const rank = (i) => (i.worktree?.main ? 0 : i.worktree ? 1 : 2)
    items.sort((a, b) => rank(a) - rank(b) || b.date - a.date)
    return { available: true, base, items }
  }

  return { read }
}

// The agent working in each worktree and the ticket of each branch, when known, added to read()'s
// answer from the event log (the lines hook.mjs writes, oldest first) and readAgents(text)'s
// sessions:
//   - agent: the last session or subagent whose event's cwd is inside the worktree (the deepest
//     worktree when they nest), as { session, id, type, description, state }; id and type are
//     null for a session itself;
//   - ticket: "#38" in that agent's task, else a number the branch name gives as a ticket
//     ("issue-12-x", "gh-12", "12-x", "feature/12-x"), else null.
export function withAgents(answer, text, { sessions }) {
  if (!answer.available) return answer
  const trees = answer.items.filter((i) => i.worktree).map((i) => ({ item: i, at: key(i.worktree.path) })).sort((a, b) => b.at.length - a.at.length)
  const last = new Map()   // item -> { session, agent }
  const treeAt = new Map() // cwd -> the worktree it is in, or undefined
  for (const line of String(text).split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (!e || !e.session || typeof e.cwd !== 'string') continue
    if (!treeAt.has(e.cwd)) {
      const cwd = key(e.cwd)
      treeAt.set(e.cwd, trees.find((t) => cwd === t.at || cwd.startsWith(t.at + '/')))
    }
    const tree = treeAt.get(e.cwd)
    if (tree) last.set(tree.item, { session: e.session, agent: e.agent ?? null })
  }
  for (const item of answer.items) {
    const who = last.get(item)
    const s = who && sessions.find((x) => x.id === who.session)
    const a = who?.agent ? s?.agents.find((x) => x.id === who.agent) : null
    item.agent = !s ? null : a
      ? { session: s.id, id: a.id, type: a.type, description: a.description, state: a.state }
      : { session: s.id, id: null, type: null, description: null, state: s.state }
    item.ticket = /#(\d+)\b/.exec(item.agent?.description ?? '')?.[1] ?? (item.branch && ticketOf(item.branch)) ?? null
  }
  return answer
}

const ticketOf = (branch) => (/(?:^|[/_.-])(?:issues?|tickets?|gh|bug|fix|feat|feature)[-_]?(\d+)(?=$|[/_.-])/i.exec(branch) ?? /(?:^|\/)(\d+)(?=$|[-_.])/.exec(branch))?.[1] ?? null

// A path to compare: "/" separators, no trailing one, case-folded where the file system folds it.
function key(p) {
  let k = path.resolve(p)
  try { k = realpathSync(k) } catch { /* gone: as it was named */ }
  k = k.replace(/\\/g, '/').replace(/\/+$/, '')
  return process.platform === 'win32' || process.platform === 'darwin' ? k.toLowerCase() : k
}

// A path as a shell word to copy: quoted when it holds anything but plain characters.
const quote = (p) => (/^[\w./:\\-]+$/.test(p) ? p : `"${p.replace(/"/g, '\\"')}"`)
