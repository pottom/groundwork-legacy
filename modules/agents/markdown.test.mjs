// An agent's final report as the page renders it (view/markdown.mjs with the bundled marked): the
// agent wrote it, so it is shown and never run. Raw HTML shows as text, a link goes only to
// http(s), mailto or a relative address, and no image is loaded.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Marked } from '../../core/vendor/marked/marked.esm.js'
import { MARKDOWN_OPTIONS } from './view/markdown.mjs'

const render = (text) => new Marked(MARKDOWN_OPTIONS).parse(text)

test('a report renders as Markdown: headings, lists, code, tables', () => {
  assert.match(render('## Done\n\n- one\n- `two`'), /<h2[^>]*>Done<\/h2>[\s\S]*<li><code>two<\/code><\/li>/)
  assert.match(render('| a | b |\n|---|---|\n| 1 | 2 |'), /<table>/)
})

test('raw HTML shows as text; script links and images go nowhere', () => {
  const html = render('<script>alert(1)</script>\n\nHi <img src=x onerror=alert(1)> [x](javascript:alert(1)) ![pic](http://x.test/a.png) [ok](https://x.test)')
  assert.doesNotMatch(html, /<script|<img|javascript:/i)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /<a href="https:\/\/x\.test" target="_blank" rel="noopener noreferrer">ok<\/a>/)
})
