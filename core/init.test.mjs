// Tests of `groundwork init`: what it puts into a project for Claude Code (the modules' skills,
// their hooks, the .groundwork/ line of .gitignore), and that it writes only after approval.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const BIN = fileURLToPath(new URL('./groundwork.mjs', import.meta.url))

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-init-'))
const read = (dir, p) => fs.readFileSync(path.join(dir, p), 'utf8')
const exists = (dir, p) => fs.existsSync(path.join(dir, p))

// Runs `groundwork init ...args` in dir, typing `input` on its stdin: { code, stdout, stderr }.
function init(dir, args = [], input = '') {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [BIN, 'init', ...args], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => p.kill(), 10000)
    let stdout = '', stderr = ''
    p.stdout.on('data', (c) => (stdout += c))
    p.stderr.on('data', (c) => (stderr += c))
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
    p.stdin.end(input)
  })
}

test('before writing, init lists the planned changes and asks; answered no, it writes nothing', async () => {
  const dir = project()
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules/\n')
  const r = await init(dir, [], 'n\n')
  assert.equal(r.code, 1)
  assert.match(r.stdout, /\.claude[\\/]skills[\\/]groundwork-prd-maker/)
  assert.match(r.stdout, /\.claude[\\/]settings\.json/)
  assert.match(r.stdout, /UserPromptSubmit/)
  assert.match(r.stdout, /\.gitignore/)
  assert.match(r.stdout, /Apply these changes\? \[y\/N\]/)
  assert.match(r.stdout, /Nothing was changed/)
  assert.deepEqual(fs.readdirSync(dir), ['.gitignore'])
  assert.equal(read(dir, '.gitignore'), 'node_modules/\n')
})

test('with no answer at all (stdin closed) it writes nothing', async () => {
  const dir = project()
  const r = await init(dir)
  assert.equal(r.code, 1)
  assert.deepEqual(fs.readdirSync(dir), [])
})

const SKILL = fileURLToPath(new URL('../modules/plan/skills/groundwork-prd-maker/SKILL.md', import.meta.url))
const hookCommands = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command))

test('answered yes, it installs the skill, the hook and the .gitignore line', async () => {
  const dir = project()
  const r = await init(dir, [], 'y\n')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.equal(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), fs.readFileSync(SKILL, 'utf8'))
  const settings = JSON.parse(read(dir, '.claude/settings.json'))
  assert.deepEqual(hookCommands(settings, 'UserPromptSubmit'), ['npx groundwork plan hook'])
  assert.match(read(dir, '.gitignore'), /^\.groundwork\/$/m)
})

test('--yes applies without asking', async () => {
  const dir = project()
  const r = await init(dir, ['--yes'])
  assert.equal(r.code, 0)
  assert.doesNotMatch(r.stdout, /\[y\/N\]/)
  assert.ok(exists(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'))
})

test('the other settings and hooks of an existing settings.json are kept', async () => {
  const dir = project()
  fs.mkdirSync(path.join(dir, '.claude'))
  const before = {
    permissions: { allow: ['Bash(npm test)'] },
    hooks: {
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'echo mine' }] }],
      Stop: [{ matcher: '', hooks: [{ type: 'command', command: 'echo stop' }] }],
    },
    model: 'opus',
  }
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify(before, null, 2))
  fs.writeFileSync(path.join(dir, '.gitignore'), 'dist/')
  assert.equal((await init(dir, ['--yes'])).code, 0)
  const after = JSON.parse(read(dir, '.claude/settings.json'))
  assert.deepEqual(after.permissions, before.permissions)
  assert.equal(after.model, 'opus')
  assert.deepEqual(after.hooks.Stop, before.hooks.Stop)
  assert.deepEqual(hookCommands(after, 'UserPromptSubmit'), ['echo mine', 'npx groundwork plan hook'])
  assert.equal(read(dir, '.gitignore'), 'dist/\n# local state of the Groundwork modules\n.groundwork/\n')
})

test('run a second time, it duplicates nothing and asks nothing', async () => {
  const dir = project()
  await init(dir, ['--yes'])
  const settings = read(dir, '.claude/settings.json'), ignore = read(dir, '.gitignore')
  const r = await init(dir, [], '')
  assert.equal(r.code, 0)
  assert.match(r.stdout, /nothing to change/)
  assert.doesNotMatch(r.stdout, /\[y\/N\]/)
  assert.equal(read(dir, '.claude/settings.json'), settings)
  assert.equal(read(dir, '.gitignore'), ignore)
})

test('an out-of-date skill is listed as an update and replaced', async () => {
  const dir = project()
  await init(dir, ['--yes'])
  fs.writeFileSync(path.join(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), 'old')
  const r = await init(dir, ['--yes'])
  assert.match(r.stdout, /update\s+\.claude\/skills\/groundwork-prd-maker\//)
  assert.doesNotMatch(r.stdout, /settings\.json|\.gitignore/)
  assert.equal(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), fs.readFileSync(SKILL, 'utf8'))
})

test('a settings.json that is not valid JSON stops it before anything is written', async () => {
  const dir = project()
  fs.mkdirSync(path.join(dir, '.claude'))
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{ broken')
  const r = await init(dir, ['--yes'])
  assert.equal(r.code, 1)
  assert.match(r.stderr, /settings\.json is not valid JSON/)
  assert.equal(read(dir, '.claude/settings.json'), '{ broken')
  assert.ok(!exists(dir, '.gitignore') && !exists(dir, '.claude/skills'))
})

test('the skills and hooks come from the module manifests', async () => {
  const { planInit } = await import('./init.mjs')
  const src = path.join(project(), 'my-skill')
  fs.mkdirSync(path.join(src, 'refs'), { recursive: true })
  fs.writeFileSync(path.join(src, 'SKILL.md'), '# mine')
  fs.writeFileSync(path.join(src, 'refs', 'more.md'), 'more')
  const modules = [
    { id: 'a', name: 'A', claude: { skills: [src], hooks: [{ event: 'SessionStart', command: 'npx groundwork a hook' }] } },
    { id: 'b', name: 'B' },
  ]
  const dir = project()
  const plan = planInit({ root: dir, modules })
  assert.deepEqual(plan.changes.map((c) => c.file), ['.claude/skills/my-skill/', '.claude/settings.json', '.gitignore'])
  plan.write()
  assert.equal(read(dir, '.claude/skills/my-skill/refs/more.md'), 'more')
  assert.deepEqual(hookCommands(JSON.parse(read(dir, '.claude/settings.json')), 'SessionStart'), ['npx groundwork a hook'])
  assert.deepEqual(planInit({ root: dir, modules }).changes, [])
})
