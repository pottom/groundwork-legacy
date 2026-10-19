// The light/dark choice (theme.js, served at /shell/theme.js): System, Light or Dark, kept in
// localStorage, set on <html data-theme> of the shell and of every module page before it paints,
// and switched live in every open page. The script runs here in a small stand-in for a browser.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { MODULES } from '../modules.mjs'

const SOURCE = fs.readFileSync(new URL('./theme.js', import.meta.url), 'utf8')
const KEY = 'groundwork:theme'

// A page: its <html>, its localStorage (a Map shared between pages of one origin, or one that
// throws), the OS's light/dark (matchMedia) and its frames. Returns the page's window.
function page({ store = new Map(), blocked = false, dark = false, origin = 'http://localhost:4477' } = {}) {
  const attrs = new Map()
  const listeners = {}
  const scheme = {
    matches: dark,
    fns: [],
    addEventListener(type, fn) { if (type === 'change') this.fns.push(fn) },
  }
  const sent = []
  const win = {
    location: { origin },
    frames: [],
    document: {
      documentElement: {
        getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null),
        setAttribute: (n, v) => attrs.set(n, String(v)),
        removeAttribute: (n) => attrs.delete(n),
      },
    },
    get localStorage() {
      if (blocked) throw new Error('SecurityError')
      return {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
      }
    },
    matchMedia: (q) => { assert.equal(q, '(prefers-color-scheme: dark)'); return scheme },
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn) },
    postMessage(data, target) { sent.push({ data, target }) },
  }
  win.window = win
  vm.runInNewContext(SOURCE, win)
  return {
    win,
    api: win.groundworkTheme,
    attr: () => attrs.get('data-theme') ?? null,
    fire: (type, e) => { for (const fn of listeners[type] ?? []) fn(e) },
    os: (d) => { scheme.matches = d; for (const fn of scheme.fns) fn({ matches: d }) },
    sent,
    store,
  }
}

test('with no choice the page follows the OS: no data-theme, and the effective theme is the OS\'s', () => {
  const light = page()
  assert.equal(light.api.choice, 'system')
  assert.equal(light.attr(), null)
  assert.equal(light.api.theme, 'light')
  assert.equal(page({ dark: true }).api.theme, 'dark')
})

test('a stored choice is set on <html> as soon as the script runs', () => {
  const p = page({ store: new Map([[KEY, 'dark']]) })
  assert.equal(p.api.choice, 'dark')
  assert.equal(p.attr(), 'dark')
  assert.equal(p.api.theme, 'dark')
  const l = page({ store: new Map([[KEY, 'light']]), dark: true })
  assert.equal(l.attr(), 'light')
  assert.equal(l.api.theme, 'light')
})

test('blocked storage or an unknown value means System', () => {
  assert.equal(page({ blocked: true }).api.choice, 'system')
  assert.equal(page({ store: new Map([[KEY, 'purple']]) }).api.choice, 'system')
  const p = page({ blocked: true })
  p.api.set('dark')   // still switches this page, only nothing is kept
  assert.equal(p.attr(), 'dark')
})

test('set() applies the choice, keeps it for the next load, and tells the page\'s frames', () => {
  const store = new Map()
  const shell = page({ store })
  const frame = page({ store })
  shell.win.frames.push(frame.win)
  shell.api.set('dark')
  assert.equal(shell.attr(), 'dark')
  assert.equal(store.get(KEY), 'dark')
  assert.deepEqual(JSON.parse(JSON.stringify(frame.sent)), [{ data: { type: 'groundwork:theme', choice: 'dark' }, target: 'http://localhost:4477' }])
  shell.api.set('system')
  assert.equal(shell.attr(), null)
  assert.equal(store.get(KEY), 'system')
  assert.equal(page({ store }).api.choice, 'system', 'a reload keeps the choice')
})

test('an open page switches live: on the storage event, and on the message from its own origin only', () => {
  const p = page()
  const seen = []
  p.api.onChange((theme, choice) => seen.push([theme, choice]))
  p.fire('storage', { key: KEY, newValue: 'dark' })
  assert.equal(p.attr(), 'dark')
  p.fire('storage', { key: 'groundwork:ui-lang', newValue: 'light' })
  assert.equal(p.attr(), 'dark', 'another key changes nothing')
  p.fire('message', { origin: 'https://evil.example', data: { type: 'groundwork:theme', choice: 'light' } })
  assert.equal(p.attr(), 'dark', 'not from another origin')
  p.fire('message', { origin: 'http://localhost:4477', data: { type: 'groundwork:theme', choice: 'light' } })
  assert.equal(p.attr(), 'light')
  p.fire('storage', { key: KEY, newValue: null })   // storage cleared
  assert.equal(p.attr(), null)
  assert.deepEqual(seen, [['dark', 'dark'], ['light', 'light'], ['light', 'system']])
})

test('onChange tells the effective theme also when the OS switches while the choice is System', () => {
  const p = page()
  const seen = []
  const off = p.api.onChange((theme) => seen.push(theme))
  p.os(true)
  assert.equal(p.api.theme, 'dark')
  p.api.set('light')
  p.os(false)            // a forced choice ignores the OS
  p.os(true)
  p.api.set('system')
  off()
  p.os(false)
  assert.deepEqual(seen, ['dark', 'light', 'dark'])
})

test('every module page loads the switch first in <head>, so its frame paints and switches with the shell', () => {
  const views = MODULES.filter((m) => m.view)
  assert.ok(views.length >= 3)
  for (const m of views) {
    const html = fs.readFileSync(path.join(m.view.dir, 'index.html'), 'utf8')
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1]
    const at = head.indexOf('<script src="/shell/theme.js"></script>')
    assert.ok(at >= 0, `${m.id}: loads /shell/theme.js`)
    assert.ok(at < head.indexOf('<link rel="stylesheet"'), `${m.id}: before the first stylesheet`)
  }
})

test('a module\'s own dark colours follow the choice too, not the OS alone', () => {
  for (const m of MODULES.filter((x) => x.view)) {
    for (const f of m.view.files.filter((x) => x.endsWith('.css'))) {
      const css = fs.readFileSync(path.join(m.view.dir, f), 'utf8')
      if (!/prefers-color-scheme:\s*dark/.test(css)) continue
      assert.doesNotMatch(css, /@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/, `${m.id}/${f}: the OS's dark yields to a chosen light`)
      assert.match(css, /:root\[data-theme="dark"\]/, `${m.id}/${f}: a chosen dark`)
    }
  }
})
