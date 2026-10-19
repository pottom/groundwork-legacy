// What git says about where the agents work, for linkTickets (agent-tickets.mjs). Read-only
// (git-read.mjs).
//
//   readGit(root, since) -> { worktrees: [{ path, branch }], commits: { branch: [{ at, subject }] } }
//
// worktrees: `git worktree list`, the main checkout first; a detached worktree has branch null.
// commits: for each other worktree's branch, its own commits (first parent, no merges) since
// `since` (ISO, the oldest start of what is listed), newest first, at most 50; their subjects only.
// Without git, or outside a repository: no worktrees and no commits.

import { readGitIn, listWorktrees } from './git-read.mjs'

export async function readGit(root, since) {
  const git = readGitIn(root)
  let worktrees
  try { worktrees = (await listWorktrees(git)).map((w) => ({ path: w.path, branch: w.branch })) } catch { return { worktrees: [], commits: {} } }
  const commits = {}
  const branches = [...new Set(worktrees.slice(1).map((w) => w.branch).filter(Boolean))]
  await Promise.all(branches.map(async (b) => {
    const args = ['log', '--first-parent', '--no-merges', '-n', '50', '--format=%cI%x09%s']
    if (since) args.push('--since=' + since)
    const main = worktrees[0].branch && worktrees[0].branch !== b ? ['--not', 'refs/heads/' + worktrees[0].branch] : []
    const log = await git([...args, 'refs/heads/' + b, ...main, '--']).catch(() => '')
    commits[b] = log.split(/\r?\n/).filter(Boolean).map((l) => {
      const [at, ...subject] = l.split('\t')
      return { at: new Date(at).toISOString(), subject: subject.join('\t') }
    })
  }))
  return { worktrees, commits }
}
