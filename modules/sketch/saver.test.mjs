// The page's saver (view/saver.mjs): Excalidraw reports a change on every pointer move; the sketch
// is written only when the drawing itself changed, once the hand rests.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSaver } from './view/saver.mjs'

const el = (id, version) => ({ id, version, type: 'rectangle' })

function setup() {
  const saves = []
  let fail = false
  const timers = []
  const fake = {
    setTimeout: (fn) => { timers.push(fn); return timers.length },
    clearTimeout: (n) => { timers[n - 1] = null },
  }
  const saver = createSaver({
    save: async (elements) => { saves.push(elements.map((e) => `${e.id}@${e.version}`).join(',')); if (fail) throw new Error('offline') },
    timers: fake,
  })
  const settle = async () => { const due = timers.splice(0).filter(Boolean); for (const fn of due) await fn() }
  return { saver, saves, settle, failNext: (v) => { fail = v } }
}

test('nothing is saved while only the view moves: the loaded drawing is the baseline', async () => {
  const { saver, saves, settle } = setup()
  saver.loaded([el('a', 1)], {})
  saver.change([el('a', 1)], {}, {})
  saver.change([el('a', 1)], { scrollX: 30 }, {})
  await settle()
  assert.deepEqual(saves, [])
})

test('a burst of changes to the drawing is saved once, with the last state', async () => {
  const { saver, saves, settle } = setup()
  saver.loaded([], {})
  saver.change([el('a', 1)], {}, {})
  saver.change([el('a', 2)], {}, {})
  saver.change([el('a', 3), el('b', 1)], {}, {})
  await settle()
  assert.deepEqual(saves, ['a@3,b@1'])
  saver.change([el('a', 3), el('b', 1)], {}, {})
  await settle()
  assert.equal(saves.length, 1, 'the same drawing again is not saved again')
})

test('a failed save is tried again with the next change', async () => {
  const { saver, saves, settle, failNext } = setup()
  saver.loaded([], {})
  failNext(true)
  saver.change([el('a', 1)], {}, {})
  await settle()
  failNext(false)
  saver.change([el('a', 1)], {}, {})
  await settle()
  assert.deepEqual(saves, ['a@1', 'a@1'])
})

test('the sketch read again from disk is the new baseline: the same drawing in another order is not saved back, a newer edit is', async () => {
  const { saver, saves, settle } = setup()
  saver.loaded([el('a', 1)], {})
  saver.loaded([el('a', 1), el('c', 1)], {})     // Claude drew c: the file changed, the page read it
  saver.change([el('c', 1), el('a', 1)], {}, {})
  await settle()
  assert.deepEqual(saves, [])
  saver.change([el('c', 1), el('a', 2)], {}, {})
  await settle()
  assert.deepEqual(saves, ['c@1,a@2'])
})

test('a new embedded image is a change of the drawing', async () => {
  const { saver, saves, settle } = setup()
  saver.loaded([el('a', 1)], {})
  saver.change([el('a', 1)], {}, { f1: { id: 'f1' } })
  await settle()
  assert.equal(saves.length, 1)
})
