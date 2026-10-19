// Build's user interface goes through the core's translation (core/shell/i18n.mjs, served at
// /shell/i18n.mjs): English by default, every label also in Hungarian, following the language
// chosen in the shell. The strings are BUILD_STRINGS in ui-strings.mjs, beside the page.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createI18n, LANG_KEY } from '../../core/shell/i18n.mjs'
import build from './module.mjs'
import { BUILD_STRINGS as STRINGS } from './ui-strings.mjs'
import { pageSource } from './page-files.test-helper.mjs'

// Line endings depend on the checkout (core.autocrlf): compare without them.
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SHELL = read('./index.html')
const PAGE = pageSource()
const HUNGARIAN_LETTERS = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
// Lines that read the project's own (possibly Hungarian) markdown carry this marker; they are
// parsing, not UI text.
const READS_FILES = 'reads Hungarian files too'

const { en, hu } = STRINGS

test('the page uses the shell\'s translation mechanism and its own strings, both as ES modules', () => {
  assert.match(PAGE, /import \{ createI18n, LANGS \} from '\/shell\/i18n\.mjs'/)
  assert.match(PAGE, /import \{ BUILD_STRINGS \} from '\.\.\/ui-strings\.mjs'/)
  assert.doesNotMatch(PAGE, /const BUILD_STRINGS|function createI18n/, 'no copy left')
  assert.ok(build.view.files.includes('ui-strings.mjs'), 'ui-strings.mjs is served')
})

test('the strings hold no markup: code is marked with backticks and rendered by the page', () => {
  for (const [lang, set] of Object.entries(STRINGS)) {
    for (const [k, v] of Object.entries(set)) assert.doesNotMatch(v, /<[a-z/]|&[a-z#]+;/i, `${lang} ${k}`)
  }
  assert.ok(Object.values(en).some((v) => /`[^`]+`/.test(v)), 'some text has code in backticks')
})

test('the page has no Hungarian text outside its strings', () => {
  const lines = PAGE.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => HUNGARIAN_LETTERS.test(l) && !l.includes(READS_FILES))
  assert.deepEqual(lines, [])
  assert.match(SHELL, /<html lang="en">/)
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
  const rest = PAGE + read('./ticket-reader.mjs')   // the reader names the problems' strings
  const spaces = new Set(Object.keys(en).map((k) => k.split('.')[0]))
  const used = new Set()
  // (a file name such as "ticket-reader.mjs" is no key)
  // (nor is a live topic of another module, such as 'sketch.links' in refresh.mjs)
  const topics = new Set(['sketch.links'])
  for (const m of rest.matchAll(/['"`]([a-z][\w-]*)\.([\w.-]*[\w-])['"`]/g)) if (spaces.has(m[1]) && !/\.(m?js|css)$/.test(m[2]) && !topics.has(`${m[1]}.${m[2]}`)) used.add(`${m[1]}.${m[2]}`)
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
  assert.match(SHELL, /<header id="top">/)
  assert.match(PAGE, /export function topView[\s\S]*<select id="lang"/, 'the picker is in the page\'s own bar (rendered into #top)')
  assert.match(PAGE, /\.in-shell #top[^{]*\{\s*display:\s*none/, 'which the shell hides')
  assert.match(PAGE, /i18n\.set\(/)
  assert.match(PAGE, /i18n\.onChange\(/)
})
