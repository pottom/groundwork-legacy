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
  assert.match(r.stdout, /record check: 0 duplicate ids, 0 non-canonical lines, 0 unknown references/)
  const list = await runCommand(process.execPath, [BIN, 'record', 'list', '--type', 'M'], { cwd: root })
  assert.match(list.stdout, /M-3 +in-progress +Reviews/)

  const again = await gw(root, '--yes', '--milestones', 'proposed')
  assert.equal(again.code, 1)
  assert.match(again.stderr, /already migrated/)
})
