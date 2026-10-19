// What git says about where the agents work, for linkTickets (agent-tickets.mjs). Read-only.
//
//   readGit(root, since) -> { worktrees: [{ path, branch }], commits: { branch: [{ at, subject }] } }
//
// worktrees: `git worktree list`, the main checkout first; a detached worktree has branch null.
// commits: for each other worktree's branch, its own commits (first parent, no merges) since
// `since` (ISO, the oldest start of what is listed), newest first, at most 50; their subjects only.
// Without git, or outside a repository: no worktrees and no commits.

import { execFile } from 'node:child_process'

const run = (root, args) => new Promise((resolve) => {
  execFile('git', ['--no-pager', '-c', 'core.quotepath=off', ...args], { cwd: root, timeout: 10000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
    (err, stdout) => resolve(err ? null : String(stdout)))
})

export async function readGit(root, since) {
  const out = await run(root, ['worktree', 'list', '--porcelain'])
  if (out == null) return { worktrees: [], commits: {} }
  const worktrees = []
  for (const block of out.split(/\r?\n\r?\n/)) {
    const path = /^worktree (.+)$/m.exec(block)
    if (!path) continue
    const branch = /^branch refs\/heads\/(.+)$/m.exec(block)
    worktrees.push({ path: path[1].trim(), branch: branch ? branch[1].trim() : null })
  }
  const commits = {}
  const branches = [...new Set(worktrees.slice(1).map((w) => w.branch).filter(Boolean))]
  await Promise.all(branches.map(async (b) => {
    const args = ['log', '--first-parent', '--no-merges', '-n', '50', '--format=%cI%x09%s']
    if (since) args.push('--since=' + since)
    const main = worktrees[0].branch && worktrees[0].branch !== b ? ['--not', 'refs/heads/' + worktrees[0].branch] : []
    const log = await run(root, [...args, 'refs/heads/' + b, ...main, '--'])
    commits[b] = (log ?? '').split(/\r?\n/).filter(Boolean).map((l) => {
      const [at, ...subject] = l.split('\t')
      return { at: new Date(at).toISOString(), subject: subject.join('\t') }
    })
  }))
  return { worktrees, commits }
}
