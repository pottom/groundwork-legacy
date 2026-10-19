// The Plan module behind the core server: its view and its /api/plan/ endpoints.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { openMap } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'
import { listen } from '../../core/sse-client.test-helper.mjs'

const open = (dir) => openMap(dir, moduleFiles(dir, plan))

test('the manifest names the folders Plan may write to', () => {
  assert.deepEqual(plan.writes, ['docs/product', '.groundwork/plan'])
})

test('the map round-trips through /api/plan/map and a browser save is merged', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-api-'))
  open(root).init('Product')
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const base = `http://127.0.0.1:${srv.port}`
    assert.match(await (await fetch(`${base}/plan/`)).text(), /<html/i)
    assert.equal((await fetch(`${base}/plan/documents.mjs`)).status, 200)
    assert.equal((await fetch(`${base}/plan/doc-strings.mjs`)).status, 200, 'the document panel imports it too')

    const { v, data } = await (await fetch(`${base}/api/plan/map`)).json()
    assert.deepEqual(await (await fetch(`${base}/api/plan/map?v=${v}`)).json(), { v, same: true })

    data.nodeData.children.push({ id: 'h', topic: 'From the browser' })
    const saved = await (await fetch(`${base}/api/plan/map`, { method: 'PUT', body: JSON.stringify({ base: v, data }) })).json()
    assert.notEqual(saved.v, v)
    assert.equal(open(root).read().data.nodeData.children[0].topic, 'From the browser')
    assert.equal(open(root).takeHumanEdits().length, 1)

    assert.equal((await fetch(`${base}/api/plan/map`, { method: 'PUT', body: 'not json' })).status, 400)
    assert.deepEqual(await (await fetch(`${base}/api/plan/glossary`)).json(), { text: '' })
  } finally {
    await srv.close()
  }
})

// Plan's own colours: its node types and implementation states. Everything else
// (page, panels, text, lines, accent, fonts) comes from the shell's theme.
const PLAN_COLOURS = ['--topic', '--inferred', '--missing', '--decision', '--parked', '--todo']

test('the Plan view uses the shell theme and defines no base colours of its own', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-look-'))
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const html = await (await fetch(`http://127.0.0.1:${srv.port}/plan/`)).text()
    assert.match(html, /<link rel="stylesheet" href="\/shell\/theme\.css">/)
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1]
    for (const name of ['--bg', '--surface', '--fg', '--muted', '--line', '--font', '--font-doc', '--shadow'])
      assert.doesNotMatch(css, new RegExp(`${name}:`), `Plan defines ${name}`)
    // a colour literal may only be the value of one of Plan's own colours
    const stray = css.split(/[;{}]/).map((d) => d.trim())
      .filter((d) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(d) && !PLAN_COLOURS.includes(d.split(':')[0].trim()))
    assert.deepEqual(stray, [])
  } finally {
    await srv.close()
  }
})

test('the map file is Plan\'s live-update topic; other files are not', () => {
  assert.equal(plan.watch('docs/product/mindmap.json'), 'plan.map')
  assert.equal(plan.watch('GLOSSARY.md'), 'plan.glossary')
  assert.equal(plan.watch('docs/product/PRD.md'), null, 'the documents follow the map')
  assert.equal(plan.watch('.groundwork/plan/edits.jsonl'), null)
})

test('a change to the map on disk reaches the page through /api/events', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-events-'))
  open(root).init('Product')
  const srv = await startServer({ root, modules: [plan], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    open(root).apply([{ op: 'add', parent: 'root', id: 'x', topic: 'From Claude' }])
    await sse.change('plan.map')
  } finally { sse.close(); await srv.close() }
})
