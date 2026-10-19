// The live connection: one update stream per browser tab, owned by the shell and relayed to
// every module frame; a module page opened on its own opens its own stream.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { relayEvents, subscribe, LIVE_MESSAGE } from './live.mjs'

const ORIGIN = 'http://localhost:4477'

// A stand-in for a browser window: listeners, postMessage that delivers on the next tick.
function fakeWindow({ origin = ORIGIN, parent = null } = {}) {
  const listeners = {}
  const win = {
    location: { origin },
    frames: [],
    timers: [],
    addEventListener: (type, fn) => (listeners[type] ??= new Set()).add(fn),
    removeEventListener: (type, fn) => listeners[type]?.delete(fn),
    dispatch: (type, e = {}) => { for (const fn of [...(listeners[type] ?? [])]) fn(e) },
    listening: (type) => listeners[type]?.size ?? 0,
    posted: [],
    postMessage(data, targetOrigin, from) { win.posted.push({ data, targetOrigin }); queueMicrotask(() => win.dispatch('message', { data, origin: from?.location.origin ?? origin, source: from })) },
    setTimeout: (fn, ms) => { const t = { fn, ms }; win.timers.push(t); return t },
    clearTimeout: (t) => { const i = win.timers.indexOf(t); if (i >= 0) win.timers.splice(i, 1) },
  }
  win.parent = parent ?? win
  return win
}

// A stand-in for EventSource that records every stream it opens.
function fakeEventSourceClass() {
  const opened = []
  class FakeEventSource {
    constructor(url) { this.url = url; this.closed = false; this.listeners = {}; opened.push(this) }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) }
    emit(type, data) { for (const fn of this.listeners[type] ?? []) fn({ data }) }
    fail() { this.onerror?.({}) }
    close() { this.closed = true }
  }
  return { FakeEventSource, opened, open: () => opened.filter((s) => !s.closed) }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

// A shell window with one module frame in it; each posts as itself.
function shellWithFrame() {
  const shell = fakeWindow()
  const frame = fakeWindow({ parent: shell })
  const shellPost = shell.postMessage
  shell.postMessage = (data, target) => shellPost.call(shell, data, target, frame)  // messages to the shell come from the frame
  const framePost = frame.postMessage
  frame.postMessage = (data, target) => framePost.call(frame, data, target, shell)  // messages to the frame come from the shell
  shell.frames = [frame]
  return { shell, frame }
}

test('the shell opens one stream and tells the frame about hello and changes', async () => {
  const { shell, frame } = shellWithFrame()
  const es = fakeEventSourceClass()
  const states = []
  relayEvents({ win: shell, EventSource: es.FakeEventSource, onState: (s) => states.push(s) })
  const got = []
  subscribe({ onHello: () => got.push('hello'), onChange: (topics) => got.push(topics) }, { win: frame, EventSource: es.FakeEventSource })
  await tick()

  const [stream] = es.opened
  assert.equal(es.opened.length, 1, 'the frame opened no stream of its own')
  assert.equal(stream.url, '/api/events')
  stream.emit('hello', '{}')
  stream.emit('change', JSON.stringify({ topics: ['plan.map', 'build.git'] }))
  await tick()
  assert.deepEqual(got, ['hello', ['plan.map', 'build.git']])
  assert.deepEqual(states, ['on'])
  assert.ok(frame.posted.every((p) => p.targetOrigin === ORIGIN), 'posts only to its own origin')
})

test('the shell itself hears hello and changes too (its tabs\' attention counts)', () => {
  const { shell } = shellWithFrame()
  const es = fakeEventSourceClass()
  const got = []
  relayEvents({ win: shell, EventSource: es.FakeEventSource, onHello: () => got.push('hello'), onChange: (topics) => got.push(topics) })
  es.opened[0].emit('hello', '{}')
  es.opened[0].emit('change', JSON.stringify({ topics: ['agents.events'] }))
  assert.deepEqual(got, ['hello', ['agents.events']])
})

test('a frame that loads after the stream is up still gets a hello at once', async () => {
  const { shell, frame } = shellWithFrame()
  const es = fakeEventSourceClass()
  relayEvents({ win: shell, EventSource: es.FakeEventSource })
  es.opened[0].emit('hello', '{}')
  await tick()
  const got = []
  subscribe({ onHello: () => got.push('hello') }, { win: frame, EventSource: es.FakeEventSource })
  await tick(); await tick()
  assert.deepEqual(got, ['hello'])
})

test('the frame hears when the shell loses the server and gets it back', async () => {
  const { shell, frame } = shellWithFrame()
  const es = fakeEventSourceClass()
  const shellStates = []
  relayEvents({ win: shell, EventSource: es.FakeEventSource, onState: (s) => shellStates.push(s) })
  const states = []
  subscribe({ onState: (s) => states.push(s) }, { win: frame, EventSource: es.FakeEventSource })
  await tick(); await tick()
  es.opened[0].emit('hello', '{}')
  es.opened[0].fail()
  es.opened[0].emit('hello', '{}')
  await tick()
  assert.deepEqual(shellStates, ['on', 'off', 'on'])
  assert.deepEqual(states, ['connecting', 'on', 'off', 'on'])
})

