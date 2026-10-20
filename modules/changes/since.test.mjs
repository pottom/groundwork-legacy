// A change file's version at the last commit (since.mjs): the base of the marks, or none.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { committed, isCommitPath } from './since.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-changes-since-'))
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'ignore' })
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text) }
const FILE = 'docs/product/changes/C-001-x.md'

test('in a folder without git there is no base, and no error', () => {
  const root = tmp()
  write(root, FILE, 'now')
  assert.equal(committed(root, FILE), null)
})

test('a file not committed yet has no base; a committed one has its text at HEAD, whatever is on disk now', () => {
  const root = tmp()
  git(root, 'init', '-q')
  write(root, FILE, 'first')
  assert.equal(committed(root, FILE), null, 'no commit at all')
  git(root, 'add', '.'); git(root, 'commit', '-q', '-m', 'one')
  write(root, FILE, 'second')
  assert.equal(committed(root, FILE), 'first')
  write(root, 'docs/product/changes/C-002-y.md', 'new')
  assert.equal(committed(root, 'docs/product/changes/C-002-y.md'), null, 'a new file')
  git(root, 'add', '.'); git(root, 'commit', '-q', '-m', 'two')
  assert.equal(committed(root, FILE), 'second', 'after a commit the base is the new version')
})

test('a project in a subfolder of the repository reads its files from there', () => {
  const repo = tmp()
  git(repo, 'init', '-q')
  write(repo, path.join('app', FILE), 'inner')
  git(repo, 'add', '.'); git(repo, 'commit', '-q', '-m', 'one')
  assert.equal(committed(path.join(repo, 'app'), FILE), 'inner')
})

test('a path that cannot name a file in the project gives no base', () => {
  const root = tmp()
  assert.equal(committed(root, '../outside.md'), null)
  assert.equal(committed(root, '-p'), null)
})

test('a commit is a change of HEAD or a branch under .git', () => {
  for (const p of ['.git/HEAD', '.git/refs/heads/main', '.git/refs/heads/feature/x', '.git/packed-refs']) assert.ok(isCommitPath(p), p)
  for (const p of ['.git/index', '.git/objects/ab/cd', 'docs/HEAD', '.git/refs/remotes/origin/main']) assert.ok(!isCommitPath(p), p)
})
