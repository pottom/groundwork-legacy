// Tests of the npm package: what `npm pack` puts in it, and the packed tarball installed into a
// folder outside the repository, started there the way a user starts it (`npx groundwork`).
// Run: node --test core/   (needs npm on the PATH; the install is from the local tarball only)

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync, execSync } from 'node:child_process'
import { startCommand } from './cli-process.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
const WIN = process.platform === 'win32'

// npm is npm.cmd on Windows, which runs only through a shell.
const npm = (args, cwd) => execFileSync(WIN ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', shell: WIN, stdio: ['ignore', 'pipe', 'pipe'] })

const packed = (() => {
  let list
  return () => (list ??= JSON.parse(npm(['pack', '--dry-run', '--json', '--ignore-scripts'], REPO))[0].files.map((f) => f.path.replace(/\\/g, '/')))
})()

test('the package is the groundwork command, for Node 20 or newer', () => {
  assert.equal(PKG.name, 'groundwork')
  assert.match(PKG.version, /^\d+\.\d+\.\d+(-[\w.]+)?$/, 'a semver version')
  assert.deepEqual(PKG.bin, { groundwork: 'core/groundwork.mjs' })
  assert.equal(PKG.engines.node, '>=20')
  assert.deepEqual(PKG.dependencies ?? {}, {}, 'no dependencies: everything it needs is in the package')
})

test('the package holds the core, the modules and their bundled libraries', () => {
  const files = packed()
  for (const f of [
    'package.json', 'LICENSE', 'README.md',
    'core/groundwork.mjs', 'core/start.mjs', 'core/server.mjs', 'core/version.mjs', 'core/shell/theme.css',
    'core/vendor/mind-elixir/MindElixir.js', 'core/vendor/marked/marked.esm.js', 'core/vendor/fonts/inter/inter-latin-wght-normal.woff2',
    'modules/plan/module.mjs', 'modules/plan/index.html', 'modules/plan/skills/groundwork-prd-maker/SKILL.md',
    'modules/build/module.mjs', 'modules/build/index.html', 'modules/build/ticket-reader.js',
  ]) assert.ok(files.includes(f), `${f} is in the package`)
})

test('the package leaves out what it does not need: the plan, scratch notes, tests, the Claude setup', () => {
  const extra = packed().filter((f) =>
    /^(docs|\.scratch|\.claude|\.groundwork|\.github)\//.test(f) || /\.test\.mjs$/.test(f) || f === 'core/cli-process.mjs' || f === 'core/sse-client.mjs')
  assert.deepEqual(extra, [])
})

// The packed tarball, installed globally into a prefix of its own (npm_config_prefix), so the real
// global folder is untouched and npx finds the package there, as it would after `npm install -g`.
// Packed and installed once for the tests below; removed after them.
let install
function installed() {
  if (install) return install
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-pack-')))
  const tgz = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', tmp], REPO))[0].filename
  const prefix = path.join(tmp, 'global')
  const env = { ...process.env, npm_config_prefix: prefix }
  execFileSync(WIN ? 'npm.cmd' : 'npm', ['install', '--global', '--no-audit', '--no-fund', '--offline', path.join(tmp, tgz)], { cwd: tmp, env, shell: WIN, stdio: 'ignore' })
  return (install = { tmp, env, dir: path.join(prefix, ...(WIN ? [] : ['lib']), 'node_modules', 'groundwork') })
}
after(() => { if (install) fs.rmSync(install.tmp, { recursive: true, force: true, maxRetries: 5 }) })

// Another project, with nothing of Groundwork in it.
function otherProject(name) {
  const projectDir = path.join(installed().tmp, name)
  fs.mkdirSync(path.join(projectDir, 'docs', 'product'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'docs', 'product', 'mindmap.json'), JSON.stringify({ nodeData: { id: 'root', topic: 'Other' } }))
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Other\n')
  return projectDir
}

test('installed from the packed tarball, `npx groundwork` serves another project: Plan and Build work', { timeout: 180000 }, async () => {
  const { env, dir: installedDir } = installed()
  assert.ok(!fs.readFileSync(path.join(installedDir, 'core', 'groundwork.mjs'), 'utf8').includes('\r'), 'the packed bin has LF line ends, so it runs on macOS and Linux')

  const projectDir = otherProject('other project')
  const gw = await startCommand(WIN ? 'npx.cmd' : 'npx', ['--no-install', 'groundwork', '--port', '0', '--no-open'], { cwd: projectDir, env, shell: WIN })
  try {
    assert.match(gw.output, new RegExp(`groundwork ${PKG.version.replace(/\./g, '\\.')}`))
    const page = await (await fetch(gw.url)).text()
    assert.match(page, /other project/)
    assert.match(page, new RegExp(`Groundwork ${PKG.version.replace(/\./g, '\\.')}`))
    assert.equal((await fetch(gw.url + 'plan/')).status, 200)
    assert.equal((await fetch(gw.url + 'vendor/mind-elixir/MindElixir.js')).status, 200)
    assert.equal((await (await fetch(gw.url + 'api/plan/map')).json()).data.nodeData.topic, 'Other')
    assert.equal((await fetch(gw.url + 'build/')).status, 200)
    const list = await (await fetch(gw.url + 'api/build/list')).json()
    assert.ok(list.files.some((f) => f.path === 'README.md'), 'Build reads the other project')
  } finally {
    await gw.stop()
  }
})

test('installed from the packed tarball, `npx groundwork init` sets up another project: the skill and the hook work', { timeout: 180000 }, () => {
  const { env } = installed()
  const projectDir = otherProject('init project')
  // Approved on the prompt, as a user types it.
  const out = execFileSync(WIN ? 'npx.cmd' : 'npx', ['--no-install', 'groundwork', 'init'], { cwd: projectDir, env, shell: WIN, encoding: 'utf8', input: 'y\n' })
  assert.match(out, /Apply these changes\? \[y\/N\]/)

  const skill = fs.readFileSync(path.join(projectDir, '.claude', 'skills', 'groundwork-prd-maker', 'SKILL.md'), 'utf8')
  assert.match(skill, /^name: groundwork-prd-maker$/m)
  assert.match(skill, /npx groundwork plan apply/)
  assert.match(fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8'), /^\.groundwork\/$/m)

  // The hook, run as Claude Code runs it: its command through a shell, the prompt as JSON on stdin.
  const [command] = JSON.parse(fs.readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8')).hooks.UserPromptSubmit[0].hooks.map((h) => h.command)
  const hook = execSync(command, { cwd: projectDir, env, encoding: 'utf8', input: JSON.stringify({ cwd: projectDir, prompt: 'grill me about this' }) })
  assert.match(hook, /load the `groundwork-prd-maker` skill/)

  // The skill's tool works there too.
  const show = execFileSync(WIN ? 'npx.cmd' : 'npx', ['--no-install', 'groundwork', 'plan', 'show'], { cwd: projectDir, env, shell: WIN, encoding: 'utf8' })
  assert.match(show, /\[root\] Other/)
})
