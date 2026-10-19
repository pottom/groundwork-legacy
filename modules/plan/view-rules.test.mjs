// The rules of Plan's screen that do not need a browser: which view a window can show, how far
// the map may zoom out to fit, the panel's summary badges, and one render per frame.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SPLIT_MIN_WIDTH, resolveView, fitScale, summaryBadges, coalesce } from './view-rules.mjs'
import { UI_STRINGS } from './ui-strings.mjs'
import { createI18n } from '../../core/shell/i18n.mjs'

test('a wide window shows what was chosen; with nothing chosen it shows both from 1100 px', () => {
  assert.equal(resolveView('prd', 1400), 'prd')
  assert.equal(resolveView('split', 1400), 'split')
  assert.equal(resolveView(null, 1200), 'split')
  assert.equal(resolveView(null, 1000), 'map')
  assert.equal(resolveView('nonsense', 1400), 'split')
})

test('a narrow window cannot split: a saved "both" becomes the map, the other views stay', () => {
  assert.equal(SPLIT_MIN_WIDTH, 900)
  assert.equal(resolveView('split', 420), 'map')
  assert.equal(resolveView('split', 899), 'map')
  assert.equal(resolveView('split', 900), 'split')
  assert.equal(resolveView('prd', 420), 'prd')
  assert.equal(resolveView('map', 420), 'map')
})

test('a map that fits is shown at full size, never enlarged', () => {
  assert.deepEqual(fitScale({ width: 400, height: 300 }, { width: 1000, height: 800 }), { scale: 1, clamped: false })
})

test('a bigger map is scaled down to fit, but not below the readable minimum', () => {
  assert.deepEqual(fitScale({ width: 2000, height: 800 }, { width: 1000, height: 800 }, { min: 0.4 }), { scale: 0.5, clamped: false })
  assert.deepEqual(fitScale({ width: 2000, height: 800 }, { width: 1000, height: 800 }, { min: 0.6 }), { scale: 0.6, clamped: true })
  assert.deepEqual(fitScale({ width: 8000, height: 6000 }, { width: 1000, height: 800 }), { scale: 0.55, clamped: true })
})

const t = (lang) => createI18n(UI_STRINGS, { storage: { getItem: () => lang, setItem() {} }, win: null }).t

test('the panel summary is UI text in the UI language, with a tone for each badge', () => {
  const count = { done: 2, active: 1, untouched: 2, inferred: 3, impl: { done: 6, partial: 0, missing: 1 } }
  assert.deepEqual(summaryBadges(count, t('en')), [
    { tone: 'ok', text: '2 of 5 sections done' },
    { tone: 'info', text: '3 from code' },
    { tone: 'ok', text: '6 built' },
    { tone: 'bad', text: '1 missing' },
  ])
  assert.deepEqual(summaryBadges(count, t('hu')).map((b) => b.text), ['5 fejezetből 2 kész', '3 kódból', '6 megvalósítva', '1 hiányzik'])
})

test('a summary leaves out what is zero, but always says how many sections are done', () => {
  const count = { done: 0, active: 0, untouched: 4, inferred: 0, impl: { done: 0, partial: 2, missing: 0 } }
  assert.deepEqual(summaryBadges(count, t('en')), [
    { tone: 'neutral', text: '0 of 4 sections done' },
    { tone: 'warn', text: '2 partly built' },
  ])
})

test('a document without sections has no summary', () => {
  assert.deepEqual(summaryBadges({ done: 0, active: 0, untouched: 0, inferred: 0, impl: { done: 0, partial: 0, missing: 0 } }, t('en')), [])
})

test('many calls in one frame run the work once, in the next frame', () => {
  const frames = []
  let runs = 0
  const soon = coalesce(() => runs++, (fn) => frames.push(fn))
  soon(); soon(); soon()
  assert.equal(runs, 0)
  assert.equal(frames.length, 1)
  frames.shift()()
  assert.equal(runs, 1)
  soon()
  assert.equal(frames.length, 1, 'a call after the frame asks for a new one')
})

test('the view is served with these rules and hears live updates through the shell, with no stream or live label of its own', async () => {
  const { default: plan } = await import('./module.mjs')
  const { viewSource } = await import('./view-source.test-helper.mjs')
  const html = viewSource()
  assert.ok(plan.view.files.includes('view-rules.mjs'))
  assert.match(html, /import \{ subscribe \} from '\/shell\/live\.mjs'/)
  assert.doesNotMatch(html, /new EventSource/)
  assert.doesNotMatch(html, /id="sync"/)
  assert.ok(!('panel.live' in UI_STRINGS.en) && !('sync.live' in UI_STRINGS.en))
})
