// `groundwork record check`: the quality check of the records and the Spec, run as a process with
// no server (as a pre-commit hook or a CI step would run it); and its rules through checkRecords.
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
import { checkRecords } from './check.mjs'

const BIN = fileURLToPath(new URL('../groundwork.mjs', import.meta.url))
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-record-check-'))
const check = (cwd, ...args) => runCommand(process.execPath, [BIN, 'record', 'check', ...args], { cwd })
const put = (root, rel, text) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
  fs.writeFileSync(path.join(root, rel), text)
}
const open = (root) => openRecords(root, [...MODULES, CORE_RECORDS])

const SPEC = [
  '# Mag: Műszaki terv', '', '_Műszaki terv_', '',
  '## Stack {#t-stack .done}', '', 'Node.', '',
  '- npm-csomag · `d-npm` · döntés · kész · C-1',
  '  npx-szel fut.',
  '- React · `d-react` · kizárt · C-1 · felváltotta: C-2', '',
].join('\n')

// A clean project: an idea, a milestone, two changes naming them, a Spec document whose items name the changes.
function seed(root) {
  const store = open(root)
  store.create('I', { fields: { title: 'Quick tabs' } }, { by: 'human' })
  store.create('M', { fields: { title: 'Redesign' } })
  store.create('C', { fields: { title: 'Start', ideas: ['I-1'], milestone: 'M-1' }, body: '## Javasolt elemek\n\n- add `d-npm` → `core/tech#t-stack` — npm' })
  store.create('C', { fields: { title: 'No React' }, body: '## Javasolt elemek\n\n- supersede `d-react` → `core/tech` — no' })
  put(root, 'docs/product/spec/core/TECH.md', SPEC)
  return store
}

test('a clean project passes: exit 0, no server needed', async () => {
  const dir = project()
  seed(dir)
  const r = await check(dir)
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /no errors/)
})

test('two records with one number (made on two branches) are an error, both files with their id line', async () => {
  const dir = project()
  seed(dir)
  put(dir, 'docs/product/changes/C-002-other-branch.md', '---\nid: C-2\ntitle: Other branch\nstatus: grilling\n---\n\n## Történet\n')
  const r = await check(dir)
  assert.equal(r.code, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /^docs\/product\/changes\/C-002-no-react\.md:2: duplicate: C-2 is also docs\/product\/changes\/C-002-other-branch\.md$/m)
  assert.match(r.stdout, /^docs\/product\/changes\/C-002-other-branch\.md:2: duplicate: C-2 is also docs\/product\/changes\/C-002-no-react\.md$/m)
  assert.match(r.stdout, /^2 errors\.$/m)
})

test('a reference to a record or Spec id that is not there is an error, with its file and line', async () => {
  const dir = project()
  const store = seed(dir)
  store.create('C', { fields: { title: 'Dangling', ideas: ['I-1', 'I-9'], milestone: 'M-4' }, body: [
    '## Javasolt elemek', '',
    '- add `d-new` → `core/tech#t-nowhere` — a section that is not there',
    '- change `d-gone` → `core/tech#t-stack` — an item that is not there',
    '- add `d-other` → `plan/prd` — a document that is not there',
  ].join('\n') })
  put(dir, 'docs/product/spec/core/TECH.md', SPEC.replace('kész · C-1', 'kész · C-1, C-8'))
  const r = await check(dir)
  assert.equal(r.code, 1, r.stdout + r.stderr)
  const C3 = 'docs/product/changes/C-003-dangling.md'
  assert.match(r.stdout, new RegExp(`^${C3}:4: orphan: ideas names I-9, which is not there$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:5: orphan: milestone names M-4, which is not there$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:\\d+: orphan: add d-new → core/tech#t-nowhere: t-nowhere is not in core/tech$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:\\d+: orphan: change d-gone: d-gone is not in the Spec$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:\\d+: orphan: add d-other → plan/prd: plan/prd is not in the Spec$`, 'm'))
  assert.match(r.stdout, /^docs\/product\/spec\/core\/TECH\.md:9: orphan: d-npm names C-8, which is not there$/m)
  assert.match(r.stdout, /^6 errors\.$/m)
  const lines = fs.readFileSync(path.join(dir, C3), 'utf8').split('\n')
  for (const m of r.stdout.matchAll(new RegExp(`^${C3}:(\\d+): orphan: (?:add|change) (d-[\\w-]+)`, 'gm'))) {
    assert.match(lines[Number(m[1]) - 1], new RegExp(`\`${m[2]}\``), 'the line of the proposed item')
  }
})

