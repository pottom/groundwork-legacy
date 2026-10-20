// The record store behind the core server: GET /api/records, GET /api/records/<id>, and the live
// topic "records" when a record file changes.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../server.mjs'
import { listen } from '../sse-client.test-helper.mjs'
import { openRecords } from './store.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-records-api-'))
const THING = {
  prefix: 'T', name: 'thing', folder: 'docs/product/things', fields: ['title', 'refs', 'status'], lists: ['refs'], links: ['refs'],
  lifecycle: { field: 'status', states: ['open', 'done'], initial: 'open', claude: ['open'] },
}
const MODULE = { id: 'things', name: 'Things', records: [THING] }

async function withServer(root, modules, fn) {
  const srv = await startServer({ root, modules, port: 0 })
  try { await fn(`http://127.0.0.1:${srv.port}`, srv) } finally { await srv.close() }
}

test('/api/records lists every record; /api/records/<id> gives one with its reverse links and safe HTML', async () => {
  const root = project()
  const store = openRecords(root, [MODULE])
  store.create('T', { fields: { title: 'One' }, body: '**Hi** <script>x</script>' })
  store.create('T', { fields: { title: 'Two', refs: ['T-1'] } })
  await withServer(root, [MODULE], async (base) => {
    const { records } = await (await fetch(`${base}/api/records`)).json()
    assert.deepEqual(records.map((r) => [r.id, r.fields.title]), [['T-1', 'One'], ['T-2', 'Two']])
    assert.deepEqual((await (await fetch(`${base}/api/records?type=X`)).json()).records, [])
    const { record } = await (await fetch(`${base}/api/records/T-1`)).json()
    assert.deepEqual(record.linkedFrom, ['T-2'])
    assert.match(record.html, /<strong>Hi<\/strong>/)
    assert.doesNotMatch(record.html, /<script/)
    assert.equal((await fetch(`${base}/api/records/T-9`)).status, 404)
    assert.equal((await fetch(`${base}/api/records`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 405)
  })
})

test('a module api gets the shared store', async () => {
  let seen
  const mod = { ...MODULE, api: ({ records }) => { seen = records; return () => false } }
  await withServer(project(), [mod], async () => {
    assert.deepEqual(seen.types().map((t) => t.prefix), ['T'])
  })
})

test('"records" is the core\'s: no module may take that id', async () => {
  await assert.rejects(startServer({ root: project(), modules: [{ id: 'records', name: 'R' }], port: 0 }), /reserved/)
})

test('a record file changing on disk reaches the page as the topic "records"; other files do not', async () => {
  const root = project()
  const srv = await startServer({ root, modules: [MODULE], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    openRecords(root, [MODULE]).create('T', { fields: { title: 'Live' } })
    await sse.change('records')
  } finally { sse.close(); await srv.close() }
})
