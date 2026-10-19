// What needs attention, on the module tabs (attention.mjs): a count per tab, and a toast once
// for each new thing, read from the endpoint a module's manifest names.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { watchAttention } from './attention.mjs'

const item = (key, reason = 'waiting') => ({ key, reason, text: { en: `${key} en`, hu: `${key} hu` } })

// A module's endpoint whose answer the test sets, the tab counts and toasts seen, and the timers.
function setup({ lang = 'en' } = {}) {
  const answers = { '/api/agents/attention': { items: [], recheck: null } }
  const shown = {}, toasts = [], timers = [], asked = []
  const w = watchAttention({
    sources: [{ id: 'agents', url: '/api/agents/attention', show: (count) => { shown.agents = count } }],
    toast: (text, tone) => toasts.push([text, tone]),
    lang: () => lang,
    fetch: async (url) => {
      asked.push(url)
      const a = answers[url]
      return a === 404 ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => a }
    },
    timer: (fn, ms) => { const t = { fn, ms, on: true }; timers.push(t); return t },
    clearTimer: (t) => { if (t) t.on = false },
    now: () => Date.parse('2026-10-19T12:00:00.000Z'),
  })
  return { w, answers, shown, toasts, timers, asked }
}

test('the tab shows the count; what was already there when the page opened is not toasted', async () => {
  const { w, answers, shown, toasts } = setup()
  answers['/api/agents/attention'].items = [item('a'), item('b')]
  await w.refresh()
  assert.equal(shown.agents, 2)
  assert.deepEqual(toasts, [])
})

test('a new one is toasted once, in the UI language; a failure in the bad tone', async () => {
  const { w, answers, shown, toasts } = setup({ lang: 'hu' })
  await w.refresh()
  assert.equal(shown.agents, 0)
  answers['/api/agents/attention'].items = [item('a'), item('f', 'failed')]
  await w.refresh(['agents.events'])
  await w.refresh(['agents.events'])
  assert.deepEqual(toasts, [['a hu', 'info'], ['f hu', 'bad']])
  assert.equal(shown.agents, 2)
})

test('it asks again on hello and on its own module\'s topics only', async () => {
  const { w, asked } = setup()
  await w.refresh()
  await w.refresh(['plan.map'])
  await w.refresh(['agents.git', 'plan.map'])
  assert.equal(asked.length, 2)
})

test('without the module (no ok answer) the tab shows nothing and nothing is toasted', async () => {
  const { w, answers, shown, toasts } = setup()
  answers['/api/agents/attention'] = 404
  await w.refresh()
  assert.equal(shown.agents, 0)
  assert.deepEqual(toasts, [])
})

test('when the answer changes by time alone (recheck), it asks again then, without polling', async () => {
  const { w, answers, timers, asked } = setup()
  answers['/api/agents/attention'].recheck = '2026-10-19T12:04:00.000Z'
  await w.refresh()
  const live = timers.filter((t) => t.on)
  assert.equal(live.length, 1)
  assert.ok(live[0].ms >= 4 * 60_000 && live[0].ms <= 4 * 60_000 + 2000, String(live[0].ms))
  answers['/api/agents/attention'].recheck = null
  await w.refresh()
  assert.equal(timers.filter((t) => t.on).length, 0, 'the old timer is dropped')
  await live[0].fn()
  assert.equal(asked.length, 3)
})
