// Live updates in the browser: one stream of server events per tab. Served at /shell/live.mjs.
//
// The shell owns the connection. It opens the one EventSource on /api/events and relays what
// arrives to every module frame with postMessage, the hidden ones the shell keeps alive too; a
// module page never opens a second stream while it sits in the shell. Opened on its own (no shell around it), the same call opens the
// page's own stream, so a module writes one line either way:
//
//   import { subscribe } from '/shell/live.mjs'
//   const stop = subscribe({
//     onHello: () => readEverything(),         // (re)connected: read everything again
//     onChange: (topics) => { ... },           // something changed: topics is an array, e.g. ['plan.map']
//     onState: (state) => { ... },             // optional: 'connecting' | 'on' | 'off'; only a page
//   })                                         // running without the shell shows this, the shell shows it already
//   stop()                                     // optional: stop listening (and close the page's own stream)
//
// Either way the stream is closed on `pagehide` (no ERR_CONNECTION_RESET in the console when the
// page goes away) and opened again when the page comes back from the back/forward cache.
//
// The relay protocol, postMessage between the shell and its frame, same origin only:
//   frame -> shell  { type: 'groundwork:live', want: true }                 on subscribe
//   shell -> frame  { type: 'groundwork:live', event: 'state', state }      the connection state
//                   { type: 'groundwork:live', event: 'hello' }             (re)connected
//                   { type: 'groundwork:live', event: 'change', topics }    something changed
// The shell answers `want` with the current state, plus a `hello` when it is live, so a frame
// that loads later starts like one that saw the connection open. A frame whose same-origin parent
// does not answer within a moment (not the shell) opens its own stream.

export const LIVE_MESSAGE = 'groundwork:live'
const URL = '/api/events'
const FALLBACK_MS = 1500

const topicsOf = (e) => {
  try { const t = JSON.parse(e.data)?.topics; return Array.isArray(t) ? t : [] } catch { return [] }
}

// An EventSource that is closed on pagehide and opened again when the page returns from the
// back/forward cache. on: { hello(), change(topics), state(s) }.
function ownStream(win, EventSource, url, on) {
  let es = null
  const open = () => {
    es = new EventSource(url)
    es.addEventListener('hello', () => { on.state('on'); on.hello() })
    es.addEventListener('change', (e) => on.change(topicsOf(e)))
    es.onerror = () => on.state('off')
  }
  const close = () => { es?.close(); es = null }
  const hide = () => close()
  const show = (e) => { if (e?.persisted && !es) { on.state('connecting'); open() } }
  win.addEventListener('pagehide', hide)
  win.addEventListener('pageshow', show)
  open()
  return () => { close(); win.removeEventListener('pagehide', hide); win.removeEventListener('pageshow', show) }
}

// The shell's side: open the tab's one stream and relay it to every frame of the page.
// onState(state) reports 'on' / 'off' for the shell's own indicator.
export function relayEvents({ win = globalThis.window, EventSource = globalThis.EventSource, url = URL, onState } = {}) {
  const origin = win.location.origin
  let state = 'connecting'
  const post = (target, msg) => { try { target.postMessage({ type: LIVE_MESSAGE, ...msg }, origin) } catch {} }
  const toFrames = (msg) => { for (const f of Array.from(win.frames ?? [])) post(f, msg) }
  const setState = (s) => {
    if (s === state) return
    state = s
    onState?.(s)
    toFrames({ event: 'state', state: s })
  }
  const stop = ownStream(win, EventSource, url, {
    state: setState,
    hello: () => toFrames({ event: 'hello' }),
    change: (topics) => toFrames({ event: 'change', topics }),
  })
  const onMessage = (e) => {
    if (e.origin !== origin || e.data?.type !== LIVE_MESSAGE || !e.data.want || !e.source) return
    post(e.source, { event: 'state', state })
    if (state === 'on') post(e.source, { event: 'hello' })
  }
  win.addEventListener('message', onMessage)
  return {
    get state() { return state },
    close() { stop(); win.removeEventListener('message', onMessage) },
  }
}

// The parent window when it is a page of the same origin (the shell), else null.
function sameOriginParent(win) {
  const parent = win.parent
  if (!parent || parent === win) return null
  try { return parent.location.origin === win.location.origin ? parent : null } catch { return null }
}

// A module page's side: hear hello and changes from the shell, or from its own stream.
export function subscribe({ onHello, onChange, onState } = {}, { win = globalThis.window, EventSource = globalThis.EventSource, url = URL, timeout = FALLBACK_MS } = {}) {
  let state = null
  const on = {
    state: (s) => { if (s !== state) { state = s; onState?.(s) } },
    hello: () => onHello?.(),
    change: (topics) => onChange?.(topics),
  }
  on.state('connecting')

  const parent = sameOriginParent(win)
  if (!parent) return ownStream(win, EventSource, url, on)

  const origin = win.location.origin
  let stopOwn = null
  let timer = null
  const onMessage = (e) => {
    if (e.origin !== origin || e.source !== parent || e.data?.type !== LIVE_MESSAGE) return
    if (timer) { win.clearTimeout(timer); timer = null }
    const { event } = e.data
    if (event === 'state') on.state(e.data.state)
    else if (event === 'hello') on.hello()
    else if (event === 'change') on.change(Array.isArray(e.data.topics) ? e.data.topics : [])
  }
  win.addEventListener('message', onMessage)
  timer = win.setTimeout(() => {
    timer = null
    win.removeEventListener('message', onMessage)
    stopOwn = ownStream(win, EventSource, url, on)
  }, timeout)
  try { parent.postMessage({ type: LIVE_MESSAGE, want: true }, origin) } catch {}
  return () => {
    if (timer) win.clearTimeout(timer)
    win.removeEventListener('message', onMessage)
    stopOwn?.()
  }
}
