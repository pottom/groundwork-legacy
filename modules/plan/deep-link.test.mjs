// Plan's deep link: /?module=plan&node=<id> (the shell hands ?node= to Plan's frame), or
// /plan/?node=<id> straight; the node is focused and highlighted, an unknown id is said so.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linkTarget, planLink, buildLink } from './deep-link.mjs'
import plan from './module.mjs'

const map = {
  nodeData: {
    id: 'root', topic: 'Demo', children: [
      { id: 'doc-build', topic: 'Build', metadata: { doc: 'prd' }, children: [{ id: 't-trace', topic: 'Trace', children: [{ id: 'd-trace', topic: 'Link tickets' }] }] },
      { id: 'doc-plan', topic: 'Plan', metadata: { doc: 'prd' }, children: [{ id: 't-map', topic: 'Map', children: [] }] },
    ],
  },
}

test('no node in the address: nothing to focus', () => {
  assert.equal(linkTarget('', map), null)
  assert.equal(linkTarget('?view=map', map), null)
  assert.equal(linkTarget('?node=', map), null)
})

test('a known id: the node, the path down to it, and the document it is in', () => {
  const t = linkTarget('?node=d-trace', map)
  assert.equal(t.id, 'd-trace')
  assert.equal(t.found, true)
  assert.deepEqual(t.path, ['root', 'doc-build', 't-trace'])
  assert.equal(t.doc, 'doc-build')
})

test('an unknown id is reported as one, with the id as typed', () => {
  assert.deepEqual(linkTarget('?node=f-nope%20x', map), { id: 'f-nope x', found: false, path: [], doc: null })
})

test('the link Build and others use: through the shell, the id encoded', () => {
  assert.equal(planLink('d-trace'), '/?module=plan&node=d-trace')
  assert.equal(planLink('a b&c'), '/?module=plan&node=a%20b%26c')
  assert.equal(linkTarget(new URL(planLink('a b&c'), 'http://x').search, map).id, 'a b&c')
})

test('the deep link code is served with the view', () => {
  assert.ok(plan.view.files.includes('deep-link.mjs'))
})

test('an item\'s tickets open in Build through the shell, filtered to that item', () => {
  assert.equal(buildLink('d-trace'), '/?module=build&prd=d-trace')
  assert.equal(buildLink('a b&c'), '/?module=build&prd=a%20b%26c')
})

// Build is a classic script page (it opens from file:// too) and cannot import this module: its
// shared ticket reader makes the same link and reads the same address. Both sides must agree.
test('Build makes Plan\'s deep link and reads Plan\'s Build link the same way', async () => {
  await import('../build/ticket-reader.js')
  const { planLink: buildsPlanLink, prdFilter } = globalThis.GroundworkTickets
  for (const id of ['d-trace', 'a b&c', 'é/ü?x=1#y']) {
    assert.equal(buildsPlanLink(id), planLink(id))
    assert.equal(linkTarget(new URL(buildsPlanLink(id), 'http://x').search, map).id, id)
    assert.equal(prdFilter(new URL(buildLink(id), 'http://x').search), id)
  }
  assert.equal(prdFilter(''), '')
  assert.equal(prdFilter('?module=build'), '')
})
