// Tests of the npm package: what `npm pack` puts in it, and the packed tarball used from a folder
// outside the repository exactly the way a user and Claude Code use it: `npx -y @pottom/groundwork`,
// `npx -y @pottom/groundwork init`, then the hook and the skill's commands that init installed.
// npx gets the package from a registry of the test's own (a local HTTP server that serves the
// packed tarball as @pottom/groundwork), with an npm cache of its own, so nothing comes from or
// goes to npmjs.com and the user's npm cache is untouched.
// Run: node --test core/   (needs npm and npx on the PATH)

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { npm, npx, startNpx, runCommand } from './cli-process.test-helper.mjs'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const PKG = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'))
const NPM_TIMEOUT = 120000

async function npmJson(args, cwd) {
  const r = await npm(args, { cwd, timeoutMs: NPM_TIMEOUT })
  assert.equal(r.code, 0, r.stderr)
  return JSON.parse(r.stdout)[0]
}

let fileList
const packed = async () => (fileList ??= (await npmJson(['pack', '--dry-run', '--json', '--ignore-scripts'], REPO)).files.map((f) => f.path.replace(/\\/g, '/')))

test('the package is @pottom/groundwork, with the groundwork command, for Node 20 or newer', () => {
  assert.equal(PKG.name, '@pottom/groundwork')
  assert.match(PKG.version, /^\d+\.\d+\.\d+(-[\w.]+)?$/, 'a semver version')
  assert.deepEqual(PKG.bin, { groundwork: 'core/groundwork.mjs' })
  assert.equal(PKG.engines.node, '>=20')
  assert.deepEqual(PKG.dependencies ?? {}, {}, 'no dependencies: everything it needs is in the package')
})

test('the package holds the core, the modules and their bundled libraries', async () => {
  const files = await packed()
  for (const f of [
    'package.json', 'LICENSE', 'README.md',
    'core/groundwork.mjs', 'core/start.mjs', 'core/server.mjs', 'core/version.mjs', 'core/shell/theme.css',
    'core/vendor/mind-elixir/MindElixir.js', 'core/vendor/marked/marked.esm.js', 'core/vendor/fonts/inter/inter-latin-wght-normal.woff2',
    'modules/plan/module.mjs', 'modules/plan/index.html', 'modules/plan/skills/groundwork-prd-maker/SKILL.md',
    'modules/build/module.mjs', 'modules/build/index.html', 'modules/build/ticket-reader.js',
  ]) assert.ok(files.includes(f), `${f} is in the package`)
})

test('the package leaves out what it does not need: the plan, scratch notes, tests and test helpers, the Claude setup', async () => {
  // Tests are *.test.mjs, their helpers *.test-helper.mjs.
  const extra = (await packed()).filter((f) => /^(docs|\.scratch|\.claude|\.groundwork|\.github)\//.test(f) || /\.test[^/]*\.mjs$/.test(f))
  assert.deepEqual(extra, [])
})

// The packed tarball behind a registry of our own; packed and served once for the tests below.
let reg
async function registry() {
  if (reg) return reg
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-pack-')))
  const { filename, integrity, shasum } = await npmJson(['pack', '--json', '--ignore-scripts', '--pack-destination', tmp], REPO)
  const tarball = fs.readFileSync(path.join(tmp, filename))
  const requests = []
  const server = http.createServer((req, res) => {
    requests.push(req.url)
    const base = `http://localhost:${server.address().port}`
    if (req.url === '/tarball.tgz') return res.writeHead(200, { 'content-type': 'application/octet-stream' }).end(tarball)
    if (decodeURIComponent(req.url) !== '/' + PKG.name) return res.writeHead(404, { 'content-type': 'application/json' }).end('{}')
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      name: PKG.name, 'dist-tags': { latest: PKG.version },
      versions: { [PKG.version]: { ...PKG, dist: { tarball: `${base}/tarball.tgz`, integrity, shasum } } },
    }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const env = {
    ...process.env,
    npm_config_registry: `http://localhost:${server.address().port}/`,
    npm_config_cache: path.join(tmp, 'npm-cache'),
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  }
  const close = () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections() })
  return (reg = { tmp, env, requests, close })
}
after(async () => {
  if (!reg) return
  await reg.close()
  fs.rmSync(reg.tmp, { recursive: true, force: true, maxRetries: 5 })
})

