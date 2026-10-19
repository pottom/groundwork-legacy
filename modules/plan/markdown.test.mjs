// The Markdown of Plan's documents panel (markdown.mjs, with the bundled marked): the text of the
// map and of the documents is shown, never run. Raw HTML in it shows as text, and a link goes only
// to http(s), mailto or a relative address.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Marked } from '../../core/vendor/marked/marked.esm.js'
import { MARKDOWN_OPTIONS, createMarkdown } from './markdown.mjs'

const md = new Marked(MARKDOWN_OPTIONS)
const render = (text) => md.parse(text)

test('ordinary Markdown renders as before: emphasis, lists, code, tables', () => {
  assert.equal(render('Some **bold** and `code`.'), '<p>Some <strong>bold</strong> and <code>code</code>.</p>\n')
  assert.match(render('- one\n- two'), /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/)
  assert.match(render('| a | b |\n|---|---|\n| 1 | 2 |'), /<table>/)
})

test('raw HTML in the text shows as text, inline and as a block', () => {
  const inline = render('Hello <img src=x onerror=alert(1)> there')
  assert.doesNotMatch(inline, /<img/)
  assert.match(inline, /&lt;img src=x onerror=alert\(1\)&gt;/)
  const block = render('<script>alert(1)</script>\n\nnext')
  assert.doesNotMatch(block, /<script/)
  assert.match(block, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('links go to http(s), mailto and relative addresses only; anything else is just its text', () => {
  assert.equal(render('[site](https://example.com/a?b=1&c=2)'), '<p><a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">site</a></p>\n')
  assert.match(render('[mail](mailto:a@example.com)'), /<a href="mailto:a@example.com"/)
  assert.match(render('[doc](core/PRD.md)'), /<a href="core\/PRD.md">doc<\/a>/)
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example/x', '/\\evil.example']) {
    const out = render(`[bad](<${bad}>)`)
    assert.doesNotMatch(out, /<a /, bad)
    assert.match(out, /bad/)
  }
  assert.doesNotMatch(render('![x](javascript:alert(1))'), /<img/)
  assert.match(render('<https://example.com>'), /<a href="https:\/\/example.com"/)
})

test('a title and the link text are escaped', () => {
  assert.match(render('[a](https://x.example "say \\"hi\\" <b>")'), /title="say &quot;hi&quot; &lt;b&gt;"/)
})

test('a checklist note renders inline: emphasis and code, no paragraph around it, raw HTML still as text', () => {
  const { inline, block } = createMarkdown(Marked)
  assert.equal(inline('A jegyben pl. **PRD:** d-npm sor.'), 'A jegyben pl. <strong>PRD:</strong> d-npm sor.')
  assert.equal(inline('see `ids` and [docs](javascript:alert(1))'), 'see <code>ids</code> and docs')
  assert.doesNotMatch(inline('x <b onclick=y>z</b>'), /<b/)
  assert.equal(inline(''), '')
  assert.equal(block('Some **bold**.'), render('Some **bold**.'), 'a paragraph renders as before')
})
