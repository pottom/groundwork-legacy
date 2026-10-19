// Read-only git for the module (agent-git.mjs, git-worktrees.mjs, d-agents-git): one runner and
// one reader of `git worktree list --porcelain`. Git is only asked to read: GIT_OPTIONAL_LOCKS=0
// keeps it (`git status` above all) from refreshing the index on the side, and it never prompts.
//
//   readGitIn(root) -> git(args, cwd = root): stdout as a string; rejects when git fails or is missing
//   listWorktrees(git) -> [{ path, head, branch, main, locked, missing }]: the main worktree first;
//     branch is null on a detached HEAD; missing when git calls it prunable or the folder is gone

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ENV = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }

export function readGitIn(root) {
  return (args, cwd = root) => new Promise((resolve, reject) => {
    execFile('git', ['--no-pager', '-c', 'core.quotepath=off', ...args], {
      cwd, timeout: 10000, maxBuffer: 16 * 1024 * 1024, windowsHide: true, env: ENV,
    }, (error, stdout) => (error ? reject(error) : resolve(String(stdout))))
  })
}

// Blocks of "worktree <path>", "HEAD <hash>", "branch <ref>" or "detached", "locked [reason]",
// "prunable [reason]"; the first block is the main worktree.
export async function listWorktrees(git) {
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
  }).filter((w) => w.path)
}
