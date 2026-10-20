// Tests of `groundwork plan` as Claude runs it: init, apply, show and the prompt hook, on the Spec.
// Run: node --test modules/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../../core/cli-process.test-helper.mjs'
import { openMap } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'

const BIN = fileURLToPath(new URL('../../core/groundwork.mjs', import.meta.url))
const gw = (cwd, args, input) => runCommand(process.execPath, [BIN, 'plan', ...args], { cwd, input })

test('init, apply and show work on the Spec, and apply says which ids the Spec gave', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-cli-'))
  assert.equal((await gw(dir, ['init', 'Shop'])).code, 0)
  assert.match(fs.readFileSync(path.join(dir, 'docs/product/spec/SYSTEM.md'), 'utf8'), /^# Shop\n/)
  const ops = [
    { op: 'add', id: 'c-app', parent: 'root', topic: 'App', component: 'software', dir: 'app' },
    { op: 'add', id: 'doc-app-prd', parent: 'c-app', topic: 'App: Product', doc: 'prd' },
    { op: 'add', id: 't-goal', parent: 'doc-app-prd', topic: 'Goal' },
  ]
  const applied = await gw(dir, ['apply', JSON.stringify(ops)])
  assert.equal(applied.code, 0, applied.stderr)
  assert.match(applied.stdout, /c-app is app/)
  assert.match(applied.stdout, /doc-app-prd is app\/prd/)
  assert.match(applied.stdout, /\[app\/prd\] App: Product — document → docs\/product\/spec\/app\/PRD\.md/)
  assert.ok(fs.existsSync(path.join(dir, 'docs/product/spec/app/PRD.md')))
  assert.match((await gw(dir, ['show'])).stdout, /\[t-goal\] Goal/)
})

test('the prompt hook reports the human\'s browser edits once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-hook-'))
  const store = openMap(dir, moduleFiles(dir, plan))
  store.init('Shop')
  store.apply([{ op: 'add', id: 'app', parent: 'root', topic: 'App', component: 'software' },
    { op: 'add', id: 'prd', parent: 'app', topic: 'App: Product', doc: 'prd' }, { op: 'add', id: 't-goal', parent: 'prd', topic: 'Goal' }])
  const { v, data } = store.read()
  data.nodeData.children[1].children[0].children[0].children = [{ id: 'h1', topic: 'Human idea' }]
  store.saveFromBrowser(v, data)
  const input = JSON.stringify({ cwd: dir, prompt: 'go on' })
  const first = await gw(dir, ['hook'], input)
  assert.match(first.stdout, /added \[h1\] "Human idea" under \[t-goal\] "Goal" with status todo/)
  assert.equal((await gw(dir, ['hook'], input)).stdout.trim(), '', 'reported once')
})

test('on an old project with only mindmap.json, show prints the map with the migrate hint and apply is refused', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-old-cli-'))
  fs.mkdirSync(path.join(dir, 'docs/product'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'docs/product/mindmap.json'), JSON.stringify({ nodeData: { id: 'root', topic: 'Old', children: [] } }))
  const show = await gw(dir, ['show'])
  assert.match(show.stdout, /groundwork migrate/)
  assert.match(show.stdout, /\[root\] Old/)
  const applied = await gw(dir, ['apply', '[{"op":"add","parent":"root","topic":"x"}]'])
  assert.match(applied.stdout, /groundwork migrate/)
})
