// The modules' short messages (toasts.mjs): a .gw-toast in the page's .gw-toasts box, gone after a while.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createToasts } from './toasts.mjs'

// A stand-in for the few DOM parts a toast uses: the box, its children and their attributes.
function fakeBox() {
  const box = { children: [] }
  box.ownerDocument = {
    createElement: (tag) => {
      const el = { tag, className: '', textContent: '', attrs: {} }
      el.setAttribute = (k, v) => { el.attrs[k] = String(v) }
      el.remove = () => { box.children = box.children.filter((c) => c !== el) }
      return el
    },
  }
  box.append = (el) => box.children.push(el)
  return box
}

test('a toast shows in the box as a .gw-toast of its tone, then goes', () => {
  const box = fakeBox()
  const timers = []
  const toast = createToasts(box, { ms: 3000, timer: (fn, ms) => timers.push({ fn, ms }) })
  toast('Saved I-1')
  toast('Could not save', 'bad')
  assert.deepEqual(box.children.map((c) => [c.tag, c.className, c.attrs.role, c.textContent]), [
    ['div', 'gw-toast gw-toast--ok', 'status', 'Saved I-1'],
    ['div', 'gw-toast gw-toast--bad', 'alert', 'Could not save'],
  ], 'an error is an alert, anything else a status')
  assert.deepEqual(timers.map((t) => t.ms), [3000, 3000])
  timers[0].fn()
  assert.deepEqual(box.children.map((c) => c.textContent), ['Could not save'])
})

test('a page without a toast box loses nothing but the message', () => {
  assert.doesNotThrow(() => createToasts(null)('Hi'))
})
