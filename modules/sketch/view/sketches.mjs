// The sketches: which one the page opens, and the bar above the board that lists them, opens
// another, makes a new one and renames the open one. Plain DOM, no dependencies, so the choice can
// be tested in Node and the store (sketch-store.mjs) shares the rule for a name.
//
//   isSketchName(name)                           a plain name: letters, digits, "-" and "_"
//   chooseSketch({ asked, remembered, names, renamed })   the deep link's sketch, else the one
//                                                opened last (if it is still there), else the first,
//                                                else main; an old name (renamed: old → new, from
//                                                GET /api/sketch/links) leads to the sketch now
//   mountSketchBar(nav, { current, names, i18n, onOpen, onCreate, onRename })
//       onOpen(name); onCreate(name) and onRename(to) return a promise that rejects with
//       { status } when the server refuses (409 taken, 400 not a plain name)
//
// The page's API: GET /api/sketch/list, POST /api/sketch/create { name },
// POST /api/sketch/rename { from, to } (see README.md), through api.mjs.

import { postJson } from './api.mjs'

const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/
export const isSketchName = (name) => typeof name === 'string' && NAME.test(name)
export const DEFAULT_SKETCH = 'main'

export function chooseSketch({ asked, remembered, names, renamed = {} }) {
  // a name the sketch had before a rename leads to it, unless a new sketch has taken that name
  const now = (name) => (!names.includes(name) && Object.hasOwn(renamed, name) ? renamed[name] : name)
  if (isSketchName(asked)) return now(asked)
  if (names.includes(now(remembered))) return now(remembered)
  return names[0] ?? DEFAULT_SKETCH
}

// A POST to the sketch API; a refusal rejects with the status, so the bar can say why.
export const postSketch = (sub, body) => postJson(`/api/sketch/${sub}`, body)

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...children)
  return e
}

export function mountSketchBar(nav, { current, names, i18n, onOpen, onCreate, onRename }) {
  const all = names.includes(current) ? names : [...names, current].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  let editing = null   // null, 'create' or 'rename'
  let error = null     // the key of the message beside the name field
  let draft = ''       // the name typed, kept when the form is drawn again with an error

  const errorKey = (e) => (e?.status === 409 ? 'bar.taken' : e?.status === 400 ? 'bar.badName' : 'bar.failed')

  function picker() {
    const select = el('select', { className: 'gw-field sk-bar__select', title: i18n.t('bar.open') })
    select.setAttribute('aria-label', i18n.t('bar.open'))
    for (const name of all) select.append(el('option', { value: name, textContent: name, selected: name === current }))
    select.onchange = () => onOpen(select.value)
    const create = el('button', { type: 'button', className: 'gw-btn gw-btn--secondary gw-btn--sm', textContent: i18n.t('bar.new') })
    create.onclick = () => { editing = 'create'; error = null; draft = ''; draw() }
    const rename = el('button', { type: 'button', className: 'gw-btn gw-btn--ghost gw-btn--sm', textContent: i18n.t('bar.rename') })
    rename.onclick = () => { editing = 'rename'; error = null; draft = current; draw() }
    return [select, create, rename]
  }

  function form() {
    const input = el('input', { className: 'gw-field sk-bar__name', value: draft, required: true, maxLength: 64, pattern: NAME.source.slice(1, -1), title: i18n.t('bar.hint'), placeholder: i18n.t('bar.name') })
    input.setAttribute('aria-label', i18n.t('bar.name'))
    const submit = el('button', { type: 'submit', className: 'gw-btn gw-btn--primary gw-btn--sm', textContent: i18n.t(editing === 'create' ? 'bar.create' : 'bar.rename') })
    const cancel = el('button', { type: 'button', className: 'gw-btn gw-btn--ghost gw-btn--sm', textContent: i18n.t('bar.cancel') })
    const close = () => { editing = null; error = null; draw() }
    cancel.onclick = close
    input.onkeydown = (e) => { if (e.key === 'Escape') close() }
    const f = el('form', { className: 'sk-bar__form', noValidate: true }, input, submit, cancel)
    if (error) f.append(el('span', { className: 'sk-bar__error', role: 'alert', textContent: i18n.t(error) }))
    f.onsubmit = async (e) => {
      e.preventDefault()
      const name = draft = input.value.trim()
      if (!isSketchName(name)) { error = 'bar.badName'; return draw() }
      if (editing === 'rename' && name === current) return close()
      submit.disabled = true
      try {
        await (editing === 'create' ? onCreate(name) : onRename(name))
      } catch (err) {
        error = errorKey(err)
        draw()
      }
    }
    queueMicrotask(() => { input.focus(); input.select() })
    return [f]
  }

  function draw() {
    nav.replaceChildren(...(editing ? form() : picker()))
  }
  draw()
  return { redraw: draw }
}
