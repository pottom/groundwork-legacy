// The map's look follows the operating system's light or dark mode, also when it changes while the page is open.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mapTheme, followColorScheme } from './map-theme.mjs'
import plan from './module.mjs'

// A stand-in for matchMedia('(prefers-color-scheme: dark)').
function fakeScheme(matches) {
  const listeners = []
  return {
    matches,
    addEventListener: (type, fn) => type === 'change' && listeners.push(fn),
    flip() { this.matches = !this.matches; for (const fn of listeners) fn({ matches: this.matches }) },
  }
}

test('the map theme has a light and a dark variant built from the shell colours', () => {
  const css = (name) => `var(${name})`
  const light = mapTheme({ dark: false, css })
  const dark = mapTheme({ dark: true, css })
  assert.equal(light.name, 'grill-light')
  assert.equal(light.type, 'light')
  assert.equal(dark.name, 'grill-dark')
  assert.equal(dark.type, 'dark')
  assert.equal(light.palette[0], '#3b82f6')
  assert.equal(dark.palette[0], '#60a5fa')
  assert.equal(dark.cssVar['--color'], 'var(--gw-fg)')
})

test('the theme is applied at once and again whenever the OS switches between light and dark', () => {
  const scheme = fakeScheme(false)
  const seen = []
  followColorScheme(scheme, (dark) => seen.push(dark))
  assert.deepEqual(seen, [false])
  scheme.flip()
  scheme.flip()
  assert.deepEqual(seen, [false, true, false])
})

test('the Plan view uses the followed theme, and serves the file', () => {
  assert.ok(plan.view.files.includes('map-theme.mjs'))
  const html = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8')
  assert.match(html, /followColorScheme\(matchMedia\('\(prefers-color-scheme: dark\)'\)/)
  assert.doesNotMatch(html, /matchMedia\('\(prefers-color-scheme: dark\)'\)\.matches/)
})
