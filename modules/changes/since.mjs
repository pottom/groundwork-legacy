// @ts-check
// A change file's version at the last commit: the base of the marks of what changed since
// (d-changes-since-commit). Git keeps it, so there is no "what I have seen" state: the marks survive
// a reload and another machine, and go away on commit.
//
//   committed(root, file)  -> text | null    the file at HEAD (file relative to the project root,
//                                            '/'-separated); null without git, without a commit, for
//                                            a file not committed yet, or a path outside the project
//   isCommitPath(path)     -> boolean        whether a changed path (relative to the root) means a
//                                            commit: .git/HEAD, a branch under .git/refs/heads/, or
//                                            .git/packed-refs (module.mjs: the live topic of a commit)

import { execFileSync } from 'node:child_process'

/** @param {string} root @param {string} file */
export function committed(root, file) {
  const rel = String(file).replace(/\\/g, '/')
  if (!rel || rel.startsWith('/') || rel.startsWith('-') || rel.split('/').includes('..')) return null
  try {
    // `./` reads the path from the project folder, also when it is a subfolder of the repository
    return execFileSync('git', ['show', `HEAD:./${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, maxBuffer: 8 * 1024 * 1024 })
  } catch { return null }
}

/** @param {string} p */
export const isCommitPath = (p) => p === '.git/HEAD' || p === '.git/packed-refs' || p.startsWith('.git/refs/heads/')
