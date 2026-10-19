// The shared design system: the tokens and the .gw-* components every module uses, documented at
// the top of theme.css (that comment is the contract the modules read), and status text that stays
// readable (WCAG AA, 4.5:1) in light and in dark. theme.css holds the tokens and imports the
// components' files beside it; a module links theme.css only.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const THEME = read('./theme.css')
// The files theme.css imports from /shell/, in order.
const PARTS = [...THEME.matchAll(/@import url\('\/shell\/([\w-]+\.css)'\)/g)].map((m) => m[1])
const CSS = [THEME, ...PARTS.map((f) => read('./' + f))].join('\n')
const HEADER = THEME.slice(0, THEME.indexOf('*/'))
const RULES = CSS.slice(CSS.indexOf('*/'))

test('the theme is split into files of about 400 lines at most, which theme.css imports', () => {
  assert.ok(PARTS.length >= 2, `theme.css imports its components: ${PARTS}`)
  for (const f of ['theme.css', ...PARTS]) {
    const lines = read('./' + f).split('\n').length
    assert.ok(lines <= 420, `${f}: ${lines} lines`)
  }
  for (const f of PARTS) assert.doesNotMatch(read('./' + f), /^\s*:root\s*\{/m, `${f}: the tokens stay in theme.css`)
})

// The --gw-* declarations of every block `opener` starts (the file may add tokens in later blocks), as { name: value }.
function declarations(opener) {
  const out = {}
  const found = [...RULES.matchAll(opener)]
  assert.ok(found.length, String(opener))
  for (const m of found) {
    const body = RULES.slice(m.index + m[0].length)
    for (const d of body.slice(0, body.indexOf('}')).matchAll(/(--gw-[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim()
  }
  return out
}
const LIGHT = declarations(/^:root\s*\{/gm)
const DARK = declarations(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{/g)

const TONES = ['ok', 'warn', 'bad', 'info', 'violet', 'accent']
// Hues with an AA text colour and a soft tint, but no badge or callout tone of their own.
const TEXT_TONES = [...TONES, 'pink']

test('every token is defined, and every token is documented in the header', () => {
  const tokens = [
    '--gw-gradient', '--gw-gradient-fill',
    '--gw-info', '--gw-violet', '--gw-pink',
    ...TEXT_TONES.flatMap((t) => [`--gw-${t}-text`, `--gw-${t}-soft`]),
    '--gw-radius-sm', '--gw-radius', '--gw-radius-lg', '--gw-radius-pill',
    '--gw-text-xs', '--gw-text-small', '--gw-text', '--gw-title', '--gw-display',
    '--gw-shadow-lg',
  ]
  for (const t of tokens) assert.ok(t in LIGHT, `defined: ${t}`)
  for (const t of Object.keys(LIGHT)) assert.match(HEADER, new RegExp(`${t}\\b`), `documented: ${t}`)
})

test('colours that change between light and dark are set in both', () => {
  for (const [name, value] of Object.entries(LIGHT)) {
    if (/^#/.test(value)) assert.ok(name in DARK, `dark ${name}`)
  }
})

test('every component class in the file is documented in the header', () => {
  const classes = new Set([...RULES.matchAll(/\.(gw-[\w-]+)/g)].map((m) => m[1]))
  for (const c of ['gw-badge', 'gw-badge--count', 'gw-tag', 'gw-seg', 'gw-btn', 'gw-btn--primary', 'gw-btn--secondary', 'gw-btn--ghost', 'gw-btn--icon',
    'gw-card', 'gw-card--glass', 'gw-popover', 'gw-popover__title', 'gw-popover__list', 'gw-popover__item', 'gw-empty', 'gw-callout', 'gw-section-head', 'gw-toolbar', 'gw-toast', 'gw-tabs', 'gw-dot', 'gw-progress', 'gw-field']) {
    assert.ok(classes.has(c), `defined: .${c}`)
  }
  for (const tone of [...TONES, 'neutral']) assert.ok(classes.has(`gw-badge--${tone}`), `badge tone ${tone}`)
  for (const c of classes) assert.match(HEADER, new RegExp(`\\.${c}(?![\\w-])`), `documented: .${c}`)
})

// ---- contrast (WCAG 2.x relative luminance) ----

const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) }
const luminance = (c) => {
  const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const over = (fg, bg, alpha) => fg.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha)))

test('status text is AA on every background, also on its own soft tint', () => {
  // the soft tint: color-mix(in srgb, var(--gw-<tone>) N%, transparent), on a page background
  const soft = /color-mix\(in srgb, var\(--gw-[\w-]+\) (\d+)%, transparent\)/.exec(LIGHT['--gw-ok-soft'])
  assert.ok(soft, 'a soft tint is the hue mixed with transparent')
  const alpha = Number(soft[1]) / 100
  for (const [mode, set] of [['light', LIGHT], ['dark', { ...LIGHT, ...DARK }]]) {
    const hue = (t) => rgb(set[`--gw-${t}`])
    for (const bgName of ['--gw-bg', '--gw-surface', '--gw-sunken']) {
      const bg = rgb(set[bgName])
      for (const t of TEXT_TONES) {
        const text = rgb(set[`--gw-${t}-text`])
        assert.ok(contrast(text, bg) >= 4.5, `${mode} ${t}-text on ${bgName}: ${contrast(text, bg).toFixed(2)}`)
        const tint = over(hue(t), bg, alpha)
        assert.ok(contrast(text, tint) >= 4.5, `${mode} ${t}-text on its soft tint over ${bgName}: ${contrast(text, tint).toFixed(2)}`)
      }
      for (const t of ['--gw-fg-2', '--gw-muted']) assert.ok(contrast(rgb(set[t]), bg) >= 4.5, `${mode} ${t} on ${bgName}`)
    }
  }
})

test('text on the filled gradient is AA at both ends', () => {
  for (const [mode, set] of [['light', LIGHT], ['dark', { ...LIGHT, ...DARK }]]) {
    const resolve = (v) => v.replace(/var\((--gw-[\w-]+)\)/g, (_, n) => set[n])
    const stops = [...resolve(set['--gw-gradient-fill']).matchAll(/#[0-9a-f]{6}/gi)].map((m) => rgb(m[0]))
    assert.ok(stops.length >= 2, `${mode}: the fill has its stops`)
    for (const s of stops) assert.ok(contrast(rgb(set['--gw-accent-fg']), s) >= 4.5, `${mode} accent-fg on the fill: ${contrast(rgb(set['--gw-accent-fg']), s).toFixed(2)}`)
  }
})

test('the existing variables keep their names and values', () => {
  const before = { '--gw-ok': '#1f8a4c', '--gw-bad': '#c0392b', '--gw-warn': '#b45309', '--gw-accent': '#2f5bd3', '--gw-accent-2': '#8b5cf6', '--gw-text': '15px/1.5', '--gw-text-small': '13px/1.4', '--gw-radius': '10px' }
  for (const [k, v] of Object.entries(before)) assert.equal(LIGHT[k], v, k)
})
