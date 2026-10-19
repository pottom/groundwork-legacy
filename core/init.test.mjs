// Tests of `groundwork init`: what it puts into a project for Claude Code (the modules' skills,
// their hooks, the .groundwork/ line of .gitignore), and that it writes only after approval.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from './cli-process.test-helper.mjs'

const BIN = fileURLToPath(new URL('./groundwork.mjs', import.meta.url))
const { version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// How a project runs Groundwork after init: this version of our package, from the npx cache
// once it is there (no registry lookup on every prompt).
const RUNNER = `npx -y --prefer-offline @pottom/groundwork@${version}`
const HOOK = `${RUNNER} plan hook`

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-init-'))
const read = (dir, p) => fs.readFileSync(path.join(dir, p), 'utf8')
const exists = (dir, p) => fs.existsSync(path.join(dir, p))

// Runs `groundwork init ...args` in dir, typing `input` on its stdin: { code, stdout, stderr }.
const init = (dir, args = [], input = '', env = process.env) => runCommand(process.execPath, [BIN, 'init', ...args], { cwd: dir, input, env })

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
// The packaged skill as init installs it: {{groundwork}} becomes the command for this version.
const installedSkill = () => fs.readFileSync(SKILL, 'utf8').replaceAll('{{groundwork}}', RUNNER)
const hookCommands = (settings, event) => (settings.hooks?.[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command))

test('answered yes, it installs the skill, the hook and the .gitignore line', async () => {
  const dir = project()
  const r = await init(dir, [], 'y\n')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.equal(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), installedSkill())
  assert.ok(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md').includes(`${RUNNER} plan apply`), 'the skill runs this version of our package')
  assert.doesNotMatch(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), /\{\{|npx groundwork/)
  const settings = JSON.parse(read(dir, '.claude/settings.json'))
  assert.deepEqual(hookCommands(settings, 'UserPromptSubmit'), [HOOK])
  assert.match(read(dir, '.gitignore'), /^\.groundwork\/$/m)
})

test('it installs the Ideas skill from the Ideas manifest, its commands running this version', async () => {
  const dir = project()
  const r = await init(dir, ['--yes'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const skill = read(dir, '.claude/skills/groundwork-ideas/SKILL.md')
  const packaged = fs.readFileSync(new URL('../modules/ideas/skills/groundwork-ideas/SKILL.md', import.meta.url), 'utf8')
  assert.equal(skill, packaged.replaceAll('{{groundwork}}', RUNNER))
  assert.match(skill, /^name: groundwork-ideas$/m)
  for (const cmd of ['ideas similar', 'ideas add', 'ideas list']) assert.ok(skill.includes(`${RUNNER} ${cmd}`), cmd)
  assert.doesNotMatch(skill, /\{\{|npx groundwork/)
})

test('it installs the Sketch skill from the Sketch manifest, its commands running this version', async () => {
  const dir = project()
  const r = await init(dir, ['--yes'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const skill = read(dir, '.claude/skills/groundwork-sketch/SKILL.md')
  const packaged = fs.readFileSync(new URL('../modules/sketch/skills/groundwork-sketch/SKILL.md', import.meta.url), 'utf8')
  assert.equal(skill, packaged.replaceAll('{{groundwork}}', RUNNER))
  assert.match(skill, /^name: groundwork-sketch$/m)
  for (const cmd of ['sketch show', 'sketch apply']) assert.ok(skill.includes(`${RUNNER} ${cmd}`), cmd)
  assert.match(skill, /browser pane/i, 'for the picture it looks at the sketch in the browser pane')
  assert.doesNotMatch(skill, /\{\{|npx groundwork/)
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
  assert.deepEqual(hookCommands(after, 'UserPromptSubmit'), ['echo mine', HOOK])
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
  assert.equal(read(dir, '.claude/skills/groundwork-prd-maker/SKILL.md'), installedSkill())
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
    { id: 'a', name: 'A', claude: { skills: [src], hooks: [{ event: 'SessionStart', run: 'a hook' }] } },
    { id: 'b', name: 'B' },
  ]
  const dir = project()
  const plan = planInit({ root: dir, modules })
  assert.deepEqual(plan.changes.map((c) => c.file), ['.claude/skills/my-skill/', '.claude/settings.json', '.gitignore'])
  plan.write()
  assert.equal(read(dir, '.claude/skills/my-skill/refs/more.md'), 'more')
  assert.deepEqual(hookCommands(JSON.parse(read(dir, '.claude/settings.json')), 'SessionStart'), [`${RUNNER} a hook`])
  assert.deepEqual(planInit({ root: dir, modules }).changes, [])
})

test('an older or other form of the Plan hook is replaced by this one, not added beside it', async () => {
  const dir = project()
  fs.mkdirSync(path.join(dir, '.claude'))
  const hook = (command) => ({ type: 'command', command })
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), JSON.stringify({ hooks: { UserPromptSubmit: [
    { hooks: [hook('node "$CLAUDE_PROJECT_DIR/modules/plan/plan.mjs" hook'), hook('echo mine')] },
    { hooks: [hook('npx -y --prefer-offline @pottom/groundwork@0.0.9 plan hook')] },
    { hooks: [hook('npx groundwork plan hook')] },
  ] } }))
  const r = await init(dir, ['--yes'])
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /update\s+\.claude[\\/]settings\.json.*replace the Plan module's UserPromptSubmit hook/)
  const after = JSON.parse(read(dir, '.claude/settings.json'))
  assert.deepEqual(hookCommands(after, 'UserPromptSubmit'), [HOOK, 'echo mine'])
  assert.match((await init(dir)).stdout, /nothing to change/)
})

test('the installed skill folder mirrors the packaged one: a file the skill dropped is removed', async () => {
  const dir = project()
  await init(dir, ['--yes'])
  fs.writeFileSync(path.join(dir, '.claude/skills/groundwork-prd-maker/old-notes.md'), 'gone from the skill')
  fs.mkdirSync(path.join(dir, '.claude/skills/groundwork-prd-maker/refs'))
  fs.writeFileSync(path.join(dir, '.claude/skills/groundwork-prd-maker/refs/old.md'), 'gone too')
  fs.mkdirSync(path.join(dir, '.claude/skills/my-own'))
  fs.writeFileSync(path.join(dir, '.claude/skills/my-own/SKILL.md'), 'not ours')
  const r = await init(dir, ['--yes'])
  assert.match(r.stdout, /update\s+\.claude\/skills\/groundwork-prd-maker\/.*remove old-notes\.md, refs\/old\.md/)
  assert.deepEqual(fs.readdirSync(path.join(dir, '.claude/skills/groundwork-prd-maker')), ['SKILL.md'])
  assert.equal(read(dir, '.claude/skills/my-own/SKILL.md'), 'not ours')
})

test('init sets up the project MINDMAP_DIR names, as the server does', async () => {
  const dir = project(), other = project()
  const r = await init(other, ['--yes'], '', { ...process.env, MINDMAP_DIR: dir })
  assert.equal(r.code, 0, r.stderr)
  assert.ok(exists(dir, '.claude/settings.json'))
  assert.deepEqual(fs.readdirSync(other), [])
})

test('the planning error goes to the error output it is given', async () => {
  const { runInit } = await import('./init.mjs')
  const { MODULES } = await import('./modules.mjs')
  const dir = project()
  fs.mkdirSync(path.join(dir, '.claude'))
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), '{ broken')
  let out = '', err = ''
  const code = await runInit({ root: dir, modules: MODULES, yes: true, output: { write: (t) => (out += t) }, errors: { write: (t) => (err += t) } })
  assert.equal(code, 1)
  assert.match(err, /settings\.json is not valid JSON/)
  assert.equal(out, '')
})
