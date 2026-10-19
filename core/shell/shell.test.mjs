// The shell page (shellPage): it owns the tab's live connection, switches modules without a page
// load, and its header is built from the shared components.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { shellPage } from './shell.mjs'
import { SHELL_STRINGS } from './strings.mjs'

const view = (id, name) => ({ id, name, version: '1', view: { dir: '.', files: ['index.html'] } })
const page = (extra = {}) => shellPage({ project: 'groundwork', version: '1.0.0', modules: [view('plan', 'Plan'), view('build', 'Build')], active: 'plan', params: new URLSearchParams(), ...extra })
const script = (html) => /<script type="module">([\s\S]*?)<\/script>/.exec(html)[1]
const SHELL_CSS = fs.readFileSync(new URL('./shell.css', import.meta.url), 'utf8')

test('the shell opens the tab\'s one live stream through the relay, not an EventSource of its own', () => {
  const js = script(page())
  assert.match(js, /import \{ relayEvents \} from '\/shell\/live\.mjs'/)
  assert.match(js, /relayEvents\(\{/)
  assert.doesNotMatch(js, /new EventSource/)
})

test('the language is a segmented control with the short codes, the current one pressed', () => {
  const html = page()
  const seg = /<div class="gw-seg gw-lang" role="group"([^>]*)>([\s\S]*?)<\/div>/.exec(html)
  assert.ok(seg, 'a .gw-seg group')
  assert.match(seg[1], /aria-label="Language" data-i18n-aria-label="language"/)
  const buttons = [...seg[2].matchAll(/<button type="button" data-lang="(\w+)" title="([^"]+)" aria-pressed="(true|false)">(\w+)<\/button>/g)].map((m) => m.slice(1))
  assert.deepEqual(buttons, [['en', 'English', 'true', 'EN'], ['hu', 'Magyar', 'false', 'HU']])
  assert.doesNotMatch(html, /<select class="gw-lang"/)
})

test('switching modules keeps the page: the tab links are handled in place, with history', () => {
  const html = page()
  assert.match(html, /<a href="\/\?module=build">/, 'a plain link still works without the script')
  const js = script(html)
  assert.match(js, /history\.pushState/)
  assert.match(js, /addEventListener\('popstate'/)
  assert.match(js, /location\.replace/, 'the frame is replaced, not stacked in history')
})

test('the project name needs no extra font: no italic, and not the serif', () => {
  const rule = /\.gw-project\s*\{([^}]*)\}/.exec(SHELL_CSS)[1]
  assert.doesNotMatch(rule, /italic|--gw-font-serif/)
  assert.doesNotMatch(SHELL_CSS, /italic/)
})

test('no module with a view: the shared empty state', () => {
  const html = shellPage({ project: 'p', modules: [], active: null })
  assert.match(html, /<div class="gw-empty">[\s\S]*<p class="gw-empty__title" data-i18n="noView">No module has a view\.<\/p>[\s\S]*<p class="gw-empty__text" data-i18n="noViewText">/)
  assert.ok(SHELL_STRINGS.en.noViewText && SHELL_STRINGS.hu.noViewText)
})

test('the shell uses the shared tokens: the gradient marks the current tab', () => {
  assert.match(SHELL_CSS, /aria-current="page"\][^{]*::before\s*\{[^}]*var\(--gw-gradient\)/)
  assert.doesNotMatch(SHELL_CSS, /linear-gradient\(90deg, var\(--gw-accent\), var\(--gw-accent-2\)\)/, 'the token, not a copy of it')
})