// Another project, with nothing of Groundwork in it.
async function otherProject(name) {
  const projectDir = path.join((await registry()).tmp, name)
  fs.mkdirSync(path.join(projectDir, 'docs', 'product'), { recursive: true })
  fs.writeFileSync(path.join(projectDir, 'docs', 'product', 'mindmap.json'), JSON.stringify({ nodeData: { id: 'root', topic: 'Other' } }))
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# Other\n')
  return projectDir
}

const versionRe = new RegExp(PKG.version.replace(/\./g, '\\.'))

test('`npx -y @pottom/groundwork` serves another project: Plan and Build work', { timeout: 240000 }, async () => {
  const { env } = await registry()
  const projectDir = await otherProject('other project')
  const gw = await startNpx(['-y', PKG.name, '--port', '0', '--no-open'], { cwd: projectDir, env, timeoutMs: NPM_TIMEOUT })
  try {
    assert.match(gw.output, new RegExp(`groundwork ${versionRe.source}`))
    const page = await (await fetch(gw.url)).text()
    assert.match(page, /other project/)
    assert.match(page, new RegExp(`<span class="gw-version">v${versionRe.source}</span>`))
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

test('`npx -y @pottom/groundwork init` sets up another project: its hook and skill commands run this version, offline once cached', { timeout: 300000 }, async () => {
  const { env, requests, close } = await registry()
  const projectDir = await otherProject('init project')
  // Approved on the prompt, as a user types it.
  const init = await npx(['-y', PKG.name, 'init'], { cwd: projectDir, env, input: 'y\n', timeoutMs: NPM_TIMEOUT })
  assert.equal(init.code, 0, init.stdout + init.stderr)
  assert.match(init.stdout, /Apply these changes\? \[y\/N\]/)
  assert.match(fs.readFileSync(path.join(projectDir, '.gitignore'), 'utf8'), /^\.groundwork\/$/m)

  // The hook as init wrote it: our package at this version, never the unscoped npm `groundwork`.
  const [hook] = JSON.parse(fs.readFileSync(path.join(projectDir, '.claude', 'settings.json'), 'utf8')).hooks.UserPromptSubmit[0].hooks.map((h) => h.command)
  assert.match(hook, new RegExp(`^npx .*${PKG.name.replace('/', '\\/')}@${versionRe.source} plan hook$`))
  // Run as Claude Code runs it: the command through a shell, the prompt as JSON on stdin.
  const runHook = () => runCommand(hook, [], { shell: true, cwd: projectDir, env, input: JSON.stringify({ cwd: projectDir, prompt: 'grill me about this' }), timeoutMs: NPM_TIMEOUT })
  let r = await runHook()
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /load the `groundwork-prd-maker` skill/)

  // Once the package is cached, a prompt does not reach the registry at all.
  const before = requests.length
  r = await runHook()
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(requests.slice(before), [], 'no registry requests from a cached hook')

  // With the registry gone (no network), the hook and the skill's tool still work, and quickly.
  await close()
  const t = Date.now()
  r = await runHook()
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /groundwork-prd-maker/)
  assert.ok(Date.now() - t < 30000, `the hook took ${Date.now() - t} ms offline`)

  const skill = fs.readFileSync(path.join(projectDir, '.claude', 'skills', 'groundwork-prd-maker', 'SKILL.md'), 'utf8')
  assert.match(skill, /^name: groundwork-prd-maker$/m)
  const tool = /`(npx [^`]+) plan <command>`/.exec(skill)?.[1]
  assert.equal(tool, hook.replace(/ plan hook$/, ''), 'the skill runs the same command as the hook')
  const show = await runCommand(`${tool} plan show`, [], { shell: true, cwd: projectDir, env, timeoutMs: NPM_TIMEOUT })
  assert.equal(show.code, 0, show.stderr)
  assert.match(show.stdout, /\[root\] Other/)
})
