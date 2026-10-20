// An idea's links that are map nodes open Plan there (view/links.mjs). Ideas no longer sends ideas to
// Plan's map: accepting an idea is a change of status only, and the page never calls /api/plan/todo.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ideas from './module.mjs'
import { mapLinks, planLink } from './view/links.mjs'

const viewSource = () => ideas.view.files.map((f) => fs.readFileSync(path.join(ideas.view.dir, f), 'utf8')).join('\n')

test('only links that are not ideas, tickets or addresses are map nodes', () => {
  assert.deepEqual(mapLinks({ links: ['I-3', '#42', 'https://x.test/a', '/docs', 'd-goal'] }), [{ id: 'd-goal', href: '/?module=plan&node=d-goal' }])
  assert.deepEqual(mapLinks({}), [])
  assert.equal(planLink('a b'), '/?module=plan&node=a%20b')
})

test('the page no longer sends ideas to Plan\'s map', () => {
  const src = viewSource()
  assert.doesNotMatch(src, /\/api\/plan\/todo/)
  assert.doesNotMatch(src, /toMap|mapStep|sendToMap/)
})
