// Tests of the command: `groundwork` (core/groundwork.mjs, the package's bin) run as a process.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { startCommand, runCommand } from './cli-process.test-helper.mjs'

const BIN = fileURLToPath(new URL('./groundwork.mjs', import.meta.url))

const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-cli-'))
  fs.mkdirSync(path.join(dir, 'docs', 'product', 'spec'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'spec', 'SYSTEM.md'), '# Demo\n\n_System overview_\n')
  return dir
}

test('run in a project folder, it serves that project: Plan and Build answer', async () => {
  const dir = project()
  const gw = await startCommand(process.execPath, [BIN, '--port', '0', '--no-open'], { cwd: dir })
  try {
    assert.match(gw.output, new RegExp(path.basename(dir)))
    assert.equal((await fetch(gw.url + 'plan/')).status, 200)
    assert.equal((await fetch(gw.url + 'build/')).status, 200)
    const map = await (await fetch(gw.url + 'api/plan/map')).json()
    assert.equal(map.data.nodeData.topic, 'Demo')
    const hello = await (await fetch(gw.url + 'api/build/hello')).json()
    assert.equal(hello.name, path.basename(dir))
  } finally { await gw.stop() }
})

test('below Node 20 it stops with a clear message, before starting anything', async () => {
  const fake = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-node18-')), 'node18.mjs')
  fs.writeFileSync(fake, "Object.defineProperty(process, 'version', { value: 'v18.19.0' })\nObject.defineProperty(process.versions, 'node', { value: '18.19.0' })\n")
  const r = await runCommand(process.execPath, ['--import', 'file:///' + fake.replace(/\\/g, '/').replace(/^\//, ''), BIN, '--port', '0', '--no-open'], { cwd: project() })
  assert.equal(r.code, 1)
  assert.match(r.stderr, /Node\.js 20 or newer/)
  assert.match(r.stderr, /18\.19\.0/)
  assert.doesNotMatch(r.stdout, /http:\/\//)
})

test('`groundwork plan <command>` runs the Plan module\'s command in the project: the skill\'s tool and the hook', () => {
  const dir = project()
  const show = spawnSync(process.execPath, [BIN, 'plan', 'show'], { cwd: dir, encoding: 'utf8' })
  assert.equal(show.status, 0, show.stderr)
  assert.match(show.stdout, /\[root\] Demo/)
  const hook = spawnSync(process.execPath, [BIN, 'plan', 'hook'], { cwd: dir, encoding: 'utf8', input: JSON.stringify({ cwd: dir, prompt: 'grill me' }) })
  assert.equal(hook.status, 0, hook.stderr)
  assert.match(hook.stdout, /groundwork-prd-maker/)
})

test('the bin file runs on macOS and Linux too: a node shebang and LF line ends', () => {
  const text = fs.readFileSync(BIN, 'utf8')
  assert.ok(text.startsWith('#!/usr/bin/env node\n'), 'starts with "#!/usr/bin/env node" and a bare LF')
  assert.ok(!text.includes('\r'), 'no CR anywhere: "env: node\\r" fails on macOS and Linux')
})

test('--root without a folder stops with a clear message, for the server and for init', async () => {
  for (const args of [['--root'], ['init', '--root'], ['--root', '--no-open']]) {
    const r = await runCommand(process.execPath, [BIN, ...args], { cwd: project() })
    assert.equal(r.code, 2, args.join(' '))
    assert.match(r.stderr, /--root needs a folder/, args.join(' '))
    assert.doesNotMatch(r.stdout + r.stderr, /http:\/\/|TypeError/)
  }
})

test('init is found after the options too: `groundwork --root DIR init` sets DIR up', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-cli-'))
  const r = await runCommand(process.execPath, [BIN, '--root', dir, 'init', '--yes'], { cwd: project() })
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.doesNotMatch(r.stdout, /http:\/\//)
  assert.ok(fs.existsSync(path.join(dir, '.claude', 'settings.json')))
})

test('an unknown argument stops it with a clear message', async () => {
  const r = await runCommand(process.execPath, [BIN, 'nonsense', '--no-open'], { cwd: project() })
  assert.equal(r.code, 2)
  assert.match(r.stderr, /unknown argument: nonsense/)
})
