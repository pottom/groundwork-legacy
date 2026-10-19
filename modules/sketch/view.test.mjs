// Sketch's page: a thin index.html that loads React and Excalidraw from /vendor/ (offline), and small
// ES modules. Excalidraw is large, so nothing but this page loads it: Plan and Build stay as fast.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import sketch from './module.mjs'
import { MODULES } from '../../core/modules.mjs'
import { SHELL_DIR } from '../../core/server.mjs'
import { shellPage } from '../../core/shell/shell.mjs'
import { SKETCH_STRINGS as STRINGS } from './ui-strings.mjs'

const read = (f) => fs.readFileSync(path.join(sketch.view.dir, f), 'utf8').replace(/\r\n/g, '\n')
const local = (spec) => spec.startsWith('./') || spec.startsWith('../')
const HEAVY = /\/vendor\/(excalidraw|react|react-dom)\//

test('index.html is a thin page: no inline script or style; React, then Excalidraw with its assets pointed at /vendor/, then the entry', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<style\b/)
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script')
  const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"/g)].map((m) => m[2])
  assert.deepEqual(scripts, [
    '/shell/theme.js',
    './view/asset-path.js',
    '/vendor/react/react.production.min.js',
    '/vendor/react-dom/react-dom.production.min.js',
    '/vendor/excalidraw/excalidraw.production.min.js',
    './view/main.mjs',
  ])
  assert.match(html, /<script type="module" src="\.\/view\/main\.mjs"><\/script>/)
  assert.match(read('view/asset-path.js'), /window\.EXCALIDRAW_ASSET_PATH = '\/vendor\/excalidraw\/'/, 'or Excalidraw fetches its fonts and locales from unpkg')
  for (const f of ['react/react.production.min.js', 'react-dom/react-dom.production.min.js', 'excalidraw/excalidraw.production.min.js', 'excalidraw/excalidraw-assets/Virgil.woff2'])
    assert.ok(fs.existsSync(path.join(SHELL_DIR, '..', 'vendor', f)), f)
  assert.ok(fs.readdirSync(path.join(SHELL_DIR, '..', 'vendor', 'excalidraw', 'excalidraw-assets', 'locales')).some((f) => f.startsWith('hu-HU-json')), 'the Hungarian locale is there')
})

test('every file the page loads from the module is listed in the manifest, and none is longer than about 400 lines', () => {
  const listed = new Set(sketch.view.files)
  const seen = new Set(['index.html'])
  const queue = ['index.html']
  while (queue.length) {
    const f = queue.shift()
    const src = read(f)
    const refs = [
      ...[...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g)].map((m) => m[1]),
      ...[...src.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
    ].filter(local)
    for (const ref of refs) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), ref))
      assert.ok(listed.has(target), `${f} loads ${ref}: ${target} is in view.files`)
      if (!seen.has(target)) { seen.add(target); queue.push(target) }
    }
  }
  for (const f of listed) assert.ok(seen.has(f), `${f} is listed and the page loads it`)
  for (const f of listed) assert.ok(read(f).split('\n').length <= 420, f)
})

