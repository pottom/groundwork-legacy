// `groundwork record list|show <id>`: Claude's way into the record store, run as a process.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../cli-process.test-helper.mjs'
import { openRecords } from './store.mjs'
import { MODULES } from '../modules.mjs'

const BIN = fileURLToPath(new URL('../groundwork.mjs', import.meta.url))
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-record-cli-'))
const record = (cwd, ...args) => runCommand(process.execPath, [BIN, 'record', ...args], { cwd })

function seed(root) {
  const store = openRecords(root, MODULES)
  store.create('I', { fields: { title: 'Quick tabs', author: 'claude' }, body: 'Ctrl+1..9.' }, { by: 'claude' })
  store.create('I', { fields: { title: 'Keyboard tabs', links: ['I-1'] } }, { by: 'human' })
  store.update('I-1', { fields: { status: 'considering' } }, { by: 'claude' })
}

test('record list prints every record: id, state, title', async () => {
  const dir = project()
  seed(dir)
  const r = await record(dir, 'list')
  assert.equal(r.code, 0, r.stderr)
  const lines = r.stdout.trim().split('\n')
  assert.equal(lines.length, 2)
  assert.match(lines[0], /^I-1\s+considering\s+Quick tabs$/)
  assert.match(lines[1], /^I-2\s+new\s+Keyboard tabs$/)
  assert.equal((await record(dir, 'list', '--type', 'X')).stdout, '')
})

test('record show prints one record: its fields, body, history, and who refers to it', async () => {
  const dir = project()
  seed(dir)
  const r = await record(dir, 'show', 'I-1')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /^I-1 docs\/product\/ideas\/I-001-quick-tabs\.md\n/)
  assert.match(r.stdout, /\ntitle: Quick tabs\n/)
  assert.match(r.stdout, /\nstatus: considering\n/)
  assert.match(r.stdout, /\nCtrl\+1\.\.9\.\n/)
  assert.match(r.stdout, /\nHistory:\n {2}\S+ · claude · created\n {2}\S+ · claude · status: new → considering\n/)
  assert.match(r.stdout, /\nLinked from: I-2\n/)
})

test('--root names the project; a wrong call exits 1 with a message', async () => {
  const dir = project()
  seed(dir)
  const r = await record(os.tmpdir(), 'list', '--root', dir)
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /I-2/)
  for (const args of [['show', 'I-9'], ['show'], ['nonsense'], [], ['list', '--colour', 'red']]) {
    const bad = await record(dir, ...args)
    assert.equal(bad.code, 1, args.join(' '))
    assert.match(bad.stderr, /groundwork record/)
  }
})
