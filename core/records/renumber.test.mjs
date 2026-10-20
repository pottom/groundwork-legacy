// `groundwork record renumber`: two branches made the same number; the newer record gets a new one,
// and the references to it are rewritten under docs/product/ and in .scratch/. Run as a process,
// on a real git repository whose branches were merged.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../cli-process.test-helper.mjs'
import { openRecords } from './store.mjs'
import { MODULES } from '../modules.mjs'
import { CORE_RECORDS } from './changes.mjs'

const BIN = fileURLToPath(new URL('../groundwork.mjs', import.meta.url))
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-renumber-'))
const record = (cwd, ...args) => runCommand(process.execPath, [BIN, 'record', ...args], { cwd })
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const open = (root) => openRecords(root, [...MODULES, CORE_RECORDS])

// git in the project, each commit at the given time (so which branch is newer is known).
const gitIn = (root) => (args, date = '2026-10-01T10:00:00Z') => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
})

const SPEC = [
  '# Mag: Műszaki terv', '', '_Műszaki terv_', '',
  '## Stack {#t-stack}', '',
  '- npm-csomag · `d-npm` · döntés · C-1', '',
].join('\n')

// Two branches from one base, each making change C-2 with a ticket that names it; beta, the newer,
// also adds a Spec item from its C-2 and links its ticket to the change's file. Both are merged.
function twoBranches(root) {
  const git = gitIn(root)
  git(['init', '-q', '-b', 'main']); git(['config', 'core.autocrlf', 'false'])
  put(root, '.gitignore', '.groundwork/\n')
  const store = open(root)
  store.create('C', { fields: { title: 'Start' } })
  put(root, 'docs/product/spec/core/TECH.md', SPEC)
  git(['add', '.']); git(['commit', '-qm', 'base'])

  git(['checkout', '-qb', 'alpha'])
  open(root).create('C', { fields: { title: 'Alpha' } })
  put(root, '.scratch/records/issues/alpha.md', '# Alpha ticket\n\n**Change:** C-2\n')
  git(['add', '.']); git(['commit', '-qm', 'alpha'], '2026-10-02T10:00:00Z')

  git(['checkout', '-q', 'main']); git(['checkout', '-qb', 'beta'])
  fs.rmSync(path.join(root, '.groundwork'), { recursive: true, force: true })   // another clone: no cache
  open(root).create('C', { fields: { title: 'Beta' } })
  put(root, '.scratch/records/issues/beta.md', '# Beta ticket\n\n**Change:** C-2 ([file](../../../docs/product/changes/C-002-beta.md))\n**Spec:** d-beta\n')
  put(root, 'docs/product/spec/core/TECH.md', SPEC.replace('C-1\n', 'C-1\n- Béta · `d-beta` · döntés · C-2\n'))
  git(['add', '.']); git(['commit', '-qm', 'beta'], '2026-10-03T10:00:00Z')

  git(['checkout', '-q', 'main'])
  git(['merge', '-q', '--no-ff', '-m', 'merge alpha', 'alpha'], '2026-10-04T10:00:00Z')
  git(['merge', '-q', '--no-ff', '-m', 'merge beta', 'beta'], '2026-10-05T10:00:00Z')
  return git
}

test('renumber gives the newer of two C-2 a new number and rewrites the references to it, and only those', async () => {
  const dir = project()
  const git = twoBranches(dir)
  put(dir, 'docs/product/notes.md', 'C-2 is a fine change.\n')   // not in git: cannot tell which C-2
  assert.equal((await record(dir, 'check')).code, 1, 'the duplicate is an error before')

  const r = await record(dir, 'renumber')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /^C-2 docs\/product\/changes\/C-002-beta\.md → C-3 docs\/product\/changes\/C-003-beta\.md$/m)
  assert.match(r.stdout, /^ {2}rewrote \.scratch\/records\/issues\/beta\.md:3$/m)
  assert.match(r.stdout, /^ {2}rewrote docs\/product\/spec\/core\/TECH\.md:8$/m)
  assert.match(r.stdout, /^ {2}by hand \(which C-2\?\): docs\/product\/notes\.md:1: C-2 is a fine change\.$/m)
  assert.match(r.stdout, /GitHub tickets/)

  assert.ok(!fs.existsSync(path.join(dir, 'docs/product/changes/C-002-beta.md')))
  const beta = open(dir).get('C-3')
  assert.equal(beta.fields.title, 'Beta')
  assert.equal(beta.file, 'docs/product/changes/C-003-beta.md')
  assert.match(beta.history.at(-1), /· renumbered: C-2 → C-3$/)
  assert.match(read(dir, 'docs/product/changes/C-003-beta.md'), /^id: C-3$/m)
  assert.equal(open(dir).get('C-2').fields.title, 'Alpha')
  assert.equal(read(dir, '.scratch/records/issues/beta.md'), '# Beta ticket\n\n**Change:** C-3 ([file](../../../docs/product/changes/C-003-beta.md))\n**Spec:** d-beta\n')
  assert.equal(read(dir, '.scratch/records/issues/alpha.md'), '# Alpha ticket\n\n**Change:** C-2\n')
  assert.match(read(dir, 'docs/product/spec/core/TECH.md'), /^- Béta · `d-beta` · döntés · C-3$/m)
  assert.equal(read(dir, 'docs/product/notes.md'), 'C-2 is a fine change.\n')

  // Nothing else changed: the project's own files only, nothing outside docs/product/ and .scratch/.
  const changed = git(['status', '--porcelain', '-uall']).split('\n').filter(Boolean).map((l) => l.slice(3)).sort()
  assert.deepEqual(changed, ['.scratch/records/issues/beta.md', 'docs/product/changes/C-002-beta.md', 'docs/product/changes/C-003-beta.md', 'docs/product/notes.md', 'docs/product/spec/core/TECH.md'])
  const after = await record(dir, 'check')
  assert.equal(after.code, 0, after.stdout)
})

test('renumber with no duplicate changes nothing', async () => {
  const dir = project()
  open(dir).create('C', { fields: { title: 'Start' } })
  const before = read(dir, 'docs/product/changes/C-001-start.md')
  const r = await record(dir, 'renumber')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /no duplicate numbers/)
  assert.equal(read(dir, 'docs/product/changes/C-001-start.md'), before)
})
