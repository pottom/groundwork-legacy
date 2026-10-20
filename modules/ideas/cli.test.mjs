// `groundwork ideas add` and `groundwork ideas list`, run as processes through the package's bin.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../../core/cli-process.test-helper.mjs'
import { openProjectRecords } from '../../core/records/project.mjs'

const BIN = fileURLToPath(new URL('../../core/groundwork.mjs', import.meta.url))
const ITEMS = path.join('docs', 'product', 'ideas')
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-cli-'))
// What Claude must add to an idea of its own: an estimate with its reason.
const ESTIMATE = ['--impact', 'high', '--effort', 'low', '--rationale', 'Small change, often used.']
const ideas = (cwd, ...args) => runCommand(process.execPath, [BIN, 'ideas', ...args], { cwd })

test('ideas add creates the next numbered file and says its number', async () => {
  const dir = project()
  const first = await ideas(dir, 'add', 'Quick tab switching', '--body', 'Ctrl+1..9.', '--author', 'claude', '--source', 'grilling', '--kind', 'engineering', ...ESTIMATE)
  assert.equal(first.code, 0, first.stderr)
  assert.match(first.stdout, /I-1\b.*I-001-quick-tab-switching\.md/)
  const text = fs.readFileSync(path.join(dir, ITEMS, 'I-001-quick-tab-switching.md'), 'utf8')
  assert.match(text, /\nauthor: claude\n/)
  assert.match(text, /\nsource: grilling\n/)
  assert.match(text, /\nkind: engineering\n/)
  assert.match(text, /\n\nCtrl\+1\.\.9\.\n\n## Történet\n\n- \S+ · claude · created\n$/)

  const second = await ideas(dir, 'add', 'Another one')
  assert.equal(second.code, 0, second.stderr)
  assert.deepEqual(fs.readdirSync(path.join(dir, ITEMS)).sort(), ['I-001-quick-tab-switching.md', 'I-002-another-one.md'])
})

test('ideas list prints every idea with its number, column, title, author and source', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Quick tab switching', '--author', 'claude', '--source', 'grilling', ...ESTIMATE)
  const r = await ideas(dir, 'list')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /I-1\s+new\s+Quick tab switching\s+\(claude, grilling\)/)
})

test('ideas move puts an idea in New or Considering, and refuses the other columns: those are the human\'s', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Quick tabs')
  const moved = await ideas(dir, 'move', 'I-1', 'considering')
  assert.equal(moved.code, 0, moved.stderr)
  assert.match(moved.stdout, /I-1.*considering/)
  const file = path.join(dir, ITEMS, 'I-001-quick-tabs.md')
  assert.match(fs.readFileSync(file, 'utf8'), /\nstatus: considering\n/)

  for (const status of ['accepted', 'rejected', 'snoozed', 'duplicate']) {
    const r = await ideas(dir, 'move', 'I-1', status)
    assert.equal(r.code, 1, status)
    assert.match(r.stderr, /only a human.*browser/i, status)
  }
  assert.match(fs.readFileSync(file, 'utf8'), /\nstatus: considering\n/)
  assert.equal((await ideas(dir, 'move', 'I-9', 'new')).code, 1)
  assert.equal((await ideas(dir, 'move', 'I-1', 'done')).code, 1)

  assert.equal((await ideas(dir, 'move', 'I-1', 'new')).code, 0)
  assert.match(fs.readFileSync(file, 'utf8'), /\nstatus: new\n/)

  // nor does it take an idea back out of a human's decision
  fs.writeFileSync(file, '---\ntitle: Quick tabs\nstatus: rejected\nreason: No.\n---\n')
  const back = await ideas(dir, 'move', 'I-1', 'considering')
  assert.equal(back.code, 1)
  assert.match(back.stderr, /only a human.*browser/i)
  assert.match(fs.readFileSync(file, 'utf8'), /\nstatus: rejected\n/)
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

test('ideas similar lists likely duplicates with a score, the closest first, and nothing unrelated', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Quick tab switching with keyboard shortcuts', '--body', 'Ctrl+1..9 switches between the module tabs.')
  await ideas(dir, 'add', 'Dark mode for the print view')
  await ideas(dir, 'add', 'Keyboard shortcut to switch tabs')
  const r = await ideas(dir, 'similar', 'switch tabs with a keyboard shortcut')
  assert.equal(r.code, 0, r.stderr)
  const lines = r.stdout.trim().split('\n')
  assert.deepEqual(lines.map((l) => l.split(/\s+/)[0]), ['I-3', 'I-1'])
  for (const l of lines) assert.match(l, /^I-\d+\s+[01]\.\d\d\s+new\s+\S/)
  assert.ok(Number(lines[0].split(/\s+/)[1]) > Number(lines[1].split(/\s+/)[1]), 'the closest has the higher score')
})

