// Plan's user interface goes through the core's translation (core/shell/i18n.mjs):
// English by default, every label also in Hungarian, and none of it touches the documents.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { UI_STRINGS } from './ui-strings.mjs'
import { STATUSES, IMPL, COMPONENT_ICONS, SHAPES, maskUrl } from './node-types.mjs'
import { COMPONENT_TYPES, KINDS, buildPrd } from './documents.mjs'
import { DEFAULT_DOC_LANG, langOf } from './doc-strings.mjs'
import { LANG_KEY } from '../../core/shell/i18n.mjs'
import plan from './module.mjs'
import { viewSource } from './view-source.test-helper.mjs'

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8')
const HUNGARIAN_LETTERS = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/

test('the view and the map labels carry no text of their own: no Hungarian left in them', () => {
  for (const f of [...plan.view.files.filter((f) => !/strings\.mjs$/.test(f) || f.startsWith('view/')), 'node-types.mjs']) {
    const line = read('./' + f).split('\n').findIndex((l) => HUNGARIAN_LETTERS.test(l))
    assert.equal(line, -1, `${f}:${line + 1}`)
  }
})

test('the English and the Hungarian set have the same keys, and the Hungarian one is translated', () => {
  assert.deepEqual(Object.keys(UI_STRINGS.hu).sort(), Object.keys(UI_STRINGS.en).sort())
  const same = Object.keys(UI_STRINGS.en).filter((k) => UI_STRINGS.hu[k] === UI_STRINGS.en[k] && /[a-z]{3}/i.test(UI_STRINGS.en[k]))
  assert.deepEqual(same, [])
})

test('every key the view uses has a text', () => {
  const html = viewSource()
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
  assert.equal(UI_STRINGS.en['status.decision'], 'Decision')
  assert.equal(UI_STRINGS.hu['status.decision'], 'Döntés')
})

test('every component type has an icon of the same family as the statuses, and a title in both languages', () => {
  assert.deepEqual(Object.keys(COMPONENT_ICONS), COMPONENT_TYPES)
  for (const svg of [...Object.values(COMPONENT_ICONS), ...Object.values(SHAPES)]) assert.match(decodeURIComponent(maskUrl(svg)), /viewBox="0 0 24 24".*stroke-width="2\.2"/)
  for (const lang of ['en', 'hu']) assert.match(UI_STRINGS[lang]['component.title'], /\{type\}/)
})

test('the legend names every status, implementation level, component type and part of a document', () => {
  for (const k of ['legend.title', 'legend.status', 'legend.impl', 'legend.components', 'legend.structure', 'legend.doc', 'legend.section'])
    for (const lang of ['en', 'hu']) assert.ok(UI_STRINGS[lang][k], `${lang} ${k}`)
})

test('every document kind has a name on the screen in both languages', () => {
  for (const k of Object.keys(KINDS)) for (const lang of ['en', 'hu']) assert.ok(UI_STRINGS[lang][`kind.${k}`], `${lang} kind.${k}`)
})

test('labels are in sentence case, never lowercase or uppercase', () => {
  for (const lang of ['en', 'hu']) for (const [k, v] of Object.entries(UI_STRINGS[lang])) {
    if (!/^(status|impl|component|progress|kind|mode|view|map|menu|empty|toast)\./.test(k)) continue
    assert.match(v, /^[^a-záéíóöőúüű]/, `${lang} ${k}: ${v}`)
    assert.notEqual(v, v.toUpperCase(), `${lang} ${k}: ${v}`)
  }
})

test('the view is served with its strings', () => {
  assert.ok(plan.view.files.includes('ui-strings.mjs'))
  assert.match(viewSource(), /from '\/shell\/i18n\.mjs'/)
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
