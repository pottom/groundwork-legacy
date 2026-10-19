// The Ideas page is a thin index.html and small ES modules that render with lit-html: the server
// serves only the files the manifest lists, so every file the page loads must be listed.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ideas from './module.mjs'

const read = (f) => fs.readFileSync(path.join(ideas.view.dir, f), 'utf8').replace(/\r\n/g, '\n')
const local = (spec) => spec.startsWith('./') || spec.startsWith('../')
const viewSource = () => ideas.view.files.map(read).join('\n')

test('index.html is a thin shell: no inline script or style, it loads the view\'s entry module', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<style\b/)
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script')
  assert.match(html, /<script type="module" src="\.\/view\/main\.mjs"><\/script>/)
})

test('no file of the view is longer than about 400 lines', () => {
  for (const f of ideas.view.files) assert.ok(read(f).split('\n').length <= 420, f)
})

test('every file the page loads from the module is listed in the manifest, so the server serves it', () => {
  const listed = new Set(ideas.view.files)
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

// Every ES module the page imports, its own and the core's (/shell/, /vendor/), as the page names them.
function moduleGraph() {
  const core = path.join(ideas.view.dir, '..', '..', 'core')
  const file = (url) => (url.startsWith('/shell/') ? path.join(core, 'shell', url.slice(7))
    : url.startsWith('/vendor/') ? path.join(core, 'vendor', url.slice(8)) : path.join(ideas.view.dir, url))
  const seen = new Set()
  const queue = ['/ideas/view/main.mjs']
  while (queue.length) {
    const url = queue.shift()
    if (seen.has(url)) continue
    seen.add(url)
    const src = fs.readFileSync(file(url.replace(/^\/ideas\//, '')), 'utf8')
    for (const [, spec] of src.matchAll(/(?:^|[\s;}])(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']|(?:^|[\s;])import\s*["']([^"']+)["']/gm)) {
      queue.push(spec.startsWith('/') ? spec : path.posix.join(path.posix.dirname(url), spec))
    }
  }
  return [...seen].map((u) => (u.startsWith('/ideas/') ? './' + u.slice(7) : u)).sort()
}

test('index.html preloads every module the page imports, so they load side by side', () => {
  const preloaded = [...read('index.html').matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort()
  const graph = moduleGraph()
  assert.ok(graph.includes('/vendor/lit-html/lit-html.js') && graph.includes('./fields.mjs'), graph.join(' '))
  assert.deepEqual(preloaded, graph.filter((u) => u !== './view/main.mjs'))
})

test('the view renders through lit-html templates, not hand-built HTML strings, and listens through the shell', () => {
  const src = viewSource()
  assert.match(src, /from '\/vendor\/lit-html\/lit-html\.js'/)
  assert.doesNotMatch(src, /\.innerHTML\s*=|insertAdjacentHTML/)
  assert.match(src, /import \{ subscribe \} from '\/shell\/live\.mjs'/)
  assert.doesNotMatch(src, /new EventSource/)
})

test('a card opens in a drawer where every field can be edited, saved through PUT /api/ideas/item/<id> on the version seen', () => {
  const drawer = read('view/drawer.mjs')
  for (const field of ['title', 'body', 'source', 'kind', 'impact', 'effort', 'rationale', 'status', 'reason', 'links']) {
    assert.match(drawer, new RegExp(`name="${field}"`), field)
  }
  const src = viewSource()
  assert.match(src, /`\/api\/ideas\/item\/\$\{[^}]+\}`/)
  assert.match(src, /method: 'PUT'/)
  assert.match(src, /'content-type': 'application\/json'/)
  assert.match(src, /base: [\w.]*version/)
  assert.match(src, /\.status === 409/)
})

test('cards move between columns by drag and drop and by a keyboard menu; Rejected asks for a reason, shown on the card', () => {
  const board = read('view/board.mjs')
  assert.match(board, /draggable="true"/)
  assert.match(board, /@dragstart=/)
  assert.match(board, /@dragover=/)
  assert.match(board, /@drop=/)
  assert.match(board, /aria-haspopup="menu"/, 'a move menu button on every card')
  assert.match(board, /role="menuitem"/)
  assert.match(board, /idea\.reason/)
  const reject = read('view/reject.mjs')
  assert.match(reject, /name="reason"[^>]*required/)
})

test('a second view, the impact–effort matrix: quadrants from matrix.mjs, quick wins highlighted, unestimated ideas apart', () => {
  const matrix = read('view/matrix.mjs')
  assert.match(matrix, /from '\.\.\/matrix\.mjs'/)
  assert.match(matrix, /placeOnMatrix\(/)
  assert.match(matrix, /QUADRANTS\.map\(/)
  assert.match(matrix, /unestimated/)
  assert.match(read('view/ideas.css'), /\.quadrant--quick-wins/, 'the quick-win quadrant is highlighted')
})

test('a card moves between quadrants by drag and drop and by a keyboard menu, which saves its new impact and effort', () => {
  const matrix = read('view/matrix.mjs')
  assert.match(matrix, /draggable="true"/)
  assert.match(matrix, /@dragstart=/)
  assert.match(matrix, /@drop=/)
  assert.match(matrix, /aria-haspopup="menu"/)
  assert.match(matrix, /role="menuitem"/)
  assert.match(read('view/main.mjs'), /saveIdea\([^)]*estimateFor\(/)
})

test('the view switch (Kanban / Matrix) is a segmented control, remembered in the browser', () => {
  const main = read('view/main.mjs')
  assert.match(viewSource(), /class="gw-seg\b/)
  assert.match(viewSource(), /aria-pressed=/)
  assert.match(main, /localStorage\.getItem\(/)
  assert.match(main, /localStorage\.setItem\(/)
  assert.match(main, /try \{[^}]*localStorage/, 'storage may be refused: it never breaks the page')
})

test('the board has the four columns in order, and a card shows number, title, author and source', () => {
  const board = read('view/board.mjs')
  assert.match(board, /STATUSES\.map\(/)
  for (const field of ['idea.id', 'idea.title', 'idea.author', 'idea.source']) assert.ok(board.includes(field), field)
})
