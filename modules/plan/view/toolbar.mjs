// The toolbar over the map (what the map shows, the view, the mode, the legend) and the edge
// handle that opens or closes the document; the view and the mode they switch.
//   toolbarView(), toggleView()  lit-html templates (chrome.mjs renders them)
//   setView(view, { fit, remember }), setMode(mode), observeToolbar()

import { html } from '/vendor/lit-html/lit-html.js'
import { live } from '/vendor/lit-html/directives/live.js'
import { listDocs } from '../documents.mjs'
import { resolveView, SPLIT_MIN_WIDTH } from '../view-rules.mjs'
import { state, remember, mapData } from './state.mjs'
import { ui } from './strings.mjs'
import { ICON } from './icons.mjs'
import { update, toggleLegend } from './chrome.mjs'
import { groupDocs, docName, setFocus } from './focus.mjs'
import { fitMap } from './map.mjs'

// ---- views: map | split | prd ----
// The view chosen is kept; a window too narrow for both shows the map instead (and offers no "both").
export function setView(v, { fit = true, remember: keep = true } = {}) {
  if (keep) { state.wantedView = v; remember('view', v) }
  const view = resolveView(state.wantedView, innerWidth)
  const changed = document.body.dataset.view !== view
  document.body.dataset.view = view
  document.body.dataset.split = innerWidth >= SPLIT_MIN_WIDTH ? 'yes' : 'no'
  update()
  if (fit && changed && state.mind && view !== 'prd') requestAnimationFrame(fitMap)
}
const shownView = () => document.body.dataset.view

// ---- view / edit mode ----
export function setMode(m) {
  m = m === 'edit' ? 'edit' : 'view'
  state.mode = m
  document.body.dataset.mode = m
  remember('mode', m)
  if (state.mind) {
    if (m === 'edit') state.mind.enableEdit(); else { state.mind.disableEdit(); document.getElementById('input-box')?.blur() }
  }
  update()
}

const VIEWS = [['map', ICON.viewMap, 'view.map'], ['split', ICON.viewSplit, 'view.split'], ['prd', ICON.viewPrd, 'view.prd']]

// The focus picker: the whole map, then each document, a component's documents grouped under it.
function focusPicker() {
  const docs = state.mind ? listDocs(mapData()).filter((d) => !d.legacy) : []
  const option = (value, label) => html`<option value=${value} .selected=${live(value === state.focus)}>${label}</option>`
  return html`<select id="focus" class="gw-field" title=${ui('focus.title')} aria-label=${ui('focus.title')} ?hidden=${!docs.length}
      @change=${(e) => setFocus(e.target.value)}>
    ${option('all', ui('focus.all'))}
    ${groupDocs(docs).map((g) => (g.doc
      ? option(g.doc.id, g.doc.label)
      : html`<optgroup label=${g.component.topic}>${option(g.component.id, ui('focus.whole', { topic: g.component.topic }))}${g.docs.map((d) => option(d.id, docName(d)))}</optgroup>`))}
  </select>`
}

export function toolbarView() {
  const edit = state.mode === 'edit'
  const modeTitle = edit ? ui('mode.editTitle') : ui('mode.viewTitle')
  return html`<div id="toolbar" class="gw-card gw-card--glass" role="toolbar" aria-label=${ui('toolbar.label')}>
    ${focusPicker()}
    <div id="views" class="gw-seg" role="group" aria-label=${ui('view.label')}>
      ${VIEWS.map(([v, icon, key]) => html`<button type="button" data-v=${v} title=${ui(key)} aria-label=${ui(key)}
        aria-pressed=${String(shownView() === v)} @click=${() => setView(v)}>${icon}<span>${ui(key)}</span></button>`)}
    </div>
    <button id="mode" class="gw-btn" type="button" ?disabled=${state.readOnly} aria-pressed=${String(edit)} title=${modeTitle} aria-label=${modeTitle}
      @click=${() => setMode(edit ? 'view' : 'edit')}>${ICON.edit}<span>${ui('mode.edit')}</span></button>
    <button id="legend-btn" class="gw-btn gw-btn--icon" type="button" aria-controls="legend" title=${ui('legend.title')} aria-label=${ui('legend.title')}
      aria-expanded=${String(state.legendOpen)} aria-pressed=${String(state.legendOpen)} @click=${() => toggleLegend(!state.legendOpen)}>${ICON.info}</button>
  </div>`
}

export function toggleView() {
  const title = shownView() === 'split' ? ui('view.closePanel') : ui('view.openPanel')
  const next = () => (shownView() === 'split' ? 'map' : innerWidth >= SPLIT_MIN_WIDTH ? 'split' : 'prd')
  return html`<button id="prd-toggle" type="button" title=${title} aria-label=${title} @click=${() => setView(next())}>${ICON.chevron}</button>`
}

// The toolbar stays one row: when its controls do not fit the map's width (a longer language, the
// map beside the document), the view buttons drop their labels first, then the mode button; the
// titles still name them. data-compact on #toolbar: '' | 'views' | 'all'. Called after each render.
const COMPACT = ['', 'views', 'all']
function wraps(bar) {
  const kids = [...bar.children].filter((k) => k.offsetHeight > 0)
  if (kids.length < 2) return false
  const row = Math.max(...kids.map((k) => k.offsetHeight))
  const top = Math.min(...kids.map((k) => k.offsetTop))
  return kids.some((k) => k.offsetTop >= top + row * 0.75)
}
export function fitToolbar() {
  const bar = document.getElementById('toolbar')
  if (!bar) return
  for (const level of COMPACT) {
    if (bar.dataset.compact !== level) bar.dataset.compact = level
    if (!wraps(bar)) return
  }
}

// The toolbar's height, for what sits under it (the notice, the document in the document view);
// a change of its size (the fonts arriving) fits it again.
export function observeToolbar() {
  new ResizeObserver(([e]) => {
    document.documentElement.style.setProperty('--toolbar-h', `${Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.target.offsetHeight)}px`)
    fitToolbar()
  }).observe(document.getElementById('toolbar'))
}
