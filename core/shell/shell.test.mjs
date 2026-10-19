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
})

test('the modules stay alive: the frames are kept per module, and the server\'s frame says whose it is', () => {
  const html = page({ params: new URLSearchParams('module=plan&node=d-trace') })
  assert.match(html, /<iframe class="gw-view" data-module="plan" title="Plan" src="\/plan\/\?node=d-trace"><\/iframe>/)
  const js = script(html)
  assert.match(js, /import \{ moduleFrames \} from '\/shell\/frames\.mjs'/)
  assert.match(js, /moduleFrames\(/)
  assert.doesNotMatch(js, /location\.replace/, 'a switch does not reload the frame')
})

test('the tools come after the workflow, behind one separator: Plan → Build | Sketch', () => {
  const sketch = { ...view('sketch', 'Sketch'), tool: true }
  const nav = (modules) => /<nav class="gw-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(page({ modules }))[1]
  const order = (html) => [...html.matchAll(/<a href="\/\?module=(\w+)"|<span class="gw-nav-sep"/g)].map((m) => m[1] ?? '|')
  assert.deepEqual(order(nav([view('plan', 'Plan'), view('build', 'Build'), sketch])), ['plan', 'build', '|', 'sketch'])
  assert.deepEqual(order(nav([view('plan', 'Plan'), view('build', 'Build')])), ['plan', 'build'], 'no tools, no separator')
  assert.deepEqual(order(nav([sketch])), ['sketch'], 'nothing before the tools, no separator')
  assert.match(nav([view('plan', 'Plan'), sketch]), /<span class="gw-nav-sep" aria-hidden="true"><\/span>/)
  assert.match(SHELL_CSS, /\.gw-nav-sep\s*\{/)
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

test('no file of the shell is longer than about 400 lines', () => {
  for (const f of fs.readdirSync(new URL('.', import.meta.url))) {
    const lines = fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8').split('\n').length
    assert.ok(lines <= 420, `core/shell/${f}: ${lines} lines`)
  }
})

test('a hidden module frame keeps its size and place: hidden by visibility, stacked under the shown one', () => {
  assert.match(SHELL_CSS, /\.gw-main\s*\{[^}]*position:\s*relative/)
  assert.match(SHELL_CSS, /\.gw-view\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/)
  const hidden = /\.gw-view\[hidden\]\s*\{([^}]*)\}/.exec(SHELL_CSS)?.[1]
  assert.ok(hidden, 'a rule for the hidden frame')
  assert.match(hidden, /display:\s*block/, 'not display: none, which would lay the module out again at 0×0')
  assert.match(hidden, /visibility:\s*hidden/)
})

test('the theme switch loads first in <head>, before the look, so the page paints in the chosen theme', () => {
  const head = /<head>([\s\S]*?)<\/head>/.exec(page())[1]
  const at = (s) => head.indexOf(s)
  assert.ok(at('<script src="/shell/theme.js"></script>') >= 0, 'a plain script, not a deferred module')
  assert.ok(at('<script src="/shell/theme.js">') < at('/shell/theme.css'))
})

test('light or dark is a three-way segmented control in the header: System, Light, Dark, translated', () => {
  const html = page()
  const seg = /<div class="gw-seg gw-theme" role="group"([^>]*)>([\s\S]*?)<\/div>/.exec(html)
  assert.ok(seg, 'a .gw-seg group')
  assert.match(seg[1], /aria-label="Theme" data-i18n-aria-label="theme"/)
  const buttons = [...seg[2].matchAll(/<button type="button" data-theme-choice="(\w+)" title="([^"]+)" aria-label="\2" data-i18n-title="(\w+)" data-i18n-aria-label="\3" aria-pressed="(true|false)">/g)]
    .map((m) => [m[1], m[2], m[4]])
  assert.deepEqual(buttons, [['system', 'Follow the system', 'true'], ['light', 'Light', 'false'], ['dark', 'Dark', 'false']])
  for (const k of ['theme', 'themeSystem', 'themeLight', 'themeDark']) {
    assert.ok(SHELL_STRINGS.en[k] && SHELL_STRINGS.hu[k] && SHELL_STRINGS.hu[k] !== SHELL_STRINGS.en[k], k)
  }
  const js = script(html)
  assert.match(js, /groundworkTheme\.set\(/, 'a button switches')
  assert.match(js, /groundworkTheme\.onChange\(/, 'the pressed button follows a change made elsewhere')
})

test('the brand is the logo file: an image in the bar and the browser tab icon', () => {
  const html = page()
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" href="\/shell\/logo\.svg">/)
  assert.match(html, /<img class="gw-logo" src="\/shell\/logo\.svg" alt="">/)
  assert.doesNotMatch(html, /gw-logo-fill/, 'no inline logo left')
})
