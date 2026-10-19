// Live updates: what changed in the project, pushed to the pages as Server-Sent Events.
//
//   GET /api/events   text/event-stream; on connect "retry: <ms>" and an `hello` event, then a
//                     `change` event { topics: [topic] } whenever something a module cares about
//                     changed, and a comment line now and then to keep the connection alive
//
// A topic is a name a module chooses ("plan.map", "build.files"). Two things make one:
//   - a file below the root changed: each module's manifest `watch(path)` (path relative to the
//     root, "/"-separated) names its topic(s) for it, or nothing;
//   - a module pushes one itself: api({ events }) gets events.publish(topic), and
//     events.every(ms, fn), which runs fn on an interval only while a page listens (the Build
//     module re-checks GitHub this way) and stops when the server closes.
// Topics that come within a moment of each other go out as one event.
//
// The page asks again for what the topic names (the map, the ticket list). The event carries no
// content: a page that missed one (the connection dropped; EventSource reconnects on its own)
// simply asks again for everything when the stream opens.

import fs from 'node:fs'
import path from 'node:path'

const RETRY_MS = 2000      // how soon EventSource reconnects
const BATCH_MS = 150       // changes within this window go out together
const KEEPALIVE_MS = 20000

// The files no module ever needs to hear about (they change all the time).
const QUIET = /(^|\/)(node_modules|\.git\/objects|\.git\/logs)(\/|$)|(^|\/)\.git\/(index|FETCH_HEAD|ORIG_HEAD)(\.lock)?$/

export function createEvents({ root, modules }) {
  const clients = new Set()
  const timers = new Set()
  let pending = new Set()
  let flush = null
  let watcher = null
  let closed = false

  function send(text) { for (const res of clients) res.write(text) }

  function publish(topic) {
    if (closed) return
    for (const t of [].concat(topic || [])) pending.add(t)
    if (flush || !pending.size) return
    flush = setTimeout(() => {
      flush = null
      const topics = [...pending]
      pending = new Set()
      send(`event: change\ndata: ${JSON.stringify({ topics })}\n\n`)
    }, BATCH_MS)
  }

  function changed(rel) {
    if (!rel || QUIET.test(rel)) return
    for (const m of modules) {
      if (typeof m.watch !== 'function') continue
      try { publish(m.watch(rel)) } catch { /* a module's classifier must not stop the others */ }
    }
  }

  // The project folder, watched as a whole (recursive: Windows, macOS, and Linux on Node 20+).
  function startWatching() {
    if (watcher || !modules.some((m) => typeof m.watch === 'function')) return
    try {
      watcher = fs.watch(root, { recursive: true }, (_type, name) => changed(name ? String(name).split(path.sep).join('/') : ''))
      watcher.on('error', () => { watcher?.close(); watcher = null })
    } catch { watcher = null } // no such folder (yet): the pages still get what modules push
  }

  // For a module: push a topic, or check something regularly while anyone listens.
  const api = {
    publish,
    every(ms, fn) {
      const t = setInterval(() => { if (clients.size) Promise.resolve().then(fn).catch(() => {}) }, ms)
      t.unref?.()
      timers.add(t)
      return () => { clearInterval(t); timers.delete(t) }
    },
    get listeners() { return clients.size },
  }

  // GET /api/events: one page's stream.
  function stream(req, res) {
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' })
    res.write(`retry: ${RETRY_MS}\nevent: hello\ndata: {}\n\n`)
    clients.add(res)
    startWatching()
    const alive = setInterval(() => res.write(': keep-alive\n\n'), KEEPALIVE_MS)
    alive.unref?.()
    const drop = () => { clearInterval(alive); clients.delete(res) }
    req.on('close', drop)
    res.on('close', drop)
  }

  function close() {
    closed = true
    clearTimeout(flush)
    for (const t of timers) clearInterval(t)
    timers.clear()
    watcher?.close()
    watcher = null
    for (const res of clients) res.end()
    clients.clear()
  }

  return { api, stream, close }
}
