// Tests of the UI translation mechanism (i18n.mjs), as a module page uses it.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createI18n, LANG_KEY } from './i18n.mjs'

const STRINGS = {
  en: { hello: 'Hello', greet: 'Hello, {name}!', onlyEn: 'Only in English' },
  hu: { hello: 'Szia', greet: 'Szia, {name}!' },
}

// A localStorage stand-in.
function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m }
}

// A window stand-in: an event target with frames and an origin.
function fakeWindow(frames = []) {
  const w = new EventTarget()
  w.location = { origin: 'http://localhost:4477' }
  w.frames = frames
  return w
}

test('English is the default', () => {
  const i18n = createI18n(STRINGS, { storage: memoryStorage(), win: fakeWindow() })
  assert.equal(i18n.lang, 'en')
  assert.equal(i18n.t('hello'), 'Hello')
})

test('the stored choice is used, and placeholders are filled', () => {
  const i18n = createI18n(STRINGS, { storage: memoryStorage({ [LANG_KEY]: 'hu' }), win: fakeWindow() })
  assert.equal(i18n.lang, 'hu')
  assert.equal(i18n.t('greet', { name: 'Anna' }), 'Szia, Anna!')
})

test('a missing translation falls back to English, then to the key', () => {
  const i18n = createI18n(STRINGS, { storage: memoryStorage({ [LANG_KEY]: 'hu' }), win: fakeWindow() })
  assert.equal(i18n.t('onlyEn'), 'Only in English')
  assert.equal(i18n.t('nowhere'), 'nowhere')
})

test('an unknown stored language means English', () => {
  const i18n = createI18n(STRINGS, { storage: memoryStorage({ [LANG_KEY]: 'xx' }), win: fakeWindow() })
  assert.equal(i18n.lang, 'en')
})

test('works without storage (blocked or missing)', () => {
  const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  const i18n = createI18n(STRINGS, { storage: throwing, win: fakeWindow() })
  assert.equal(i18n.lang, 'en')
  i18n.set('hu')
  assert.equal(i18n.lang, 'hu')
  assert.equal(createI18n(STRINGS, { storage: null, win: null }).t('hello'), 'Hello')
})

test('setting the language stores it, so a reload keeps it', () => {
  const storage = memoryStorage()
  createI18n(STRINGS, { storage, win: fakeWindow() }).set('hu')
  assert.equal(storage.getItem(LANG_KEY), 'hu')
  assert.equal(createI18n(STRINGS, { storage, win: fakeWindow() }).lang, 'hu')
})

test('a change tells the listeners, once per real change', () => {
  const i18n = createI18n(STRINGS, { storage: memoryStorage(), win: fakeWindow() })
  const seen = []
  i18n.onChange((lang) => seen.push(lang))
  i18n.set('hu')
  i18n.set('hu')
  i18n.set('en')
  assert.deepEqual(seen, ['hu', 'en'])
})

test('a change made in another page of the same origin arrives through the storage event', () => {
  const storage = memoryStorage()
  const win = fakeWindow()
  const i18n = createI18n(STRINGS, { storage, win })
  const seen = []
  i18n.onChange((lang) => seen.push(lang))
  storage.setItem(LANG_KEY, 'hu')
  const e = new Event('storage')
  Object.assign(e, { key: LANG_KEY, newValue: 'hu' })
  win.dispatchEvent(e)
  assert.equal(i18n.lang, 'hu')
  assert.deepEqual(seen, ['hu'])
})

test('the shell tells its module frames by message, and a frame takes it only from its own origin', () => {
  const posted = []
  const frame = { postMessage: (data, origin) => posted.push({ data, origin }) }
  const shell = createI18n(STRINGS, { storage: memoryStorage(), win: fakeWindow([frame]) })
  shell.set('hu')
  assert.deepEqual(posted, [{ data: { type: 'groundwork:lang', lang: 'hu' }, origin: 'http://localhost:4477' }])

  const win = fakeWindow()
  const view = createI18n(STRINGS, { storage: memoryStorage(), win })
  const message = (origin) => Object.assign(new Event('message'), { origin, data: posted[0].data })
  win.dispatchEvent(message('http://evil.example'))
  assert.equal(view.lang, 'en')
  win.dispatchEvent(message('http://localhost:4477'))
  assert.equal(view.lang, 'hu')
})

test('the language switch reaches every module frame, the hidden ones too', () => {
  const posted = []
  const frame = (name) => ({ postMessage: (data) => posted.push([name, data.lang]) })
  createI18n(STRINGS, { storage: memoryStorage(), win: fakeWindow([frame('plan'), frame('build')]) }).set('hu')
  assert.deepEqual(posted, [['plan', 'hu'], ['build', 'hu']])
})

test('Hungarian "a(z)" before a filled name becomes "a" or "az" by how the name sounds', () => {
  const i18n = createI18n({ en: { x: 'x' }, hu: { ahead: '{n} commit nincs a(z) {base} ágon', start: 'A(z) {base} lezárva', bare: 'a(z) ág' } },
    { storage: memoryStorage({ [LANG_KEY]: 'hu' }), win: null })
  assert.equal(i18n.t('ahead', { n: 30, base: 'main' }), '30 commit nincs a main ágon')
  assert.equal(i18n.t('ahead', { n: 2, base: 'origin/main' }), '2 commit nincs az origin/main ágon')
  assert.equal(i18n.t('ahead', { n: 2, base: 'Ügyfél' }), '2 commit nincs az Ügyfél ágon')
  assert.equal(i18n.t('ahead', { n: 2, base: '5-release' }), '2 commit nincs az 5-release ágon', 'öt: a vowel sound')
  assert.equal(i18n.t('ahead', { n: 2, base: '2-release' }), '2 commit nincs a 2-release ágon', 'kettő')
  assert.equal(i18n.t('ahead', { n: 2, base: '_tmp' }), '2 commit nincs a(z) _tmp ágon', 'unsure: the generic form stays')
  assert.equal(i18n.t('start', { base: 'epic' }), 'Az epic lezárva')
  assert.equal(i18n.t('bare'), 'a(z) ág', 'no name after it: left alone')
})
