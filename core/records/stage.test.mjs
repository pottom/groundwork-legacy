// The stage of a change, computed by the core (stage.mjs); the Changes module's own tests cover the
// question rules through its re-export (modules/changes/stages.test.mjs).
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeStage } from './stage.mjs'

test('a change\'s stage from its file: open questions (the map\'s ? nodes, an old list) → Grilling, none → Awaiting approval, later ones from the status', () => {
  const rec = (status, body) => ({ fields: { status }, body })
  assert.deepEqual(changeStage(rec('awaiting-approval', '## Gondolatok\n\n- ? Kell-e git?\n')), { stage: 'grilling', questions: 1 })
  assert.deepEqual(changeStage(rec('grilling', '## Kérdések\n\n- [x] Answered\n')), { stage: 'awaiting-approval', questions: 0 })
  assert.deepEqual(changeStage(rec('grilling', '')), { stage: 'awaiting-approval', questions: 0 })
  assert.equal(changeStage(rec('implementing', '## Gondolatok\n\n- ? Open\n')).stage, 'implementing')
  assert.equal(changeStage(rec('dropped', '')).stage, 'dropped')
})
