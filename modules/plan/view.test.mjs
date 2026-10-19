// Plan's page is a thin index.html and small ES modules that render with lit-html (#20):
// the server serves only the files the manifest lists, so every file the page loads must be listed.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import plan from './module.mjs'
import { viewSource } from './view-source.test-helper.mjs'

const read = (f) => fs.readFileSync(path.join(plan.view.dir, f), 'utf8')
const local = (spec) => spec.startsWith('./') || spec.startsWith('../')

test('index.html is a thin shell: no inline script or style, it loads the view\'s entry module', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<style\b/)
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script')
  assert.match(html, /<script type="module" src="\.\/view\/main\.mjs"><\/script>/)
  assert.ok(html.split('\n').length < 60, 'a few lines')
})

test('no file of the view is longer than about 400 lines', () => {
  for (const f of plan.view.files) assert.ok(read(f).split('\n').length <= 420, `${f}: ${read(f).split('\n').length} lines`)
})

test('every file the page loads from the module is listed in the manifest, so the server serves it', () => {
  const listed = new Set(plan.view.files)
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

test('the view renders through lit-html templates, not hand-built HTML strings', () => {
  const src = viewSource()
  assert.match(src, /from '\/vendor\/lit-html\/lit-html\.js'/)
  assert.match(src, /from '\/vendor\/lit-html\/directives\/unsafe-html\.js'/, "marked's HTML goes in through unsafeHTML")
  assert.match(src, /new Marked\(MARKDOWN_OPTIONS\)/, 'marked renders with the safe options of markdown.mjs')
  assert.doesNotMatch(src, /import \{ marked \}/, 'not the global marked with its defaults')
  assert.doesNotMatch(src, /\.innerHTML\s*=|insertAdjacentHTML/)
})

test('Plan\'s colours come from the design system: "ask about it" is the theme\'s pink, the legend a popover', () => {
  // Plan's own files (the shared map-theme.mjs has a pink of its own among the branch colours)
  const src = plan.view.files.filter((f) => f.startsWith('view/')).map(read).join('\n')
  assert.match(src, /--todo:\s*var\(--gw-pink\)/)
  assert.doesNotMatch(src, /#d6336c|#f472b6/i)
  assert.match(src, /class="gw-popover"/)
})
