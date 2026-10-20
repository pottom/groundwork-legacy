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

test('a status asks in the drawer for the field it needs: Rejected a reason, Snoozed a date, Duplicate an idea', () => {
  const drawer = read('view/drawer.mjs')
  assert.match(drawer, /'rejected' \?[^\n]*name="reason"[^\n]*required/)
  assert.match(drawer, /'snoozed' \?[^\n]*type="date"[^\n]*name="until"[^\n]*required/)
  assert.match(drawer, /'duplicate' \?[^\n]*name="duplicate"[^\n]*required/)
  const main = read('view/main.mjs')
  assert.match(main, /ASKS_IN_DRAWER = \['snoozed', 'duplicate'\]/, 'a move to those columns opens the drawer')
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

test('a card shows the sketches that link to its idea (Sketch\'s public GET /api/sketch/links) and opens one in the shell', () => {
  const src = viewSource()
  assert.match(src, /fetch\('\/api\/sketch\/links'/)
  assert.match(src, /'sketch\.links'/, 'follows the links live')
  assert.match(read('view/board.mjs'), /\/\?module=sketch&sketch=/)
  assert.match(read('view/board.mjs'), /target="_top"/)
})

test('a link to an idea (/?module=ideas&idea=I-12, a sketch\'s or a map node\'s) opens it in the drawer', () => {
  assert.match(read('view/main.mjs'), /new URLSearchParams\(location\.search\)\.get\('idea'\)/)
})

test('a move to Accepted asks the route, Grilling or Straight to a ticket, defaulted by the idea\'s kind, and accepts through POST /api/ideas/accept', () => {
  const main = read('view/main.mjs')
  assert.match(main, /status === 'accepted'[\s\S]{0,120}route: routeFor\(idea\)/, 'the move opens the route question, with the default')
  assert.match(main, /\$\('accept'\)\.showModal\(\)/)
  assert.match(read('index.html'), /<dialog id="accept" aria-labelledby="accept-title">/)
  const accept = read('view/accept.mjs')
  assert.match(accept, /ROUTES\.map\(/)
  assert.match(accept, /aria-pressed=/)
  assert.match(accept, /ask\.error/, 'the server\'s refusal shows in the dialog')
  const api = read('view/api.mjs')
  assert.match(api, /`\/api\/ideas\/accept\?id=\$\{[^}]+\}`/)
  assert.match(api, /method: 'POST'/)
  assert.match(api, /JSON\.stringify\(\{ route, base: idea\.version \}\)/)
  assert.match(read('view/drawer.mjs'), /s !== 'accepted' \|\| idea\.status === 'accepted'/, 'the drawer does not accept by a change of status')
})

test('the route\'s default follows the kind: product → Grilling, engineering → Straight to a ticket', async () => {
  const { ROUTES, routeFor } = await import('./fields.mjs')
  assert.deepEqual(ROUTES, ['grilling', 'ticket'])
  assert.equal(routeFor({ kind: 'product' }), 'grilling')
  assert.equal(routeFor({ kind: 'engineering' }), 'ticket')
  assert.equal(routeFor({}), 'grilling')
  const { ROUTES: CORE_ROUTES } = await import('../../core/records/accept.mjs')
  assert.deepEqual(ROUTES, CORE_ROUTES, 'the page offers the routes the core takes')
})

test('a card shows the changes its idea opened, → C-n · <stage>, linking to the change\'s page in the shell', () => {
  const board = read('view/board.mjs')
  assert.match(board, /\$\{changePart\(idea\)\}/)
  const part = read('view/changes.mjs')
  assert.match(part, /recordHref\(\{ id: c\.id, name: 'change', module: 'changes' \}\)/, '/?module=changes&change=C-n')
  assert.match(part, /target="_top"/)
  assert.match(part, /ui\(`change\.\$\{c\.status\}`\)/)
  assert.match(read('view/main.mjs'), /topics\.includes\('records'\)/, 'the card follows its change live')
})

test('every stage of a change has a label on the card', async () => {
  const { CHANGE_TYPE } = await import('../changes/type.mjs')
  const { UI_STRINGS } = await import('./ui-strings.mjs')
  for (const s of CHANGE_TYPE.lifecycle.states) assert.ok(UI_STRINGS.en[`change.${s}`] && UI_STRINGS.hu[`change.${s}`], s)
})

test('a card shows its quiet marks from the list (date passed, old) as neutral badges; a mark moves nothing', () => {
  const board = read('view/board.mjs')
  assert.match(board, /idea\.marks/)
  assert.match(board, /class="gw-badge gw-badge--neutral idea__mark"/)
  assert.match(board, /'snooze-passed': \[ui\('mark\.snooze-passed'\), ui\('mark\.snooze-passed-title'\)\]/)
  assert.match(board, /stale: \[ui\('mark\.stale'\), ui\('mark\.stale-title'\)\]/)
  assert.doesNotMatch(viewSource(), /marks[^\n]*act\.move/)
})