test('messages from another origin or of another kind are ignored', async () => {
  const shell = fakeWindow()
  const frame = fakeWindow({ parent: shell })
  const es = fakeEventSourceClass()
  const got = []
  subscribe({ onHello: () => got.push('hello'), onChange: (t) => got.push(t) }, { win: frame, EventSource: es.FakeEventSource })
  frame.dispatch('message', { data: { type: LIVE_MESSAGE, event: 'hello' }, origin: 'http://evil.example', source: shell })
  frame.dispatch('message', { data: { type: 'groundwork:lang', event: 'hello' }, origin: ORIGIN, source: shell })
  frame.dispatch('message', { data: { type: LIVE_MESSAGE, event: 'hello' }, origin: ORIGIN, source: fakeWindow() })
  await tick()
  assert.deepEqual(got, [])
})

test('the shell answers only frames of its own origin', async () => {
  const shell = fakeWindow()
  const es = fakeEventSourceClass()
  relayEvents({ win: shell, EventSource: es.FakeEventSource })
  es.opened[0].emit('hello', '{}')
  const stranger = fakeWindow({ origin: 'http://evil.example' })
  shell.dispatch('message', { data: { type: LIVE_MESSAGE, want: true }, origin: 'http://evil.example', source: stranger })
  assert.deepEqual(stranger.posted, [])
})

test('a page opened on its own (no shell around it) opens its own stream', async () => {
  const page = fakeWindow()
  const es = fakeEventSourceClass()
  const got = []
  subscribe({ onHello: () => got.push('hello'), onChange: (t) => got.push(t) }, { win: page, EventSource: es.FakeEventSource })
  assert.equal(es.opened.length, 1)
  es.opened[0].emit('hello', '{}')
  es.opened[0].emit('change', JSON.stringify({ topics: ['build.files'] }))
  assert.deepEqual(got, ['hello', ['build.files']])
})

test('a frame whose parent never answers falls back to its own stream', async () => {
  const parent = fakeWindow()           // same origin, but no relay in it
  const frame = fakeWindow({ parent })
  const es = fakeEventSourceClass()
  subscribe({}, { win: frame, EventSource: es.FakeEventSource })
  await tick()
  assert.equal(es.opened.length, 0)
  assert.equal(frame.timers.length, 1)
  frame.timers[0].fn()
  assert.equal(es.opened.length, 1)
})

test('a frame inside a page of another origin opens its own stream', () => {
  const parent = { get location() { throw new Error('cross-origin') } }
  const frame = fakeWindow({ parent })
  const es = fakeEventSourceClass()
  subscribe({}, { win: frame, EventSource: es.FakeEventSource })
  assert.equal(es.opened.length, 1)
})

test('the stream is closed when the page goes away, and opened again when it comes back from the cache', () => {
  for (const owner of ['shell', 'page']) {
    const win = fakeWindow()
    const es = fakeEventSourceClass()
    if (owner === 'shell') relayEvents({ win, EventSource: es.FakeEventSource })
    else subscribe({}, { win, EventSource: es.FakeEventSource })
    win.dispatch('pagehide', { persisted: true })
    assert.equal(es.open().length, 0, `${owner}: closed on pagehide`)
    win.dispatch('pageshow', { persisted: false })
    assert.equal(es.open().length, 0, `${owner}: a normal first show opens nothing new`)
    win.dispatch('pageshow', { persisted: true })
    assert.equal(es.open().length, 1, `${owner}: back from the cache, live again`)
  }
})

test('unsubscribing closes the page\'s own stream and stops listening', async () => {
  const page = fakeWindow()
  const es = fakeEventSourceClass()
  const stop = subscribe({}, { win: page, EventSource: es.FakeEventSource })
  stop()
  assert.equal(es.open().length, 0)
  assert.equal(page.listening('pagehide') + page.listening('pageshow') + page.listening('message'), 0)
})

test('a change with a broken payload is passed on as no topics, not thrown', () => {
  const page = fakeWindow()
  const es = fakeEventSourceClass()
  const got = []
  subscribe({ onChange: (t) => got.push(t) }, { win: page, EventSource: es.FakeEventSource })
  es.opened[0].emit('change', 'not json')
  assert.deepEqual(got, [[]])
})

test('every module frame hears the stream, the hidden ones too', async () => {
  const shell = fakeWindow()
  const frames = [fakeWindow({ parent: shell }), fakeWindow({ parent: shell })]
  for (const frame of frames) {
    const post = frame.postMessage
    frame.postMessage = (data, target) => post.call(frame, data, target, shell)
  }
  shell.frames = frames
  const es = fakeEventSourceClass()
  relayEvents({ win: shell, EventSource: es.FakeEventSource })
  const got = frames.map(() => [])
  frames.forEach((frame, i) => subscribe({ onChange: (topics) => got[i].push(topics) }, { win: frame, EventSource: es.FakeEventSource }))
  es.opened[0].emit('change', JSON.stringify({ topics: ['plan.map'] }))
  await tick()
  assert.equal(es.opened.length, 1, 'one stream for the tab')
  assert.deepEqual(got, [[['plan.map']], [['plan.map']]])
})
