// `groundwork ideas add` and `groundwork ideas list`, run as processes through the package's bin.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../../core/cli-process.test-helper.mjs'

const BIN = fileURLToPath(new URL('../../core/groundwork.mjs', import.meta.url))
const ITEMS = path.join('docs', 'product', 'ideas', 'items')
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-cli-'))
const ideas = (cwd, ...args) => runCommand(process.execPath, [BIN, 'ideas', ...args], { cwd })

test('ideas add creates the next numbered file and says its number', async () => {
  const dir = project()
  const first = await ideas(dir, 'add', 'Quick tab switching', '--body', 'Ctrl+1..9.', '--author', 'claude', '--source', 'grilling', '--kind', 'engineering')
  assert.equal(first.code, 0, first.stderr)
  assert.match(first.stdout, /I-1\b.*I-001-quick-tab-switching\.md/)
  const text = fs.readFileSync(path.join(dir, ITEMS, 'I-001-quick-tab-switching.md'), 'utf8')
  assert.match(text, /\nauthor: claude\n/)
  assert.match(text, /\nsource: grilling\n/)
  assert.match(text, /\nkind: engineering\n/)
  assert.match(text, /\n\nCtrl\+1\.\.9\.\n$/)

  const second = await ideas(dir, 'add', 'Another one')
  assert.equal(second.code, 0, second.stderr)
  assert.deepEqual(fs.readdirSync(path.join(dir, ITEMS)).sort(), ['I-001-quick-tab-switching.md', 'I-002-another-one.md'])
})

test('ideas list prints every idea with its number, column, title, author and source', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Quick tab switching', '--author', 'claude', '--source', 'grilling')
  const r = await ideas(dir, 'list')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /I-1\s+new\s+Quick tab switching\s+\(claude, grilling\)/)
})

test('--root names the project folder', async () => {
  const dir = project()
  const r = await ideas(os.tmpdir(), 'add', 'Rooted', '--root', dir)
  assert.equal(r.code, 0, r.stderr)
  assert.ok(fs.existsSync(path.join(dir, ITEMS, 'I-001-rooted.md')))
})

test('a wrong call stops with a message and exit code 1, writing nothing', async () => {
  const dir = project()
  for (const args of [['add'], ['add', 'X', '--author', 'robot'], ['add', 'X', '--colour', 'red'], ['nonsense']]) {
    const r = await ideas(dir, ...args)
    assert.equal(r.code, 1, args.join(' '))
    assert.match(r.stderr, /\S/)
  }
  assert.equal(fs.existsSync(path.join(dir, ITEMS)), false)
})
