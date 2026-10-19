// The module frames of the shell (frames.mjs): one frame per visited module, kept alive and
// only hidden when another module is shown.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moduleFrames } from './frames.mjs'

// A stand-in for the few DOM parts the frames use: <main>, its iframes and the document's focus.
function fakeDom() {
  const doc = { activeElement: null }
  const iframe = (src = null) => {
    const f = {
      tagName: 'IFRAME', className: '', title: '', hidden: false, inert: false, dataset: {}, attrs: { src },
      getAttribute: (k) => f.attrs[k] ?? null,
      setAttribute: (k, v) => { f.attrs[k] = String(v) },
      blur: () => { if (doc.activeElement === f) doc.activeElement = null },
      loads: [],
    }
    Object.defineProperty(f, 'src', { get: () => f.attrs.src, set: (v) => { f.attrs.src = v; f.loads.push(v) } })
    f.contentWindow = { location: { replace: (u) => f.loads.push(u) } }
    return f
  }
  doc.createElement = (tag) => { assert.equal(tag, 'iframe'); return iframe() }
  const main = {
    ownerDocument: doc,
    children: [],
    appendChild: (el) => { main.children.push(el); return el },
    querySelectorAll: (sel) => { assert.equal(sel, 'iframe.gw-view'); return main.children.filter((c) => c.className === 'gw-view') },
  }
  // the frame the server rendered: Plan, opened on a deep link
  const first = Object.assign(iframe('/plan/?node=d-trace'), { className: 'gw-view', title: 'Plan' })
  first.dataset.module = 'plan'
  main.children.push(first)
  return { doc, main, first }
}

const visible = (main) => main.children.filter((f) => !f.hidden).map((f) => f.dataset.module)

test('a module visited for the first time gets a frame of its own; the other is hidden, not removed', () => {
  const { main, first } = fakeDom()
  const frames = moduleFrames(main)
  frames.show('build', { title: 'Build', query: '' })
  assert.equal(main.children.length, 2)
  const build = main.children[1]
  assert.equal(build.className, 'gw-view')
  assert.equal(build.title, 'Build')
  assert.equal(build.src, '/build/')
  assert.deepEqual(visible(main), ['build'])
  assert.equal(first.hidden, true)
  assert.equal(first.inert, true, 'a hidden frame takes no focus and no keys')
  assert.deepEqual(first.loads, [], 'Plan is not reloaded')
})

test('a second visit shows the kept frame again without loading it', () => {
  const { main, first } = fakeDom()
  const frames = moduleFrames(main)
  frames.show('build', { title: 'Build', query: '' })
  frames.show('plan', { title: 'Plan', query: '' })
  frames.show('build', { title: 'Build', query: '' })
  frames.show('plan', { title: 'Plan', query: '?node=d-trace' })
  assert.equal(main.children.length, 2)
  assert.deepEqual(first.loads, [])
  assert.deepEqual(main.children[1].loads, ['/build/'])
  assert.deepEqual(visible(main), ['plan'])
  assert.equal(first.inert, false)
  assert.equal(main.children[1].inert, true)
})

test('a deep link with a new query opens it in the kept frame, in place of the page there', () => {
  const { main, first } = fakeDom()
  const frames = moduleFrames(main)
  frames.show('plan', { title: 'Plan', query: '?node=d-npm' })
  assert.deepEqual(first.loads, ['/plan/?node=d-npm'])
  frames.show('build', { title: 'Build', query: '' })
  frames.show('plan', { title: 'Plan', query: '' })
  assert.deepEqual(first.loads, ['/plan/?node=d-npm'], 'no query: the frame stays as it is')
})

test('the hidden frame loses the focus, so its keyboard shortcuts stop', () => {
  const { doc, main, first } = fakeDom()
  doc.activeElement = first
  moduleFrames(main).show('build', { title: 'Build', query: '' })
  assert.notEqual(doc.activeElement, first)
})

test('the module ids are escaped in the frame\'s address', () => {
  const { main } = fakeDom()
  moduleFrames(main).show('a b', { title: 'A', query: '' })
  assert.equal(main.children[1].src, '/a%20b/')
})
