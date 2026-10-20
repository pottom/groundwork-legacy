// The Changes page is a thin index.html and Lit components: the server serves only the files the
// manifest lists, so every file the page loads must be listed, and every module it imports preloaded.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import changes from './module.mjs'
import { UI_STRINGS } from './ui-strings.mjs'

const read = (f) => fs.readFileSync(path.join(changes.view.dir, f), 'utf8').replace(/\r\n/g, '\n')
const local = (spec) => spec.startsWith('./') || spec.startsWith('../')
const viewSource = () => changes.view.files.map(read).join('\n')
const CORE = path.join(changes.view.dir, '..', '..', 'core')

test('index.html is a thin shell: no inline script but Lit\'s import map, no style; it loads the entry module', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<style\b/)
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1].trim())
  assert.deepEqual(inline, ['type="importmap"'], 'the import map is the one inline script')
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('type="module"'), 'the map comes before any module script')
  assert.match(html, /<script type="module" src="\.\/view\/main\.mjs"><\/script>/)
})

// The import map of index.html: Lit's dependencies by package name.
function importMap() {
  const json = /<script type="importmap">([\s\S]*?)<\/script>/.exec(read('index.html'))?.[1]
  return JSON.parse(json ?? '{}').imports
}

test('the import map points Lit\'s dependencies at the vendored files, and lit-html at the one copy', () => {
  assert.deepEqual(importMap(), { 'lit-html': '/vendor/lit-html/lit-html.js', '@lit/reactive-element': '/vendor/reactive-element/reactive-element.js' })
  for (const url of Object.values(importMap())) assert.ok(fs.existsSync(path.join(CORE, 'vendor', url.slice(8))), url)
})

test('every file the page loads from the module is listed in the manifest, so the server serves it', () => {
  const listed = new Set(changes.view.files)
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
})

// Every ES module the page imports, its own and the core's (/shell/, /vendor/, and the bare names
// through the import map), as the page names them.
function moduleGraph() {
  const map = importMap()
  const file = (url) => (url.startsWith('/shell/') ? path.join(CORE, 'shell', url.slice(7))
    : url.startsWith('/vendor/') ? path.join(CORE, 'vendor', url.slice(8)) : path.join(changes.view.dir, url.replace(/^\/changes\//, '')))
  const seen = new Set()
  const queue = ['/changes/view/main.mjs']
  while (queue.length) {
    const url = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)
    const src = fs.readFileSync(file(url), 'utf8')
    for (const [, a, b] of src.matchAll(/(?:^|[\s;}])(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']/gm)) {
      const spec = a ?? b
      if (map[spec]) queue.push(map[spec])
      else if (spec.startsWith('/')) queue.push(spec)
      else { assert.ok(local(spec), `${url} imports ${spec}, which the import map does not name`); queue.push(path.posix.join(path.posix.dirname(url), spec)) }
    }
  }
  return [...seen].map((u) => (u.startsWith('/changes/') ? './' + u.slice(9) : u)).sort()
}

test('index.html preloads every module the page imports, so they load side by side', () => {
  const preloaded = [...read('index.html').matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort()
  const graph = moduleGraph()
  assert.ok(graph.includes('/vendor/lit-element/lit-element.js') && graph.includes('/vendor/reactive-element/css-tag.js'), graph.join(' '))
  assert.deepEqual(preloaded, graph.filter((u) => u !== './view/main.mjs'))
})

test('the page is built from Lit components, uses the core\'s record chip, and listens through the shell', () => {
  const src = viewSource()
  assert.match(src, /from '\/vendor\/lit-element\/lit-element\.js'/)
  assert.match(src, /extends LitElement/)
  assert.match(src, /import '\/shell\/record-chip\.mjs'/)
  assert.match(src, /<gw-record-chip \.record=/)
  assert.doesNotMatch(src, /\.innerHTML\s*=|insertAdjacentHTML/)
  assert.match(src, /import \{ subscribe \} from '\/shell\/live\.mjs'/)
  assert.doesNotMatch(src, /new EventSource/)
  assert.match(src, /'changes\.items'/)
})

test('no file of the view is longer than about 400 lines', () => {
  for (const f of changes.view.files) assert.ok(read(f).split('\n').length <= 420, f)
})

test('the UI strings: English and Hungarian have the same keys, a name for every stage', () => {
  assert.deepEqual(Object.keys(UI_STRINGS.hu).sort(), Object.keys(UI_STRINGS.en).sort())
  for (const s of ['grilling', 'awaiting-approval', 'implementing', 'done', 'dropped']) assert.ok(UI_STRINGS.en[`stage.${s}`], s)
})

test('the page\'s one write is the approval: JSON to /api/changes/approve with the version it shows; a problem goes next to its row', () => {
  const src = read('view/change-page.mjs')
  assert.match(src, /fetch\(`\/api\/changes\/approve\?id=\$\{encodeURIComponent\(p\.id\)\}`/)
  assert.match(src, /'content-type': 'application\/json'/)
  assert.match(src, /JSON\.stringify\(\{ base: p\.version \}\)/)
  assert.match(src, /this\.problemOf\(i\.id\)/, 'a row shows the problem with its item id')
  assert.match(src, /if \(p\.merged\)/, 'a merged change shows no button')
  const fetches = [...viewSource().matchAll(/method: '(\w+)'/g)].map((m) => m[1])
  assert.deepEqual(fetches, ['POST'], 'nothing else on the page writes')
})
