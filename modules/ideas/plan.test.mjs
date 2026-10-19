// A product idea to develop becomes a todo node on Plan's map, and a rejected one may become a
// non-goal: the page asks Plan (view/plan.mjs), then links the idea to the node. Without Plan,
// Ideas keeps working and says the map is unavailable.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from '../../core/server.mjs'
import { moduleFiles } from '../../core/files.mjs'
import { openMap, index } from '../plan/map-store.mjs'
import plan from '../plan/module.mjs'
import ideas from './module.mjs'
import { openIdeas } from './store.mjs'
import { saveIdea } from './view/api.mjs'
import { toMap, mapLinks, mapStep } from './view/plan.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-ideas-plan-'))

// The page's calls are relative to its server; here they go to a test server.
async function withPage(root, modules, fn) {
  const srv = await startServer({ root, modules, port: 0 })
  const real = globalThis.fetch
  globalThis.fetch = (url, init) => real(`http://127.0.0.1:${srv.port}${url}`, init)
  try { await fn() } finally { globalThis.fetch = real; await srv.close() }
}

test('a product idea moved to To develop becomes a todo node linked both ways', async () => {
  const root = project()
  openMap(root, moduleFiles(root, plan)).init('Product')
  const store = openIdeas(root, moduleFiles(root, ideas))
  store.add({ title: 'Quick tab switching', links: [] })
  const moved = store.update('I-1', { status: 'to-develop' })
  await withPage(root, [ideas, plan], async () => {
    const r = await toMap(moved, { status: 'todo' }, saveIdea)
    const node = index(openMap(root, moduleFiles(root, plan)).read().data).get(r.id).node
    assert.deepEqual({ topic: node.topic, status: node.metadata.status, link: node.hyperLink },
      { topic: 'Quick tab switching', status: 'todo', link: '/?module=ideas&idea=I-1' })
    const idea = store.list()[0]
    assert.deepEqual(idea.links, [r.id])
    assert.deepEqual(r.idea, idea)
    assert.deepEqual(mapLinks(idea), [{ id: r.id, href: `/?module=plan&node=${r.id}` }])

    const again = await toMap(idea, { status: 'todo' }, saveIdea)
    assert.equal(again.id, r.id)
    assert.deepEqual(store.list()[0].links, [r.id], 'linked once')
  })
})

test('a rejected idea can go to the map as a non-goal with its reason', async () => {
  const root = project()
  openMap(root, moduleFiles(root, plan)).init('Product')
  const store = openIdeas(root, moduleFiles(root, ideas))
  store.add({ title: 'Offline sync' })
  const rejected = store.update('I-1', { status: 'rejected', reason: 'Git already syncs' })
  await withPage(root, [ideas, plan], async () => {
    const r = await toMap(rejected, { status: 'excluded', reason: rejected.reason }, saveIdea)
    const node = index(openMap(root, moduleFiles(root, plan)).read().data).get(r.id).node
    assert.deepEqual({ status: node.metadata.status, note: node.note }, { status: 'excluded', note: 'Git already syncs' })
  })
})

test('without Plan, or without a map, Ideas says the map is unavailable and the idea is unchanged', async () => {
  for (const modules of [[ideas], [ideas, plan]]) {
    const root = project()
    const store = openIdeas(root, moduleFiles(root, ideas))
    store.add({ title: 'Quick tabs' })
    const moved = store.update('I-1', { status: 'to-develop' })
    await withPage(root, modules, async () => {
      assert.deepEqual(await toMap(moved, { status: 'todo' }, saveIdea), { unavailable: true })
      assert.deepEqual(store.list()[0], moved)
    })
  }
})

test('a change of status, wherever it is made (move, drawer, reject dialog), says what goes to the map', () => {
  const idea = (status, extra = {}) => ({ id: 'I-1', title: 'Tabs', status, kind: 'product', ...extra })
  assert.deepEqual(mapStep('new', idea('to-develop')), { status: 'todo' }, 'a product idea to develop is a todo')
  assert.deepEqual(mapStep('new', idea('to-develop', { kind: undefined })), { status: 'todo' }, 'an idea without a kind is a product idea')
  assert.equal(mapStep('new', idea('to-develop', { kind: 'engineering' })), null, 'an engineering idea becomes a ticket, not a node')
  assert.equal(mapStep('to-develop', idea('to-develop')), null, 'no change of status, nothing new on the map')
  assert.equal(mapStep('new', idea('considering')), null)
  assert.equal(mapStep('new', idea('rejected', { reason: 'No' })), null, 'a rejection goes to the map only when asked')
  assert.deepEqual(mapStep('new', idea('rejected', { reason: 'No' }), { nonGoal: true }), { status: 'excluded', reason: 'No' })
  assert.deepEqual(mapStep('rejected', idea('rejected', { reason: 'No' }), { nonGoal: true }), { status: 'excluded', reason: 'No' }, 'asked again, it is sent again')
})

test('only links that are not ideas, tickets or addresses are map nodes', () => {
  assert.deepEqual(mapLinks({ links: ['I-3', '#42', 'https://x.test/a', '/docs', 'd-goal'] }), [{ id: 'd-goal', href: '/?module=plan&node=d-goal' }])
  assert.deepEqual(mapLinks({}), [])
})
