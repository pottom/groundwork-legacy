// The worktrees and branches view behind the core server: GET /api/agents/worktrees over a real git
// repository, and the live topic when refs change. Git is only asked to read.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { startServer } from '../../core/server.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'
import agents from './module.mjs'

const hasGit = (() => { try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true } catch { return false } })()
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'pipe' }).toString()
const commit = (cwd, file, text = file) => { fs.writeFileSync(path.join(cwd, file), text); git(cwd, 'add', file); git(cwd, 'commit', '-q', '-m', `add ${file}`) }

async function withServer(root, fn) {
  const srv = await startServer({ root, modules: [agents], port: 0 })
  try { await fn({ srv, get: async (p) => (await fetch(`http://127.0.0.1:${srv.port}${p}`)).json() }) } finally { await srv.close() }
}

// main with one commit; milestone (cut from main, one commit); the worktree folder lives in the
// temp dir beside the repository, as an agent's would.
function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-wt-'))
  const root = path.join(dir, 'app')
  fs.mkdirSync(root)
  git(root, 'init', '-q', '-b', 'main')
  commit(root, 'a.txt')
  git(root, 'branch', 'milestone')
  git(root, 'switch', '-q', 'milestone')
  commit(root, 'm.txt')
  git(root, 'switch', '-q', 'main')
  return { dir, root }
}

const byBranch = (items) => Object.fromEntries(items.map((i) => [i.branch, i]))

test('not a git repository: nothing to show', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-wt-'))
  await withServer(root, async ({ get }) => {
    assert.deepEqual(await get('/api/agents/worktrees'), { available: false })
  })
})

test('every worktree and local branch is listed with ahead/behind its integration branch and merged state', { skip: !hasGit }, async () => {
  const { dir, root } = repo()
  const wt = path.join(dir, 'wt-feature')
  git(root, 'worktree', 'add', '-q', '-b', 'feature', wt, 'milestone')
  commit(wt, 'f.txt')
  git(root, 'branch', 'done-work', 'milestone')
  git(root, 'switch', '-q', 'done-work'); commit(root, 'd.txt'); git(root, 'switch', '-q', 'main')
  git(root, 'switch', '-q', 'milestone'); git(root, 'merge', '-q', '--no-ff', '-m', 'merge done-work', 'done-work'); git(root, 'switch', '-q', 'main')

  await withServer(root, async ({ get }) => {
    const answer = await get('/api/agents/worktrees')
    assert.equal(answer.available, true)
    assert.equal(answer.base, 'main')
    const items = byBranch(answer.items)
    assert.deepEqual(Object.keys(items).sort(), ['done-work', 'feature', 'main', 'milestone'])

    assert.equal(items.main.worktree.main, true)
    assert.equal(items.main.base, null, 'the default branch is measured against nothing')

    assert.deepEqual([items.feature.base, items.feature.ahead, items.feature.behind, items.feature.merged], ['milestone', 1, 2, false], 'cut from milestone, which moved on since')
    assert.equal(path.resolve(items.feature.worktree.path), fs.realpathSync(wt))

    assert.deepEqual([items['done-work'].base, items['done-work'].ahead, items['done-work'].merged], ['milestone', 0, true])
    assert.equal(items['done-work'].worktree, null)

    assert.deepEqual([items.milestone.base, items.milestone.ahead, items.milestone.behind, items.milestone.merged], ['main', 3, 0, false])
  })
})

test('a ref or a worktree that changes is the topic agents.git, so the open page reads the list again', { skip: !hasGit }, async () => {
  assert.equal(agents.watch('.git/refs/heads/feature/x'), 'agents.git')
  assert.equal(agents.watch('.git/HEAD'), 'agents.git')
  assert.equal(agents.watch('.git/packed-refs'), 'agents.git')
  assert.equal(agents.watch('.git/worktrees/wt-a/HEAD'), 'agents.git')
  assert.equal(agents.watch('.git/worktrees/wt-a/locked'), 'agents.git')
  assert.equal(agents.watch('.git/objects/ab/cdef'), null)
  assert.equal(agents.watch('src/app.js'), null)

  const { dir, root } = repo()
  await withServer(root, async ({ srv }) => {
    const sse = listen(srv.port)
    try {
      await sse.next((e) => e.event === 'hello')
      git(root, 'worktree', 'add', '-q', '-b', 'feature', path.join(dir, 'wt'), 'milestone')
      await sse.change('agents.git')
    } finally { sse.close() }
  })
})

