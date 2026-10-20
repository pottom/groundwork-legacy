// Where a record chip leads (record-link.mjs): the module that declares the record's type, with the
// type's name as the deep link's parameter.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recordHref, chipTitle } from './record-link.mjs'

test('a record opens in the module that declares its type: /?module=<module>&<name>=<id>', () => {
  assert.equal(recordHref({ id: 'I-5', name: 'idea', module: 'ideas' }), '/?module=ideas&idea=I-5')
  assert.equal(recordHref({ id: 'C-3', name: 'change', module: 'changes' }), '/?module=changes&change=C-3')
})

test('a record of the core\'s own types, or of no declared type, has nowhere to open: a plain chip', () => {
  assert.equal(recordHref({ id: 'M-9', name: 'milestone', module: 'core' }), null)
  assert.equal(recordHref({ id: 'I-5' }), null)
  assert.equal(recordHref({ id: 'I-5', name: 'idea' }), null)
})

test('the chip\'s hover text is the id and the title, or the id alone', () => {
  assert.equal(chipTitle({ id: 'I-5', title: 'Redesign' }), 'I-5 · Redesign')
  assert.equal(chipTitle({ id: 'I-5' }), 'I-5')
})
