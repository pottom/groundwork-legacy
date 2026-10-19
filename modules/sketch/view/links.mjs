// The sketch's links: a button at the right of the bar opens a .gw-popover that lists what the sketch
// links to (an idea, a map node, a ticket, another sketch; each opens in the shell), removes one, and
// adds one by its kind and reference. Plain DOM like the bar (sketches.mjs).
//
//   const panel = mountLinks(element, { name, i18n, onAdd(target), onRemove(target) })
//       onAdd and onRemove return a promise that rejects when the server refuses
//   panel.show({ sketches, renamed })   what GET /api/sketch/links gave; draws this sketch's links
//   panel.redraw()                      in the language now chosen
//
// A link is written groundwork://<kind>/<ref> (targets.mjs), the same form a shape's own link takes.
// The page's API: GET /api/sketch/links, POST /api/sketch/link and POST /api/sketch/unlink { name, target }.

import { KINDS, target, parseTarget, shellLink } from './targets.mjs'

const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props)
  e.append(...children)
  return e
}

export async function readLinks() {
  const res = await fetch('/api/sketch/links', { cache: 'no-store' })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

export async function changeLink(sub, name, link) {
  const res = await fetch(`/api/sketch/${sub === 'add' ? 'link' : 'unlink'}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, target: link }),
  })
  if (!res.ok) throw Object.assign(new Error(`${sub}: ${res.status}`), { status: res.status })
}

export function mountLinks(root, { name, i18n, onAdd, onRemove }) {
  let links = []
  let renamed = {}
  let open = false
  let kind = 'idea'
  let draft = ''
  let error = null

  const t = i18n.t
  const KIND_KEYS = { idea: 'links.kind.idea', node: 'links.kind.node', ticket: 'links.kind.ticket', sketch: 'links.kind.sketch' }
  const label = (link) => {
    const p = parseTarget(link)
    return p ? `${t(KIND_KEYS[p.kind])} ${p.ref}` : link
  }

  function close() {
    open = false
    draw()
    button().focus()
  }
  const button = () => root.querySelector('.sk-links__toggle')

  function list() {
    if (!links.length) return el('p', { className: 'sk-links__none', textContent: t('links.none') })
    return el('ul', { className: 'gw-popover__list' }, ...links.map((link) => {
      const a = el('a', { className: 'gw-popover__item', href: shellLink(link, renamed) ?? '#', target: '_top', textContent: label(link) })
      const remove = el('button', { type: 'button', className: 'gw-btn gw-btn--icon gw-btn--ghost gw-btn--sm', textContent: '×', title: t('links.remove'), onclick: async () => {
        try { await onRemove(link) } catch { error = 'links.failed'; draw() }
      } })
      remove.setAttribute('aria-label', `${t('links.remove')}: ${label(link)}`)
      return el('li', { className: 'sk-links__row' }, a, remove)
    }))
  }

  function form() {
    const select = el('select', { className: 'gw-field', onchange: () => { kind = select.value } })
    select.setAttribute('aria-label', t('links.kind'))
    for (const k of KINDS) select.append(el('option', { value: k, textContent: t(KIND_KEYS[k]), selected: k === kind }))
    const input = el('input', { className: 'gw-field sk-links__ref', value: draft, placeholder: t('links.ref'), oninput: () => { draft = input.value } })
    input.setAttribute('aria-label', t('links.ref'))
    const add = el('button', { type: 'submit', className: 'gw-btn gw-btn--primary gw-btn--sm', textContent: t('links.add') })
    const f = el('form', { className: 'sk-links__form' }, select, input, add)
    f.onsubmit = async (e) => {
      e.preventDefault()
      const link = target(kind, draft)
      if (!link) { error = 'links.bad'; return draw() }
      try {
        await onAdd(link)
        draft = ''
        error = null
      } catch {
        error = 'links.failed'
      }
      draw()
    }
    return f
  }

  function draw() {
    const toggle = el('button', { type: 'button', className: 'gw-btn gw-btn--ghost gw-btn--sm sk-links__toggle', textContent: `${t('links.button')} (${links.length})` })
    toggle.setAttribute('aria-expanded', String(open))
    toggle.setAttribute('aria-controls', 'sk-links-panel')
    toggle.onclick = () => { open = !open; error = null; draw() }
    const panel = el('div', { className: 'gw-popover sk-links__panel', id: 'sk-links-panel', hidden: !open },
      el('h3', { className: 'gw-popover__title', textContent: t('links.title') }),
      list(),
      form(),
      ...(error ? [el('p', { className: 'sk-links__error', role: 'alert', textContent: t(error) })] : []),
      el('p', { className: 'sk-links__hint', textContent: t('links.shapes') }))
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', t('links.title'))
    panel.onkeydown = (e) => { if (e.key === 'Escape') close() }
    root.replaceChildren(toggle, panel)
  }

  // a click outside closes it (a click inside may have redrawn the panel: its target is gone then)
  document.addEventListener('click', (e) => { if (open && e.target.isConnected && !root.contains(e.target)) { open = false; draw() } })
  draw()
  return {
    show(index) {
      links = index?.sketches?.[name] ?? []
      renamed = index?.renamed ?? {}
      draw()
    },
    redraw: draw,
  }
}