test('a worktree shows the agent working in it and its ticket, when known', { skip: !hasGit }, async () => {
  const { dir, root } = repo()
  const wt = path.join(dir, 'wt-a')
  git(root, 'worktree', 'add', '-q', '-b', 'worktree-agent-a1b2', wt, 'milestone')
  git(root, 'branch', 'issue-12-login', 'milestone')
  const at = (s) => `2026-10-19T09:00:0${s}.000Z`
  const lines = [
    { v: 1, at: at(0), event: 'SessionStart', session: 's-1', cwd: root },
    { v: 1, at: at(1), event: 'PreToolUse', session: 's-1', cwd: root, tool: 'Agent', toolUse: 't1', subagentType: 'general-purpose', description: 'Build #38 worktrees' },
    { v: 1, at: at(2), event: 'SubagentStart', session: 's-1', cwd: root, agent: 'a-1', agentType: 'general-purpose' },
    { v: 1, at: at(3), event: 'PostToolUse', session: 's-1', cwd: wt, agent: 'a-1', agentType: 'general-purpose', tool: 'Edit', file: 'x.js' },
  ]
  fs.mkdirSync(path.join(root, '.groundwork', 'agents'), { recursive: true })
  fs.writeFileSync(path.join(root, '.groundwork', 'agents', 'events.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n')

  await withServer(root, async ({ get }) => {
    const items = byBranch((await get('/api/agents/worktrees')).items)
    assert.deepEqual(items['worktree-agent-a1b2'].agent, { session: 's-1', id: 'a-1', type: 'general-purpose', description: 'Build #38 worktrees', state: 'running' })
    assert.equal(items['worktree-agent-a1b2'].ticket, '#38', 'from the agent\'s task')
    assert.equal(items['issue-12-login'].ticket, '#12', 'from the branch name')
    assert.deepEqual([items['issue-12-login'].agent, items.milestone.ticket, items.milestone.agent], [null, null, null])
  })
})

test('the page reads the worktrees again on agents.git and only copies the clean-up commands, never runs them', () => {
  const read = (f) => fs.readFileSync(path.join(agents.view.dir, f), 'utf8')
  const main = read('view/main.mjs')
  assert.match(main, /fetch\('\/api\/agents\/worktrees'/)
  assert.match(main, /topics\.includes\('agents\.git'\)/)
  const view = read('view/worktrees.mjs')
  assert.match(view, /gw-badge--warn">\$\{ui\('wt\.dirty'/, 'uncommitted changes are flagged')
  assert.match(view, /ui\('wt\.ready'\)/)
  for (const src of [main, view]) assert.doesNotMatch(src, /method:\s*'POST'|fetch\([^)]*\/(run|exec)/)
})

test('a worktree with uncommitted changes is flagged; merged, clean worktrees are ready to clean up with the commands to copy', { skip: !hasGit }, async () => {
  const { dir, root } = repo()
  const add = (name) => { const wt = path.join(dir, name); git(root, 'worktree', 'add', '-q', '-b', name, wt, 'milestone'); commit(wt, `${name}.txt`); return wt }
  add('clean'); add('open')
  const dirty = add('dirty'), locked = add('locked')
  git(root, 'switch', '-q', 'milestone')
  for (const b of ['clean', 'dirty', 'locked']) git(root, 'merge', '-q', '--no-ff', '-m', `merge ${b}`, b)
  git(root, 'switch', '-q', 'main')
  fs.writeFileSync(path.join(dirty, 'clean.txt'), 'changed')
  fs.writeFileSync(path.join(dirty, 'new.txt'), 'new')
  git(root, 'worktree', 'lock', locked)
  git(root, 'branch', 'gone', 'clean')

  await withServer(root, async ({ get }) => {
    const items = byBranch((await get('/api/agents/worktrees')).items)
    assert.equal(items.dirty.worktree.dirty, 2)
    assert.equal(items.clean.worktree.dirty, 0)
    assert.equal(items.main.worktree.dirty, 0)

    assert.deepEqual([items.clean.merged, items.clean.ready], [true, true])
    assert.equal(items.clean.commands.length, 2)
    assert.match(items.clean.commands[0], /^git worktree remove .*clean"?$/)
    assert.equal(items.clean.commands[1], 'git branch -d clean')

    assert.deepEqual([items.dirty.merged, items.dirty.ready, items.dirty.commands], [true, false, []], 'its changes would be lost')
    assert.deepEqual([items.locked.merged, items.locked.worktree.locked, items.locked.ready], [true, true, false], 'an agent still holds it')
    assert.deepEqual([items.open.merged, items.open.ready], [false, false])
    assert.deepEqual([items.gone.worktree, items.gone.ready, items.gone.commands], [null, true, ['git branch -d gone']])
    assert.deepEqual([items.main.ready, items.milestone.ready], [false, false])
  })
})

test('a branch with no commits of its own yet (freshly cut) is neither merged nor ready to clean up', { skip: !hasGit }, async () => {
  const { dir, root } = repo()
  git(root, 'worktree', 'add', '-q', '-b', 'fresh', path.join(dir, 'wt-fresh'), 'milestone')
  git(root, 'branch', 'fresh-branch', 'milestone')
  git(root, 'worktree', 'add', '-q', '-b', 'behind', path.join(dir, 'wt-behind'), 'milestone')
  git(root, 'switch', '-q', 'milestone'); commit(root, 'n.txt'); git(root, 'switch', '-q', 'main')
  // Work merged with a fast-forward: its commits are on the base's line, but they are its own.
  const ff = path.join(dir, 'wt-ff')
  git(root, 'worktree', 'add', '-q', '-b', 'ff', ff, 'milestone')
  commit(ff, 'ff.txt')
  git(root, 'switch', '-q', 'milestone'); git(root, 'merge', '-q', '--ff-only', 'ff'); git(root, 'switch', '-q', 'main')

  await withServer(root, async ({ get }) => {
    const items = byBranch((await get('/api/agents/worktrees')).items)
    for (const b of ['fresh', 'fresh-branch', 'behind']) {
      assert.deepEqual([items[b].base, items[b].ahead, items[b].fresh, items[b].merged, items[b].ready, items[b].commands], ['milestone', 0, true, false, false, []], b)
    }
    assert.equal(items.behind.behind, 2)
    assert.deepEqual([items.ff.ahead, items.ff.fresh, items.ff.merged, items.ff.ready], [0, false, true, true], 'merged with a fast-forward')
  })
})

test('a branch checked out in a worktree is listed however many newer branches there are', { skip: !hasGit }, async () => {
  const { dir, root } = repo()
  const wt = path.join(dir, 'wt-old')
  git(root, 'worktree', 'add', '-q', '-b', 'old-work', wt, 'milestone')
  commit(wt, 'old.txt')
  // 105 newer branches, all at one commit newer than old-work's.
  const date = { GIT_COMMITTER_DATE: '2030-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2030-01-01T00:00:00Z' }
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'newer'], { cwd: root, stdio: 'pipe', env: { ...process.env, ...date } })
  const hash = git(root, 'rev-parse', 'HEAD').trim()
  git(root, 'reset', '-q', '--hard', 'HEAD~1')
  for (let i = 0; i < 105; i++) fs.writeFileSync(path.join(root, '.git', 'refs', 'heads', `newer-${i}`), hash + '\n')
  await withServer(root, async ({ get }) => {
    const items = byBranch((await get('/api/agents/worktrees')).items)
    assert.ok(items['old-work'], 'the worktree\'s branch is not cut off')
    assert.equal(path.resolve(items['old-work'].worktree.path), fs.realpathSync(wt))
  })
})
