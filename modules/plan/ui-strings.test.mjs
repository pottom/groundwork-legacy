// Plan's user interface goes through the core's translation (core/shell/i18n.mjs):
// English by default, every label also in Hungarian, and none of it touches the documents.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { UI_STRINGS } from './ui-strings.mjs'
import { STATUSES, IMPL } from './node-types.mjs'
import { COMPONENT_TYPES, buildPrd } from './documents.mjs'
import { DEFAULT_DOC_LANG, langOf } from './doc-strings.mjs'
import { LANG_KEY } from '../../core/shell/i18n.mjs'
import plan from './module.mjs'

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8')
const HUNGARIAN_LETTERS = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/

test('the view and the map labels carry no text of their own: no Hungarian left in them', () => {
  for (const f of ['./index.html', './node-types.mjs']) {
    const line = read(f).split('\n').findIndex((l) => HUNGARIAN_LETTERS.test(l))
    assert.equal(line, -1, `${f}:${line + 1}`)
  }
})

test('the English and the Hungarian set have the same keys, and the Hungarian one is translated', () => {
  assert.deepEqual(Object.keys(UI_STRINGS.hu).sort(), Object.keys(UI_STRINGS.en).sort())
  const same = Object.keys(UI_STRINGS.en).filter((k) => UI_STRINGS.hu[k] === UI_STRINGS.en[k] && /[a-z]{3}/i.test(UI_STRINGS.en[k]))
  assert.deepEqual(same, [])
})

test('every key the view uses has a text', () => {
  const html = read('./index.html')
  const keys = new Set([
    ...[...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\bui\('([^']+)'/g)].map((m) => m[1]),
  ])
  assert.ok(keys.size > 20, `${keys.size} keys`)
  for (const k of keys) assert.ok(UI_STRINGS.en[k], k)
})

test('implementation levels and component types are plain key lists; their labels live in the UI strings', () => {
  assert.deepEqual(IMPL, ['done', 'partial', 'missing'])
  assert.deepEqual(COMPONENT_TYPES, ['software', 'service', 'infra', 'shared'])
})

test('every status, implementation level and component type has a label in both languages', () => {
  const keys = [
    ...Object.keys(STATUSES).map((k) => `status.${k}`),
    ...IMPL.map((k) => `impl.${k}`),
    ...COMPONENT_TYPES.map((k) => `component.${k}`),
  ]
  for (const k of keys) for (const lang of ['en', 'hu']) assert.ok(UI_STRINGS[lang][k], `${lang} ${k}`)
  assert.equal(UI_STRINGS.en['status.decision'], 'decision')
  assert.equal(UI_STRINGS.hu['status.decision'], 'döntés')
})

test('the view is served with its strings', () => {
  assert.ok(plan.view.files.includes('ui-strings.mjs'))
  assert.match(read('./index.html'), /from '\/shell\/i18n\.mjs'/)
})

test('the documents keep their own language whatever the UI language is', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => (k === LANG_KEY ? 'en' : null), setItem() {} } })
  try {
    const map = (lang) => ({ nodeData: { id: 'r', topic: 'Shop', metadata: lang ? { lang } : {}, children: [
      { id: 'd', topic: 'Product', metadata: { doc: 'prd' }, children: [{ id: 's', topic: 'Goal', metadata: { status: 'topic' } }] },
    ] } })
    assert.equal(buildPrd(map(), 'd').subtitle, 'Termékkövetelmény-dokumentum (PRD)')
    assert.equal(buildPrd(map('hu'), 'd').subtitle, 'Termékkövetelmény-dokumentum (PRD)')
    assert.notEqual(buildPrd(map('en'), 'd').subtitle, 'Termékkövetelmény-dokumentum (PRD)')
  } finally {
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage
  }
})

test('a map without a language gets the document-language default, which is not the UI default', () => {
  assert.equal(DEFAULT_DOC_LANG, 'hu')
  assert.equal(langOf({ nodeData: {} }), DEFAULT_DOC_LANG)
})