test('only the Sketch page loads Excalidraw and React: no other module, and not the shell', () => {
  assert.ok(MODULES.includes(sketch), 'Sketch is registered')
  const others = MODULES.filter((m) => m !== sketch && m.view)
  assert.ok(others.length >= 2)
  for (const m of others) for (const f of m.view.files) {
    assert.doesNotMatch(fs.readFileSync(path.join(m.view.dir, f), 'utf8'), HEAVY, `${m.id}/${f}`)
  }
  for (const f of fs.readdirSync(SHELL_DIR)) assert.doesNotMatch(fs.readFileSync(path.join(SHELL_DIR, f), 'utf8'), HEAVY, `shell/${f}`)
  const shell = shellPage({ project: 'p', version: '1', modules: MODULES, active: 'plan', params: new URLSearchParams() })
  assert.doesNotMatch(shell, HEAVY)
  assert.doesNotMatch(shell, /src="\/sketch\//, 'the Sketch frame is made only when its tab is opened')
})

test('Sketch is the last tab, a tool after the workflow', () => {
  const tabs = MODULES.filter((m) => m.view)
  assert.equal(tabs.at(-1), sketch)
  assert.ok(tabs.slice(0, -1).every((m) => !m.tool))
})

test('the board follows the shell: light or dark as the shell\'s switch says, the UI language, and embeds are off', () => {
  const board = read('view/board.mjs')
  const main = read('view/main.mjs')
  assert.match(main, /followTheme\(\(dark\) => board\.set\(\{ dark \}\)\)/)
  const theme = read('view/theme.mjs')
  assert.match(theme, /groundworkTheme\.onChange\(/, 'the one place that knows where light or dark comes from: /shell/theme.js')
  assert.doesNotMatch(theme, /prefers-color-scheme/, 'not the OS alone: the shell\'s choice')
  assert.match(board, /theme: dark \? 'dark' : 'light'/)
  assert.match(board, /langCode: lang === 'hu' \? 'hu-HU' : 'en'/)
  assert.match(main, /i18n\.onChange\(/)
  assert.match(board, /validateEmbeddable: false/, 'no iframe of another site (and the tweet template never runs)')
})

test('the page follows its sketch live: on sketch.files (and on reconnect) it reads the file again and merges it into the board', () => {
  const main = read('view/main.mjs')
  assert.match(main, /import \{ subscribe \} from '\/shell\/live\.mjs'/)
  assert.match(main, /topics\.includes\('sketch\.files'\)/)
  assert.match(main, /onHello:/)
  assert.match(main, /followDisk\(/)
  assert.match(main, /updateScene\(\{ elements/)
  assert.match(main, /saver\.loaded\(/)
  assert.match(read('view/board.mjs'), /excalidrawAPI:/)
})

test('a save sends the deleted elements too (Excalidraw\'s serializeAsJSON drops them), so a deletion survives the merge', () => {
  const main = read('view/main.mjs')
  assert.doesNotMatch(main, /serializeAsJSON\(/)
  assert.match(main, /type: 'excalidraw'/)
})

test('the board offers Hungarian, which Excalidraw 0.17.6 leaves out of its languages (70% translated)', async () => {
  const { offerHungarian, boardProps } = await import('./view/board.mjs')
  const languages = [{ code: 'en', label: 'English' }]
  offerHungarian(languages)
  offerHungarian(languages)
  assert.deepEqual(languages.map((l) => l.code), ['en', 'hu-HU'])
  const scene = { elements: [], appState: {}, files: {} }
  assert.equal(boardProps({ scene, lang: 'hu' }).langCode, 'hu-HU')
  assert.equal(boardProps({ scene, lang: 'en', dark: true }).theme, 'dark')
})

test('which sketch opens: the deep link, else the one opened last, else the first, else main', async () => {
  const { chooseSketch } = await import('./view/sketches.mjs')
  const names = ['architecture', 'flow']
  assert.equal(chooseSketch({ asked: 'flow', remembered: 'architecture', names }), 'flow')
  assert.equal(chooseSketch({ asked: 'brand-new', names }), 'brand-new', 'a deep link to a sketch not drawn yet opens it empty')
  assert.equal(chooseSketch({ asked: '../x', remembered: 'flow', names }), 'flow', 'not a plain name: ignored')
  assert.equal(chooseSketch({ asked: null, remembered: 'flow', names }), 'flow')
  assert.equal(chooseSketch({ asked: null, remembered: 'gone', names }), 'architecture', 'a remembered sketch renamed or deleted since')
  assert.equal(chooseSketch({ asked: null, remembered: null, names: [] }), 'main')
})

test('a link to a sketch\'s old name opens it under its new one, unless a new sketch took the name', async () => {
  const { chooseSketch } = await import('./view/sketches.mjs')
  const renamed = { flow: 'checkout' }
  assert.equal(chooseSketch({ asked: 'flow', names: ['checkout'], renamed }), 'checkout')
  assert.equal(chooseSketch({ asked: null, remembered: 'flow', names: ['a', 'checkout'], renamed }), 'checkout')
  assert.equal(chooseSketch({ asked: 'flow', names: ['checkout', 'flow'], renamed }), 'flow')
})

test('a shape\'s link to an idea, a map node, a ticket or a sketch opens it in the shell; another link is Excalidraw\'s', async () => {
  const { boardProps } = await import('./view/board.mjs')
  const opened = []
  const props = boardProps({ scene: { elements: [], appState: {}, files: {} }, renamed: { old: 'flow' }, openLink: (u) => opened.push(u) })
  const click = (link) => {
    let prevented = false
    props.onLinkOpen({ id: 'r1', link }, { preventDefault: () => { prevented = true } })
    return prevented
  }
  assert.equal(click('groundwork://idea/I-12'), true)
  assert.equal(click('groundwork://sketch/old'), true)
  assert.equal(click('https://example.com'), false)
  assert.deepEqual(opened, ['/?module=ideas&idea=I-12', '/?module=sketch&sketch=flow'])
})

test('the page lists the sketch\'s links and adds or removes one (links.mjs)', () => {
  const page = read('view/main.mjs') + read('view/links.mjs')
  for (const api of ['/api/sketch/links', '/api/sketch/link', '/api/sketch/unlink']) assert.ok(page.includes(api), api)
  assert.match(page, /'sketch\.links'/, 'and follows them live')
  assert.match(read('index.html'), /id="links"/)
})

test('the page opens the sketch the shell deep-links to (/?module=sketch&sketch=<name>) and remembers it', () => {
  const main = read('view/main.mjs')
  assert.match(main, /new URLSearchParams\(location\.search\)\.get\('sketch'\)/)
  assert.match(main, /localStorage/)
  const bar = read('view/sketches.mjs')
  for (const api of ['/api/sketch/list', '/api/sketch/create', '/api/sketch/rename']) assert.ok((main + bar).includes(api), api)
  assert.match(read('index.html'), /<nav[^>]*id="sketches"/)
})

test('the strings: same keys in English and Hungarian, translated, and every one used', () => {
  const { en, hu } = STRINGS
  assert.deepEqual(Object.keys(hu).sort(), Object.keys(en).sort())
  for (const k of Object.keys(en)) assert.notEqual(hu[k], en[k], k)
  const page = sketch.view.files.filter((f) => f !== 'ui-strings.mjs').map(read).join('\n')
  for (const k of Object.keys(en)) assert.ok(page.includes(`'${k}'`) || page.includes(`"${k}"`), `${k} is used`)
  assert.equal(read('index.html').match(/<html lang="en">/)?.length, 1)
})
