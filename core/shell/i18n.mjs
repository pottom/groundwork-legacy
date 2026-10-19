// The UI translation mechanism: one small browser module with no dependencies, served at
// /shell/i18n.mjs. The shell and every module view use it; a page that runs without the core
// server (Build's folder-picker mode) can import a copy of this file, it needs nothing else.
//
// The UI language is not the language of the generated documents (see modules/plan/doc-strings.mjs).
//
//   const i18n = createI18n({ en: { save: 'Save', saved: 'Saved at {time}' }, hu: { ... } })
//   i18n.lang                      'en' or 'hu'
//   i18n.t('saved', { time })      the text in the current language; {name} placeholders are filled;
//                                  a key missing in the language falls back to English, then to the key
//   i18n.apply(document)           fills elements marked with data-i18n="key" (text),
//                                  data-i18n-title, data-i18n-aria-label, data-i18n-placeholder (attributes);
//                                  on a document it also sets <html lang>
//   i18n.set('hu')                 switches: stores the choice and tells the other pages
//   i18n.onChange((lang) => ...)   called after the language changed, here or in another page
//
// The choice lives in localStorage under LANG_KEY, shared by every page of the origin, so a reload
// keeps it and the shell and its module frames agree. A change reaches the other pages through the
// storage event, and the frames of the page that made it also through a postMessage
// { type: 'groundwork:lang', lang } (accepted only from the page's own origin).

export const LANG_KEY = 'groundwork:ui-lang'
export const DEFAULT_LANG = 'en'
// Each language named in itself, for a language picker.
export const LANGS = { en: 'English', hu: 'Magyar' }
const MESSAGE = 'groundwork:lang'

const defaultStorage = () => { try { return globalThis.localStorage ?? null } catch { return null } }

export function createI18n(strings, { storage = defaultStorage(), win = globalThis.window ?? null } = {}) {
  const known = (l) => (typeof l === 'string' && Object.hasOwn(strings, l) ? l : null)
  const read = () => { try { return known(storage?.getItem(LANG_KEY)) } catch { return null } }
  let lang = read() ?? DEFAULT_LANG
  const listeners = new Set()

  const change = (next) => {
    next = known(next) ?? DEFAULT_LANG
    if (next === lang) return false
    lang = next
    for (const fn of listeners) fn(lang)
    return true
  }

  const t = (key, vars) => {
    const text = strings[lang]?.[key] ?? strings[DEFAULT_LANG]?.[key] ?? key
    return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text
  }

  win?.addEventListener?.('storage', (e) => { if (e.key === LANG_KEY) change(e.newValue) })
  win?.addEventListener?.('message', (e) => {
    if (e.origin === win.location?.origin && e.data?.type === MESSAGE) change(e.data.lang)
  })

  return {
    get lang() { return lang },
    t,
    set(next) {
      if (!change(next)) return
      try { storage?.setItem(LANG_KEY, lang) } catch {}
      const origin = win?.location?.origin
      for (const f of Array.from(win?.frames ?? [])) {
        try { f.postMessage({ type: MESSAGE, lang }, origin && origin !== 'null' ? origin : '*') } catch {}
      }
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    apply(root) {
      if (root.documentElement) root.documentElement.lang = lang
      for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n)
      for (const attr of ['title', 'aria-label', 'placeholder']) {
        for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)))
      }
    },
  }
}