test('a line not in the canonical form is an error: hand edits of a Spec document and of a record', async () => {
  const dir = project()
  seed(dir)
  put(dir, 'docs/product/spec/core/TECH.md', SPEC + '\nSzabad bekezdés.\n')
  const idea = 'docs/product/ideas/I-001-quick-tabs.md'
  const text = fs.readFileSync(path.join(dir, idea), 'utf8')
  put(dir, idea, text.replace('title: Quick tabs', 'title: Quick tabs\nnot a key value line').replace(/\n## Történet\n[\s\S]*$/, '\n'))
  const r = await check(dir)
  assert.equal(r.code, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /^docs\/product\/spec\/core\/TECH\.md:13: not-canonical: stray: Szabad bekezdés\.$/m)
  assert.match(r.stdout, /^docs\/product\/ideas\/I-001-quick-tabs\.md:4: not-canonical: stray: not a key value line$/m)
  assert.match(r.stdout, /^docs\/product\/ideas\/I-001-quick-tabs\.md:\d+: not-canonical: missing: ## Történet$/m)
})

test('a Spec id in two documents is an error on each line that holds it', async () => {
  const dir = project()
  seed(dir)
  put(dir, 'docs/product/spec/plan/PRD.md', '# Plan\n\n_Termékkövetelmények_\n\n## Cél {#t-goal}\n\n- npm is · `d-npm` · döntés · C-1\n')
  const r = await check(dir)
  assert.equal(r.code, 1, r.stdout + r.stderr)
  assert.match(r.stdout, /^docs\/product\/spec\/core\/TECH\.md:9: duplicate: d-npm is used in core\/tech, plan\/prd$/m)
  assert.match(r.stdout, /^docs\/product\/spec\/plan\/PRD\.md:7: duplicate: d-npm is used in core\/tech, plan\/prd$/m)
  assert.match(r.stdout, /^2 errors\.$/m)
})

test('checkRecords takes a resolver for ids the store does not hold (a pending change\'s items)', () => {
  const dir = project()
  const store = seed(dir)
  store.create('C', { fields: { title: 'Follow-up' }, body: '## Javasolt elemek\n\n- change `d-pending` → `core/tech#d-pending` — refine it' })
  const before = checkRecords(store).findings.filter((f) => f.rule === 'orphan')
  assert.equal(before.length, 2)
  const asked = []
  const after = checkRecords(store, { known: (id) => { asked.push(id); return id === 'd-pending' } })
  assert.deepEqual(after.findings, [])
  assert.ok(!asked.includes('C-1'), 'asked only for what the store does not know')
  assert.deepEqual(after.counts, { records: 5, documents: 1 })
})

test('the thought map of a change is checked: an unknown sign, a → to an item the change does not propose, a line not in the canonical form', async () => {
  const dir = project()
  const store = seed(dir)
  store.create('C', { fields: { title: 'Map' }, body: [
    '## Gondolatok', '',
    '- ? Where does it live?',
    '  - ~! In the change → `d-npm`',
    '- ?! Odd sign',
    '- = Settled → `d-nope`',
    '    - ! Four spaces deep',
    '', '## Javasolt elemek', '',
    '- change `d-npm` → `core/tech#t-stack` — npm',
  ].join('\n') })
  const r = await check(dir)
  assert.equal(r.code, 1, r.stdout + r.stderr)
  const C3 = 'docs/product/changes/C-003-map.md'
  assert.match(r.stdout, new RegExp(`^${C3}:11: not-canonical: unknown sign \\?! \\(the signs: \\? ~ ~! = ! x\\)$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:12: orphan: → d-nope: the change proposes no d-nope$`, 'm'))
  assert.match(r.stdout, new RegExp(`^${C3}:13: not-canonical: form: {5}- ! Four spaces deep$`, 'm'))
  assert.match(r.stdout, /^3 errors\.$/m)
})

test('a canonical thought map passes the check, also without a Spec', async () => {
  const dir = project()
  const store = open(dir)
  store.create('C', { fields: { title: 'Map' }, body: '## Gondolatok\n\n- ? Where?\n  Why it matters.\n  - ~! Here → `d-here`\n\n## Javasolt elemek\n\n- add `d-here` → `core/tech` — Here' })
  const r = await check(dir)
  assert.equal(r.code, 0, r.stdout + r.stderr)
})
