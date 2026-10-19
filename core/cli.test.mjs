// Tests of the command: `groundwork` (core/groundwork.mjs, the package's bin) run as a process.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { startCommand } from './cli-process.mjs'

const BIN = fileURLToPath(new URL('./groundwork.mjs', import.meta.url))

const project = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-cli-'))
  fs.mkdirSync(path.join(dir, 'docs', 'product'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'mindmap.json'), JSON.stringify({ nodeData: { id: 'root', topic: 'Demo' } }))
  return dir
}

// Runs the command to its end: { code, stdout, stderr }; one still running after 10 s is killed.
function runToEnd(args, opts) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
    const timer = setTimeout(() => p.kill(), 10000)
    let stdout = '', stderr = ''
    p.stdout.on('data', (c) => (stdout += c))
    p.stderr.on('data', (c) => (stderr += c))
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
  })
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

test('under Node 20 it stops with a clear message, before starting anything', async () => {
  const fake = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-node18-')), 'node18.mjs')
  fs.writeFileSync(fake, "Object.defineProperty(process, 'version', { value: 'v18.19.0' })\nObject.defineProperty(process.versions, 'node', { value: '18.19.0' })\n")
  const r = await runToEnd(['--import', 'file:///' + fake.replace(/\\/g, '/').replace(/^\//, ''), BIN, '--port', '0', '--no-open'], { cwd: project() })
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
