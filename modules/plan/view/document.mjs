// The document panel: the document of the map shown in #prd (documents.mjs builds it), rendered
// with lit-html; Markdown (marked, with ../markdown.mjs: raw HTML shown as text, safe links only)
// goes in through unsafeHTML. What changed since the last
// render flashes; the selected node's row is highlighted.
//   renderPrd({ force }), renderPrdSoon(), highlightInPrd(id, { scroll }), resetFlash()

import { html, render, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { unsafeHTML } from '/vendor/lit-html/directives/unsafe-html.js'
import { Marked } from '/vendor/marked/marked.esm.js'
import { createMarkdown } from '../markdown.mjs'
import { buildPrd, progressSummary, BASE_DIR, listDocs, docOf } from '../documents.mjs'
import { summaryBadges, coalesce } from '../view-rules.mjs'
import { state, mapData } from './state.mjs'
import { ui, hasText } from './strings.mjs'
import { ICON } from './icons.mjs'
import { copy } from './chrome.mjs'
import { groupDocs, docName, pickDoc } from './focus.mjs'
import { selectOnMap } from './map.mjs'
import { editorView, openEditor, isOpen } from './editor.mjs'

const panel = () => document.getElementById('prd')
const doc = () => panel().querySelector('.doc')
const markdown = createMarkdown(Marked)
const md = (t) => unsafeHTML(markdown.block(t))
const mdInline = (t) => unsafeHTML(markdown.inline(t))

const PROGRESS_TONE = { done: 'ok', active: 'info', untouched: 'neutral' }
const IMPL_TONE = { done: 'ok', partial: 'warn', missing: 'bad' }

// a link in a row is shown, not followed, and it does not select the row
const stay = (e) => { e.preventDefault(); e.stopPropagation() }

function itemView(it, { showSection = false } = {}) {
  return html`<li data-id=${it.id} data-status=${it.status ?? nothing} style="--d:${showSection ? 0 : it.depth}" @click=${() => selectOnMap(it.id)}><i></i><span class="c"><span class="t">${it.topic}</span>${
    it.impl ? html`<span class="gw-badge gw-badge--${IMPL_TONE[it.impl]}">${ui(`impl.${it.impl}`)}</span>` : nothing}${
    it.status === 'inferred' ? html`<span class="gw-badge gw-badge--info">${ui('panel.inferred')}</span>` : nothing}${
    it.note ? html`<span class="n">${mdInline(it.note)}</span>` : nothing}${
    it.link ? html`<a class="gw-tag" href="#" data-link=${it.link} title=${it.link} @click=${stay}>${it.link}</a>` : nothing}</span>${
    showSection ? html`<span class="s">${it.untouched ? ui('panel.untouched') : it.section}</span>` : nothing}</li>`
}
const itemsView = (items, opts) => html`<ul class="items">${repeat(items, (it) => it.id, (it) => itemView(it, opts))}</ul>`

// A paragraph of a section: Claude's, or one of yours (which: 'claude' or the paragraph's id).
function proseView(sectionId, which, text) {
  if (isOpen(sectionId, which)) return editorView()
  const human = which !== 'claude'
  return html`<div class="prose ${human ? 'human' : 'claude'}" data-key="${sectionId}:${which}" @dblclick=${() => openEditor(sectionId, which)}>${
    human ? html`<span class="who">${ui('panel.yours')}</span>` : nothing}<button type="button" class="edit gw-btn gw-btn--sm"
    @click=${() => openEditor(sectionId, which)}>${ICON.pen}${ui('panel.edit')}</button>${md(text)}</div>`
}

function jump(id) {
  document.getElementById('sec-' + id)?.scrollIntoView({ behavior: 'smooth' })
  selectOnMap(id)
}

function headView(data, docs, prd) {
  const file = `${BASE_DIR}/${prd.doc.file}`
  const label = (d) => { const c = progressSummary(buildPrd(data, d.id)); return `${docName(d)} · ${c.done}/${c.done + c.active + c.untouched}` }
  const option = (d) => html`<option value=${d.id} .selected=${d.id === state.doc}>${label(d)}</option>`
  const kind = hasText(`kind.${prd.kind}`) ? ui(`kind.${prd.kind}`) : prd.subtitle
  const progress = (s) => `${s.title}: ${ui(`progress.${s.progress}`)}`
  return html`<header class="head gw-card">
    ${docs.length > 1 ? html`<div class="docpick"><label for="docpick">${ui('panel.document')}</label><select id="docpick" class="gw-field"
      @change=${(e) => pickDoc(e.target.value)}>${groupDocs(docs).map((g) => (g.doc ? option(g.doc)
        : html`<optgroup label=${g.component.topic}>${g.docs.map(option)}</optgroup>`))}</select></div>` : nothing}
    <p class="eyebrow">${prd.doc.component ? html`<span>${prd.doc.component.topic}</span><span class="sep" aria-hidden="true">›</span>` : nothing}<b>${kind}</b></p>
    <h1>${prd.title}</h1>
    <div class="file"><span class="gw-tag" title=${file}>${file}</span><button type="button" class="gw-btn gw-btn--icon gw-btn--sm"
      title=${ui('panel.copyPath')} aria-label=${ui('panel.copyPath')} @click=${() => copy(file, ui('panel.copied'))}>${ICON.copy}</button></div>
    ${prd.sections.length ? html`<div class="bar">${prd.sections.map((s) => html`<button type="button" class=${s.progress}
      title=${progress(s)} aria-label=${progress(s)} @click=${() => jump(s.id)}></button>`)}</div>` : nothing}
    <div class="badges">${summaryBadges(progressSummary(prd), ui).map((b) => html`<span class="gw-badge gw-badge--dot gw-badge--${b.tone}">${b.text}</span>`)}</div>
  </header>`
}

function sectionView(s, i) {
  return html`<section id="sec-${s.id}" data-section=${s.id}>
    <div class="gw-section-head"><h2 class="gw-section-head__title" data-id=${s.id} @click=${() => selectOnMap(s.id)}><span class="num">${i + 1}.</span>${s.title}</h2><span
      class="gw-badge gw-badge--${PROGRESS_TONE[s.progress]}">${ui(`progress.${s.progress}`)}</span></div>
    ${s.prose ? proseView(s.id, 'claude', s.prose) : nothing}
    ${repeat(s.human, (h) => h.id, (h) => proseView(s.id, h.id, h.text))}
    ${!s.prose && !s.human.length && !s.items.length ? html`<p class="placeholder">${ui('panel.notDiscussed')}</p>` : nothing}
    ${s.items.length ? itemsView(s.items) : nothing}
    ${isOpen(s.id, 'new') ? editorView() : html`<button type="button" class="add gw-btn gw-btn--ghost gw-btn--sm"
      @click=${() => openEditor(s.id, 'new')}>${ICON.plus}${ui('panel.add')}</button>`}
  </section>`
}

const crossView = (title, badge, body) => html`<section class="cross"><div class="gw-section-head"><h2 class="gw-section-head__title">${title}</h2>${badge}</div>${body}</section>`

function documentView() {
  const data = mapData()
  const docs = listDocs(data)
  if (!docs.some((d) => d.id === state.doc)) state.doc = docs[0].id
  const prd = buildPrd(data, state.doc)
  // the closing sections' titles are part of the document: they keep its language
  const cross = [[prd.cross.nonGoals, prd.nonGoals], [prd.cross.later, prd.later], [prd.cross.open, prd.open]].filter(([, list]) => list.length)
  const glossary = (prd.kind === 'prd' || prd.kind === 'system') && state.glossary.trim()
  return html`${headView(data, docs, prd)}${repeat(prd.sections, (s) => s.id, sectionView)}${
    cross.map(([title, list]) => crossView(title, html`<span class="gw-badge gw-badge--count">${list.length}</span>`, itemsView(list, { showSection: true })))}${
    glossary ? crossView(prd.text.glossary, nothing, html`<div class="glossary">${md(state.glossary)}</div>`) : nothing}`
}

let lastSnapshot = null // id -> rendered text, to flash what changed
export const resetFlash = () => { lastSnapshot = null }

// While a paragraph is being edited, only the editor itself redraws the panel (force).
export function renderPrd({ force = false } = {}) {
  if (!state.mind || (state.editor && !force)) return
  const root = doc()
  render(documentView(), root)
  // flash what changed since the last render
  const snap = new Map()
  for (const el of root.querySelectorAll('li[data-id], [data-key]')) snap.set(el.dataset.key || el.dataset.id, el.textContent)
  if (lastSnapshot) for (const [k, text] of snap) {
    if (lastSnapshot.get(k) === text) continue
    const el = root.querySelector(`[data-key="${CSS.escape(k)}"], li[data-id="${CSS.escape(k)}"]`)
    if (el) { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh') }
  }
  lastSnapshot = snap
  highlightInPrd(state.mind.currentNode?.nodeObj?.id, { scroll: false })
}
export const renderPrdSoon = coalesce(() => renderPrd())

export function highlightInPrd(id, { scroll = true } = {}) {
  const root = doc()
  for (const el of root.querySelectorAll('.active-row')) el.classList.remove('active-row')
  if (!id) return
  const owner = docOf(mapData(), id)
  if (scroll && owner && owner !== state.doc && !state.editor) { state.doc = owner; lastSnapshot = null; renderPrd() }
  const el = root.querySelector(`li[data-id="${CSS.escape(id)}"]`) || root.querySelector(`h2[data-id="${CSS.escape(id)}"]`)
  if (!el) return
  el.classList.add('active-row')
  if (scroll && document.body.dataset.view !== 'map') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