test('ideas similar says so when nothing is similar', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Dark mode for the print view')
  const r = await ideas(dir, 'similar', 'faster ticket search')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /no similar ideas/i)
})

test('an idea Claude adds carries author claude, its source, an impact/effort estimate with its rationale, and links to similar ideas', async () => {
  const dir = project()
  await ideas(dir, 'add', 'Keyboard shortcut to switch tabs')
  const r = await ideas(dir, 'add', 'Quick tab switching', '--author', 'claude', '--source', 'review of #24',
    '--impact', 'medium', '--effort', 'low', '--rationale', 'Saves a click per switch; one key handler in the shell.', '--links', 'I-1')
  assert.equal(r.code, 0, r.stderr)
  const text = fs.readFileSync(path.join(dir, ITEMS, 'I-002-quick-tab-switching.md'), 'utf8')
  assert.match(text, /\nauthor: claude\n/)
  assert.match(text, /\nsource: "review of #24"\n/)
  assert.match(text, /\nimpact: medium\n/)
  assert.match(text, /\neffort: low\n/)
  assert.match(text, /\nrationale: "?Saves a click per switch; one key handler in the shell\."?\n/)
  assert.match(text, /\nlinks: I-1\n/)
  const list = await ideas(dir, 'list')
  assert.match(list.stdout, /I-2\s+new\s+Quick tab switching\s+\(claude, review of #24\)\s+impact medium, effort low\s+~ I-1/)
})

test('the command knows the core\'s records too: an idea may link a change that exists', async () => {
  const dir = project()
  openProjectRecords(dir).create('C', { fields: { title: 'Record store' } })
  const r = await ideas(dir, 'add', 'Idea', '--links', 'C-1')
  assert.equal(r.code, 0, r.stderr)
  assert.match(fs.readFileSync(path.join(dir, ITEMS, 'I-001-idea.md'), 'utf8'), /\nlinks: C-1\n/)
  assert.equal((await ideas(dir, 'add', 'Other', '--links', 'C-9')).code, 1, 'a change that does not exist')
})

test('Claude cannot file an idea without its source and estimate, nor link an idea that does not exist', async () => {
  const dir = project()
  const full = ['--author', 'claude', '--source', 'chat', '--impact', 'high', '--effort', 'low', '--rationale', 'Why.']
  const without = (opt) => { const a = [...full], i = a.indexOf(opt); a.splice(i, 2); return a }
  for (const args of [without('--source'), without('--impact'), without('--effort'), without('--rationale'),
    [...full.slice(0, 4), '--impact', 'huge', ...full.slice(6)], [...full, '--links', 'I-9']]) {
    const r = await ideas(dir, 'add', 'Idea', ...args)
    assert.equal(r.code, 1, args.join(' '))
    assert.match(r.stderr, /\S/)
  }
  assert.equal(fs.existsSync(path.join(dir, ITEMS)), false)
  const ok = await ideas(dir, 'add', 'Idea', ...full)
  assert.equal(ok.code, 0, ok.stderr)
})
