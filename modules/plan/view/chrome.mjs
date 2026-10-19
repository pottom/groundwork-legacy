// The page's chrome around the map, rendered with lit-html from the state: the toolbar, the
// legend, the notice, the document's edge handle and the status dock (into #chrome), the toasts
// (#toasts) and the empty state (#empty). update() draws them again; lit-html changes only what changed.
//   update(), toggleLegend(open), showNotice(key, vars), toast(kind, text, { tone, ms }), copy(text, done)

import { html, render, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { state } from './state.mjs'
import { ui } from './strings.mjs'
import { ICON } from './icons.mjs'
import { toolbarView, toggleView } from './toolbar.mjs'
import { dockView } from './dock.mjs'
import { legendView } from './legend.mjs'

const $ = (id) => document.getElementById(id)

// A deep link to an id the map does not have: a notice under the toolbar.
function noticeView() {
  const n = state.notice
  return html`<div id="notice" class="gw-callout gw-callout--warn" role="alert" ?hidden=${!n}>
    <span class="gw-callout__icon">${ICON.alert}</span>
    <div class="gw-callout__body">${n ? ui(n.key, n.vars) : nothing}</div>
    <button type="button" class="gw-callout__close" title=${ui('notice.close')} aria-label=${ui('notice.close')} @click=${() => showNotice(null)}>&times;</button>
  </div>`
}

// ---- toasts: Plan's own transient activity (the shell shows whether the page is live) ----
const toasts = new Map() // kind -> { text, tone, timer }: one toast per kind, the newest replaces the last
const toastsView = () => repeat([...toasts], ([kind]) => kind, ([, t]) =>
  html`<div class="gw-toast gw-toast--${t.tone}" role=${t.tone === 'bad' ? 'alert' : 'status'}>${t.text}</div>`)

export function toast(kind, text, { tone = 'ok', ms = 2600 } = {}) {
  const t = toasts.get(kind) || {}
  clearTimeout(t.timer)
  toasts.set(kind, { text, tone, timer: setTimeout(() => { toasts.delete(kind); update() }, ms) })
  update()
}

export async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast('copy', done) } catch { /* no clipboard: the text is selectable */ }
}

// ---- no map yet: how to start one ----
function emptyView() {
  if (state.page !== 'empty') return nothing
  const cmd = `npx @pottom/groundwork plan init "${ui('empty.topic')}"`
  return html`<div class="gw-empty">
    <span class="gw-empty__icon">${ICON.map}</span>
    <p class="gw-empty__title">${ui('empty.title')}</p>
    <p class="gw-empty__text">${ui('empty.text')}</p>
    <div class="gw-empty__action"><span class="cmd"><code class="gw-tag">${cmd}</code><button type="button" class="gw-btn gw-btn--icon gw-btn--sm"
      title=${ui('empty.copy')} aria-label=${ui('empty.copy')} @click=${() => copy(cmd, ui('empty.copied'))}>${ICON.copy}</button></span></div>
  </div>`
}

export function update() {
  document.body.dataset.state = state.page
  render(html`${toolbarView()}${legendView()}${noticeView()}${toggleView()}${dockView()}`, $('chrome'))
  render(toastsView(), $('toasts'))
  $('empty').hidden = state.page !== 'empty'
  render(emptyView(), $('empty'))
}

export function toggleLegend(open) {
  state.legendOpen = open
  update()
}

export function showNotice(key, vars) {
  state.notice = key ? { key, vars } : null
  update()
}
