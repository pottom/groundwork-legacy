// An accepted idea's summary of a change (summary.mjs, d-idea-summary): one line, in both languages.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeSummary } from './summary.mjs'
import { UI_STRINGS } from './ui-strings.mjs'

// the shell's translation, as the page has it: {name} filled in
const tr = (lang) => (key, vars = {}) => {
  const s = UI_STRINGS[lang][key]
  assert.ok(s, `${lang}: ${key}`)
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]))
}
const en = tr('en')
const change = (more) => ({ id: 'C-12', title: 'Tabs', status: 'implementing', stage: 'implementing', merged: true, items: 4, inSpec: 4, ...more })

test('a change\'s stage, its items in the Spec and its tickets done out of all, in one line', () => {
  assert.equal(changeSummary(change(), { total: 5, done: 2 }, en), '→ C-12 · Implementing, 4 items in the Spec · 2/5 tickets done')
  assert.equal(changeSummary(change({ items: 1, inSpec: 1 }), { total: 1, done: 1 }, en), '→ C-12 · Implementing, 1 item in the Spec · 1/1 tickets done')
})

test('without tickets known (no Build, no GitHub, none named yet) the line still works', () => {
  assert.equal(changeSummary(change(), undefined, en), '→ C-12 · Implementing, 4 items in the Spec')
  assert.equal(changeSummary(change(), { total: 0, done: 0 }, en), '→ C-12 · Implementing, 4 items in the Spec')
})

test('the stage is the computed one; the Spec part only once something is there, partly as a count of all', () => {
  const grilling = change({ status: 'awaiting-approval', stage: 'grilling', merged: false, items: 3, inSpec: 0 })
  assert.equal(changeSummary(grilling, undefined, en), '→ C-12 · Grilling', 'the stage, not the stored status')
  assert.equal(changeSummary(change({ merged: false, inSpec: 2 }), undefined, en), '→ C-12 · Implementing, 2 of 4 items in the Spec')
  assert.equal(changeSummary({ id: 'C-3', title: '', status: 'grilling' }, undefined, en), '→ C-3 · Grilling', 'an older answer without stage falls back to the status')
})

test('in Hungarian too', () => {
  assert.equal(changeSummary(change(), { total: 5, done: 2 }, tr('hu')), '→ C-12 · Megvalósítás, 4 elem a Specben · 2/5 jegy kész')
  assert.equal(changeSummary(change({ merged: false, inSpec: 2 }), undefined, tr('hu')), '→ C-12 · Megvalósítás, 2/4 elem a Specben')
})
