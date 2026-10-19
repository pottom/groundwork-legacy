// The map's look follows the shell's light or dark (the user's choice, else the operating system's),
// also when it changes while the page is open.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mapTheme, followTheme } from './map-theme.mjs'
import plan from './module.mjs'
import { viewSource } from './view-source.test-helper.mjs'

// A stand-in for the shell's switch, window.groundworkTheme (/shell/theme.js).
function fakeTheme(theme) {
  const listeners = []
  return {
    theme,
    onChange: (fn) => { listeners.push(fn) },
    flip() { this.theme = this.theme === 'dark' ? 'light' : 'dark'; for (const fn of listeners) fn(this.theme, this.theme) },
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

test('the theme is applied at once and again whenever the shell switches between light and dark', () => {
  const theme = fakeTheme('light')
  const seen = []
  followTheme(theme, (dark) => seen.push(dark))
  assert.deepEqual(seen, [false])
  theme.flip()
  theme.flip()
  assert.deepEqual(seen, [false, true, false])
})

test('the Plan view uses the followed theme, and serves the file', () => {
  assert.ok(plan.view.files.includes('map-theme.mjs'))
  const html = viewSource()
  assert.match(html, /followTheme\(groundworkTheme,/)
  assert.doesNotMatch(html, /prefers-color-scheme/, 'not the OS alone: the shell\'s choice')
})
