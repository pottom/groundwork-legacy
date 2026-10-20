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
import { CORE_RECORDS } from './changes.mjs'

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

test('record add <type> creates a record with the next number and prints its id and file', async () => {
  const dir = project()
  seed(dir)
  const m = await record(dir, 'add', 'M', '--title', 'Redesign')
  assert.equal(m.code, 0, m.stderr)
  assert.equal(m.stdout.trim(), 'M-1 docs/product/milestones/M-001-redesign.md')
  const c = await record(dir, 'add', 'change', '--title', 'Record store', '--ideas', 'I-1, I-2', '--milestone', 'M-1')
  assert.equal(c.code, 0, c.stderr)
  assert.equal(c.stdout.trim(), 'C-1 docs/product/changes/C-001-record-store.md')
  const again = await record(dir, 'add', 'C', '--title', 'Changes workspace', '--body', '## Probléma\n\nToo big.')
  assert.match(again.stdout, /^C-2 /)
  const store = openRecords(dir, [...MODULES, CORE_RECORDS])
  assert.deepEqual(store.get('C-1').fields, { title: 'Record store', ideas: ['I-1', 'I-2'], milestone: 'M-1', status: 'grilling' })
  assert.match(store.get('C-1').body, /^## Probléma$[\s\S]*\*\*Change:\*\* C-1/m, 'the spec skeleton')
  assert.equal(store.get('C-2').body, '## Probléma\n\nToo big.')
  assert.equal(store.get('I-3'), null)
  const idea = await record(dir, 'add', 'I', '--title', 'Third idea')
  assert.match(idea.stdout, /^I-3 docs\/product\/ideas\/I-003-third-idea\.md/)
  for (const args of [['add'], ['add', 'X', '--title', 'x'], ['add', 'C', '--colour', 'red'], ['add', 'C'], ['add', 'C', '--title', 'x', '--status', 'done']]) {
    const bad = await record(dir, ...args)
    assert.equal(bad.code, 1, args.join(' '))
    assert.match(bad.stderr, /groundwork record/)
  }
})

test('record show I-1 lists the changes that name it, record show M-1 its changes, record show C-1 its links and items', async () => {
  const dir = project()
  seed(dir)
  const store = openRecords(dir, [...MODULES, CORE_RECORDS])
  store.create('M', { fields: { title: 'Redesign' } })
  store.create('C', { fields: { title: 'Record store', ideas: ['I-1'], milestone: 'M-1' }, body: '## Javasolt elemek\n\n- add `d-rec-change` → `records/tech#t-rec-data` — Change is a record' })
  store.create('C', { fields: { title: 'Changes workspace', ideas: ['I-1', 'I-9'] } })
  const i = await record(dir, 'show', 'I-1')
  assert.match(i.stdout, /\nLinked from: I-2, C-1, C-2\n/)
  const m = await record(dir, 'show', 'M-1')
  assert.match(m.stdout, /\nLinked from: C-1\n/)
  const c = await record(dir, 'show', 'C-2')
  assert.match(c.stdout, /\nLinks:\n {2}ideas: I-1 \(idea: Quick tabs\)\n {2}ideas: I-9 \(idea\)\n/)
  const c1 = await record(dir, 'show', 'C-1')
  assert.match(c1.stdout, /\n {2}milestone: M-1 \(milestone: Redesign\)\n/)
  assert.match(c1.stdout, /\nProposed items:\n {2}add d-rec-change → records\/tech#t-rec-data — Change is a record\n/)
  for (const f of fs.readdirSync(path.join(dir, 'docs/product/ideas'))) assert.doesNotMatch(fs.readFileSync(path.join(dir, 'docs/product/ideas', f), 'utf8'), /C-\d/)
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
