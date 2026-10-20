// The Ideas page's user interface goes through the core's translation (core/shell/i18n.mjs):
// English by default, every label also in Hungarian.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ideas from './module.mjs'
import { UI_STRINGS } from './ui-strings.mjs'
import { STATUSES, AUTHORS, KINDS } from './fields.mjs'

const read = (f) => fs.readFileSync(path.join(ideas.view.dir, f), 'utf8')
const HUNGARIAN_LETTERS = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/
const { en, hu } = UI_STRINGS

test('the view carries no text of its own: no Hungarian outside the strings', () => {
  for (const f of ideas.view.files.filter((f) => f !== 'ui-strings.mjs')) {
    const line = read(f).split('\n').findIndex((l) => HUNGARIAN_LETTERS.test(l))
    assert.equal(line, -1, `${f}:${line + 1}`)
  }
})

test('the English and the Hungarian set have the same keys, and the Hungarian one is translated', () => {
  assert.deepEqual(Object.keys(hu).sort(), Object.keys(en).sort())
  // a name, the stage's word (Grilling in Hungarian too, as on the Changes page) and a pattern stay
  const SAME = ['author.claude', 'card.change', 'change.grilling', 'route.grilling']
  const same = Object.keys(en).filter((k) => hu[k] === en[k] && !SAME.includes(k))
  assert.deepEqual(same, [])
  assert.ok(ideas.tagline.en && ideas.tagline.hu && ideas.tagline.en !== ideas.tagline.hu)
})

test('every key the view uses has a text, and every column, author and kind has a label', () => {
  const src = ideas.view.files.map(read).join('\n')
  const keys = [...src.matchAll(/\bui\('([^']+)'/g)].map((m) => m[1])
  assert.ok(keys.length > 5)
  for (const k of keys) assert.ok(en[k], k)
  for (const k of [...STATUSES.map((s) => `status.${s}`), ...AUTHORS.map((a) => `author.${a}`), ...KINDS.map((k) => `kind.${k}`)]) assert.ok(en[k] && hu[k], k)
  assert.deepEqual(STATUSES.map((s) => en[`status.${s}`]), ['New', 'Considering', 'Accepted', 'Rejected', 'Snoozed', 'Duplicate'])
})

test('labels are in sentence case, never lowercase or uppercase', () => {
  for (const set of [en, hu]) for (const [k, v] of Object.entries(set)) {
    assert.match(v, /^[^a-záéíóöőúüű]/, `${k}: ${v}`)
    assert.notEqual(v, v.toUpperCase(), `${k}: ${v}`)
  }
})
