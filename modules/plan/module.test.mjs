// The Plan module behind the core server: its view and its /api/plan/ endpoints.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { openMap } from './map-store.mjs'
import plan from './module.mjs'

test('the map round-trips through /api/plan/map and a browser save is merged', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-plan-api-'))
  openMap(root).init('Product')
  const srv = await startServer({ root, modules: [plan], port: 0 })
  try {
    const base = `http://127.0.0.1:${srv.port}`
    assert.match(await (await fetch(`${base}/plan/`)).text(), /<html/i)
    assert.equal((await fetch(`${base}/plan/documents.mjs`)).status, 200)

    const { v, data } = await (await fetch(`${base}/api/plan/map`)).json()
    assert.deepEqual(await (await fetch(`${base}/api/plan/map?v=${v}`)).json(), { v, same: true })

    data.nodeData.children.push({ id: 'h', topic: 'From the browser' })
    const saved = await (await fetch(`${base}/api/plan/map`, { method: 'PUT', body: JSON.stringify({ base: v, data }) })).json()
    assert.notEqual(saved.v, v)
    assert.equal(openMap(root).read().data.nodeData.children[0].topic, 'From the browser')
    assert.equal(openMap(root).takeHumanEdits().length, 1)

    assert.equal((await fetch(`${base}/api/plan/map`, { method: 'PUT', body: 'not json' })).status, 400)
    assert.deepEqual(await (await fetch(`${base}/api/plan/glossary`)).json(), { text: '' })
  } finally {
    await srv.close()
  }
})
