// The threads on the board (f-board-threads): a pin on every shape with a thread, a "Comments"
// button above the board, and the panel that shows one thread (its comments, a field to answer,
// resolve or reopen) or the list of them all, the orphaned ones (shape deleted) too.
//
//   const pins = mountPins({ layer, panel, toggle, i18n, onComment, onClose })
//     layer, panel, toggle: the page's #pins, #thread and #thread-toggle
//     onComment(element, text), onClose(element, closed): promises; a rejection keeps the draft
//   pins.setThreads(threads)            the threads as the server lists them (pins.mjs readThreads)
//   pins.setView(elements, appState)    the board moved, zoomed or changed: the pins follow
//   pins.redraw()                       draws again (the language changed)
//
// Opening the panel with a shape selected opens that shape's thread, a new one when it has none.

import { html, render, nothing } from '/vendor/lit-html/lit-html.js'
import { pinPlaces, selectedShape, shapeLabel } from './pins.mjs'

export function mountPins({ layer, panel, toggle, i18n, onComment, onClose }) {
  let threads = []
  let elements = []
  let appState = { scrollX: 0, scrollY: 0, zoom: { value: 1 } }
  let open = false
  let focus = null   // the element whose thread the panel shows, else the list
  let draft = ''
  let busy = false
  let frame = 0

  const t = (k) => i18n.t(k)
  const when = (iso) => {
    try { return new Date(iso).toLocaleString(i18n.lang === 'hu' ? 'hu-HU' : 'en', { dateStyle: 'medium', timeStyle: 'short' }) } catch { return iso }
  }
  const show = (element) => { open = true; focus = element; draft = ''; draw() }
  const hide = () => { open = false; focus = null; draw() }

  async function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy) return
    busy = true
    draw()
    try {
      await onComment(focus, text)
      draft = ''
    } catch {} finally { busy = false; draw() }
  }

  async function resolve(thread) {
    busy = true
    draw()
    try { await onClose(thread.element, !thread.closed) } catch {} finally { busy = false; draw() }
  }

  const state = (th) => html`
    ${th.orphaned ? html`<span class="gw-badge gw-badge--warn">${t('threads.orphaned')}</span>` : nothing}
    <span class="gw-badge gw-badge--dot ${th.closed ? 'gw-badge--ok' : 'gw-badge--info'}">${t(th.closed ? 'threads.closed' : 'threads.open')}</span>`

  function list() {
    const sel = selectedShape(elements, appState)
    return html`
      <header class="sk-thread__head"><h2>${t('threads.title')}</h2>
        <button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" @click=${hide}>${t('threads.hide')}</button></header>
      ${sel && !threads.some((th) => th.element === sel)
        ? html`<button type="button" class="gw-btn gw-btn--secondary gw-btn--sm" @click=${() => show(sel)}>${t('threads.onSelected')}</button>`
        : nothing}
      ${threads.length
        ? html`<ul class="sk-thread__list">${threads.map((th) => html`<li><button type="button" class="sk-thread__item" @click=${() => show(th.element)}>
            <span class="sk-thread__shape">${shapeLabel(elements, th.element)}</span> ${state(th)}
            <span class="gw-badge gw-badge--count">${th.comments.length}</span></button></li>`)}</ul>`
        : html`<p class="sk-thread__hint">${t('threads.empty')}</p>`}`
  }

  function one() {
    const th = threads.find((x) => x.element === focus) ?? { element: focus, closed: false, orphaned: false, comments: [] }
    return html`
      <header class="sk-thread__head">
        <button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" @click=${() => show(null)}>${t('threads.back')}</button>
        <button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" @click=${hide}>${t('threads.hide')}</button></header>
      <h2 class="sk-thread__shape">${shapeLabel(elements, th.element)} ${th.comments.length ? state(th) : nothing}</h2>
      <ol class="sk-thread__comments">${th.comments.map((c) => html`<li>
        <div class="sk-thread__meta"><strong>${c.author}</strong> · <time datetime=${c.at}>${when(c.at)}</time></div>
        <p>${c.text}</p></li>`)}</ol>
      <form class="sk-thread__form" @submit=${send}>
        <textarea class="gw-field" rows="3" maxlength="4000" .value=${draft} placeholder=${t('threads.placeholder')} aria-label=${t('threads.placeholder')}
          @input=${(e) => { draft = e.target.value }}
          @keydown=${(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(e) }}></textarea>
        <div class="sk-thread__actions">
          ${th.comments.length ? html`<button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" ?disabled=${busy} @click=${() => resolve(th)}>${t(th.closed ? 'threads.reopen' : 'threads.resolve')}</button>` : nothing}
          <button type="submit" class="gw-btn gw-btn--primary gw-btn--sm" ?disabled=${busy}>${t('threads.send')}</button>
        </div>
      </form>`
  }

  function draw() {
    frame = 0
    render(pinPlaces(threads, elements, appState).map((p) => html`<button type="button"
        class="sk-pin ${p.closed ? 'sk-pin--closed' : ''} ${open && focus === p.element ? 'sk-pin--current' : ''}"
        style="left:${p.left}px;top:${p.top}px" title=${t('threads.pin')} aria-label=${t('threads.pin')}
        @click=${() => show(p.element)}>${p.count}</button>`), layer)
    const waiting = threads.filter((th) => !th.closed).length
    render(html`<button type="button" class="gw-btn gw-btn--secondary gw-btn--sm" aria-expanded=${open ? 'true' : 'false'}
        @click=${() => (open ? hide() : show(selectedShape(elements, appState)))}>${t('threads.title')}
        ${waiting ? html`<span class="gw-badge gw-badge--count">${waiting}</span>` : nothing}</button>`, toggle)
    panel.hidden = !open
    render(open ? (focus ? one() : list()) : nothing, panel)
  }
  draw()

  return {
    setThreads(next) { threads = next; draw() },
    setView(nextElements, nextAppState) {
      elements = nextElements
      appState = nextAppState
      if (!frame) frame = requestAnimationFrame(draw)
    },
    redraw: draw,
  }
}
