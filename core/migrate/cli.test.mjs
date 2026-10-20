// `groundwork migrate` run as a process, the way Claude runs it (non-interactive).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../cli-process.test-helper.mjs'
import { oldProject, snapshot } from './project.test-helper.mjs'

const BIN = fileURLToPath(new URL('../groundwork.mjs', import.meta.url))
const gw = (cwd, ...args) => runCommand(process.execPath, [BIN, 'migrate', ...args], { cwd })

test('without --yes it prints the plan, with the proposed milestone states, and writes nothing', async () => {
  const root = oldProject()
  const before = snapshot(root, [])
  const r = await gw(root)
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /docs\/product\/spec\/SYSTEM\.md/)
  assert.match(r.stdout, /C-1 Initial state \(done\)/)
  assert.match(r.stdout, /M-2 +r-2 +in-progress +Payments/)
  assert.match(r.stdout, /Nothing written/)
  assert.deepEqual(snapshot(root, []), before)
  const j = await gw(root, '--json')
  assert.deepEqual(JSON.parse(j.stdout).milestones.map((m) => m.proposed), ['done', 'in-progress', 'planned'])
})

test('--yes needs the approved milestone states; then it writes, and the records check clean; a second run is refused', async () => {
  const root = oldProject()
  const refused = await gw(root, '--yes')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /every milestone needs an approved state.*M-1 \(r-1, proposed done\)/)
  assert.ok(!fs.existsSync(path.join(root, 'docs/product/spec')))

  const r = await gw(root, '--yes', '--milestones', 'M-3=in-progress,proposed')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /record check: no errors/)
  const list = await runCommand(process.execPath, [BIN, 'record', 'list', '--type', 'M'], { cwd: root })
  assert.match(list.stdout, /M-3 +in-progress +Reviews/)

  const again = await gw(root, '--yes', '--milestones', 'proposed')
  assert.equal(again.code, 1)
  assert.match(again.stderr, /already migrated/)
})

const record = (cwd, ...args) => runCommand(process.execPath, [BIN, 'record', ...args], { cwd })

test('--split … --as … --idea … --milestone … puts the branches in a change of their own; record show and check resolve their ids', async () => {
  const root = oldProject()
  const dry = await gw(root, '--split', 'd-cart,c-api', '--as', 'Cart and API', '--idea', 'I-1', '--milestone', 'M-3')
  assert.equal(dry.code, 0, dry.stderr)
  assert.match(dry.stdout, /C-2 Cart and API \(awaiting-approval\)/)
  assert.match(dry.stdout, /add d-cart → web\/prd#t-web-scope/)
  assert.match(dry.stdout, /C-3 Open questions from the migration \(grilling\)/)

  const r = await gw(root, '--yes', '--milestones', 'proposed', '--split', 'd-cart,c-api', '--as', 'Cart and API', '--idea', 'I-1', '--milestone', 'M-3')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  assert.match(r.stdout, /record check: no errors/)

  const item = await record(root, 'show', 'd-cart')
  assert.equal(item.code, 0, item.stderr)
  assert.match(item.stdout, /^d-cart: proposed by C-2 Cart and API \(awaiting-approval\) docs\/product\/changes\/C-002-cart-and-api\.md$/m)
  assert.match(item.stdout, /^add d-cart → web\/prd#t-web-scope — A cart · decision · missing$/m)
  const old = await record(root, 'show', 'c-api')
  assert.equal(old.code, 0, old.stderr)
  assert.match(old.stdout, /^c-api: an old id, listed in C-1 \(part\) → api-server$/m)
  assert.match(old.stdout, /^api-server: proposed by C-2/m)
  const ms = await record(root, 'show', 'r-2')
  assert.match(ms.stdout, /^M-2 docs\/product\/milestones\/M-002-payments\.md$/m)
  const check = await record(root, 'check')
  assert.equal(check.code, 0, check.stdout)
})

test('--split-plan reads a JSON list of changes; a wrong one is refused and nothing is written', async () => {
  const root = oldProject()
  fs.writeFileSync(path.join(root, 'split.json'), JSON.stringify([
    { title: 'Cart', split: ['d-cart'], ideas: ['I-1'], milestone: 'r-3' },
    { as: 'API', split: 'c-api', idea: 'I-2' },
  ]))
  const r = await gw(root, '--yes', '--milestones', 'proposed', '--split-plan', 'split.json')
  assert.equal(r.code, 0, r.stdout + r.stderr)
  const list = await record(root, 'list', '--type', 'C')
  assert.match(list.stdout, /C-2 +awaiting-approval +Cart\nC-3 +awaiting-approval +API\nC-4 +grilling +Open questions/)

  const other = oldProject()
  fs.writeFileSync(path.join(other, 'split.json'), JSON.stringify([{ title: 'X', split: ['nope'] }]))
  const bad = await gw(other, '--yes', '--milestones', 'proposed', '--split-plan', 'split.json')
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /nope: no component, document, section or item/)
  assert.ok(!fs.existsSync(path.join(other, 'docs/product/spec')))
  const loose = await gw(other, '--as', 'X')
  assert.equal(loose.code, 1)
  assert.match(loose.stderr, /--as.*--split/)
})

test('a second split run is refused too', async () => {
  const root = oldProject()
  await gw(root, '--yes', '--milestones', 'proposed', '--split', 'd-cart', '--as', 'Cart')
  const again = await gw(root, '--yes', '--milestones', 'proposed')
  assert.equal(again.code, 1)
  assert.match(again.stderr, /already migrated/)
})
