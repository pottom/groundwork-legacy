// Tests of the core's live updates: GET /api/events, a Server-Sent Events stream that tells
// the pages what changed in the project, so they ask again instead of polling.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from './server.mjs'
import { listen } from './sse-client.test-helper.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-events-'))
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text) }

// A module that names the topic of the files it cares about, and can push its own.
function watcher(onApi) {
  return {
    id: 'demo', name: 'Demo', version: '1',
    watch: (p) => (p.startsWith('notes/') && p.endsWith('.md') ? 'demo.notes' : null),
    api: (ctx) => { onApi?.(ctx); return () => false },
  }
}

test('/api/events is an event stream that tells the browser how soon to reconnect', async () => {
  const srv = await startServer({ root: tmp(), modules: [watcher()], port: 0 })
  const sse = listen(srv.port)
  try {
    const res = await sse.ready
    assert.equal(res.statusCode, 200)
    assert.match(res.headers['content-type'], /^text\/event-stream/)
    assert.equal(res.headers['cache-control'], 'no-store')
    const hello = await sse.next((e) => e.event === 'hello')
    assert.ok(hello.retry > 0, 'a retry delay for EventSource')
  } finally { sse.close(); await srv.close() }
})

test('a changed file reaches the browser as the topic its module names', async () => {
  const root = tmp()
  const srv = await startServer({ root, modules: [watcher()], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    write(root, 'notes/one.md', '# one\n')
    const ev = await sse.change('demo.notes')
    assert.deepEqual(JSON.parse(ev.data).topics, ['demo.notes'])
  } finally { sse.close(); await srv.close() }
})

test('files no module cares about send nothing', async () => {
  const root = tmp()
  const srv = await startServer({ root, modules: [watcher()], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    write(root, 'other/x.txt', 'x')
    await assert.rejects(sse.change('demo.notes', 600))
    assert.equal(sse.got.filter((e) => e.event === 'change').length, 0)
  } finally { sse.close(); await srv.close() }
})

test('a module can push a change of its own, and check something on an interval while anyone listens', async () => {
  let ctx
  let checks = 0
  const srv = await startServer({ root: tmp(), modules: [watcher((c) => { ctx = c })], port: 0 })
  ctx.events.every(30, () => { checks++; ctx.events.publish('demo.remote') })
  await new Promise((r) => setTimeout(r, 120))
  assert.equal(checks, 0, 'nobody listens: nothing is checked')
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    await sse.change('demo.remote')
    assert.ok(checks > 0)
  } finally { sse.close(); await srv.close() }
  const after = checks
  await new Promise((r) => setTimeout(r, 120))
  assert.equal(checks, after, 'the server closed: the interval stopped')
})

test('changes close together go out as one event', async () => {
  let ctx
  const srv = await startServer({ root: tmp(), modules: [watcher((c) => { ctx = c })], port: 0 })
  const sse = listen(srv.port)
  try {
    await sse.next((e) => e.event === 'hello')
    ctx.events.publish('a'); ctx.events.publish('b'); ctx.events.publish('a')
    const ev = await sse.change('a')
    assert.deepEqual(JSON.parse(ev.data).topics.sort(), ['a', 'b'])
  } finally { sse.close(); await srv.close() }
})

test('the stream is refused to a foreign Host, like every other path', async () => {
  const srv = await startServer({ root: tmp(), modules: [watcher()], port: 0 })
  const sse = listen(srv.port, { host: 'evil.example' })
  try {
    assert.equal((await sse.ready).statusCode, 403)
  } finally { sse.close(); await srv.close() }
})

test('closing the server ends open streams', async () => {
  const srv = await startServer({ root: tmp(), modules: [watcher()], port: 0 })
  const sse = listen(srv.port)
  await sse.next((e) => e.event === 'hello')
  const ended = new Promise((r) => sse.response.on('close', r))
  await srv.close()
  await ended
})
