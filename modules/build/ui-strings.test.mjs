// Build's user interface goes through the core's translation (core/shell/i18n.mjs): English by
// default, every label also in Hungarian, following the language chosen in the shell.
//
// The page also runs without the server (opened by double click, from file://), where neither
// /shell/ nor module imports are available, only classic <script src> next to the page. So Build
// carries what it needs as two classic scripts beside index.html: a copy of the mechanism
// (i18n.js, kept equal to core/shell/i18n.mjs here) and its strings (ui-strings.js, BUILD_STRINGS).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createI18n, LANG_KEY } from '../../core/shell/i18n.mjs'
import build from './module.mjs'

// Line endings depend on the checkout (core.autocrlf): compare without them.
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const PAGE = read('./index.html')
const SHELL_I18N = read('../../core/shell/i18n.mjs')
const HUNGARIAN_LETTERS = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
// Lines that read the project's own (possibly Hungarian) markdown carry this marker; they are
// parsing, not UI text.
const READS_FILES = 'reads Hungarian files too'

const I18N_COPY = read('./i18n.js')
const STRINGS_FILE = read('./ui-strings.js')
const STRINGS = vm.runInNewContext(STRINGS_FILE + '\n;BUILD_STRINGS')
const { en, hu } = STRINGS

test('the page carries the shell\'s translation mechanism unchanged', () => {
  assert.equal(I18N_COPY.trim(), SHELL_I18N.replace(/^export /gm, '').trim())
})

test('the translation and the strings load as classic scripts beside the page, before its own script', () => {
  const srcs = [...PAGE.matchAll(/<script\b([^>]*)>/g)].map((m) => /src="([^"]+)"/.exec(m[1])?.[1] ?? null)
  assert.deepEqual(srcs.filter(Boolean), ['i18n.js', 'ui-strings.js', 'ticket-reader.js'])
  assert.ok(srcs.indexOf('ticket-reader.js') < srcs.lastIndexOf(null), 'loaded before the page script')
  assert.doesNotMatch(PAGE, /type="module"/)
  assert.doesNotMatch(PAGE, /const BUILD_STRINGS|function createI18n/, 'no inline copy left')
  for (const f of ['i18n.js', 'ui-strings.js', 'ticket-reader.js']) assert.ok(build.view.files.includes(f), `${f} is served`)
})

test('the page has no Hungarian text outside its strings', () => {
  const lines = PAGE.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => HUNGARIAN_LETTERS.test(l) && !l.includes(READS_FILES))
  assert.deepEqual(lines, [])
  assert.match(PAGE, /<html lang="en">/)
})

test('the English and the Hungarian set have the same keys, and the Hungarian one is translated', () => {
  assert.deepEqual(Object.keys(hu).sort(), Object.keys(en).sort())
  const same = Object.keys(en).filter((k) => hu[k] === en[k] && /[a-z]{3}/i.test(en[k]) && !/^[\w-]+$/.test(en[k]))
  assert.deepEqual(same, [])
  for (const k of Object.keys(en)) {
    const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    assert.deepEqual(vars(hu[k]), vars(en[k]), `placeholders of ${k}`)
  }
})

test('every key the page uses has a text, and every text is used', () => {
  const rest = PAGE + read('./ticket-reader.js')   // the reader names the problems' strings
  const spaces = new Set(Object.keys(en).map((k) => k.split('.')[0]))
  const used = new Set()
  for (const m of rest.matchAll(/['"`]([a-z][\w-]*)\.([\w.-]*[\w-])['"`]/g)) if (spaces.has(m[1])) used.add(`${m[1]}.${m[2]}`)
  assert.ok(used.size > 100, `${used.size} keys`)
  for (const k of used) assert.ok(k in en, `no text for ${k}`)
  for (const k of Object.keys(en)) assert.ok(used.has(k), `${k} is not used`)
})

test('English by default; the language chosen in the shell is followed', () => {
  const store = (value) => ({ getItem: (k) => (k === LANG_KEY ? value : null), setItem() {} })
  assert.equal(createI18n(STRINGS, { storage: store(null), win: null }).t('page.title'), 'Development status')
  assert.equal(createI18n(STRINGS, { storage: store('hu'), win: null }).t('page.title'), 'Fejlesztési állapot')
})

test('alone, the page has its own language picker; inside the shell it uses the shell\'s', () => {
  assert.match(PAGE, /<select id="lang" class="gw-lang[ "]/)
  assert.match(PAGE, /<header id="top">[\s\S]*<select id="lang"[\s\S]*<\/header>/, 'the picker is in the page\'s own bar')
  assert.match(PAGE, /\.in-shell #top\s*\{\s*display:\s*none/, 'which the shell hides')
  assert.match(PAGE, /i18n\.set\(/)
  assert.match(PAGE, /i18n\.onChange\(/)
})
