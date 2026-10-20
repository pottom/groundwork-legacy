// <gw-change-page>: one change, read-only (d-changes-page-readonly). A Lit component that renders
// into the page (no shadow root), so the theme's .gw-* components and changes.css style it. Nothing
// on it writes: Claude writes the change's file during the interview, and the page shows it.
//
//   el.page      the change as GET /api/changes/show gives it (page.mjs: changePage); null while
//                the first read is under way
//   el.error     why the last read failed, or null; the last good page stays, with a note above it
//   el.missing   the id asked for when there is no such change
//   el.flash     what the last write changed (compare.mjs: Diff), highlighted for a moment, or null
//   el.lang      the UI language; setting it renders again in it
//
// At the top, the workspace (d-map-workspace): the change's thought map (<gw-mind-map>, the root its
// title) on the left, its open questions on the right, computed from the map (thoughts.mjs), the
// latest on top, each with its options and Claude's recommendation; a click on one scrolls the map
// to its node. An older change's Questions list shows in the panel too. The panel is a list of
// questions with a list of options each, so answering from the page (C-7) can make the options
// buttons in place. A change awaiting approval, or one without a map, shows the workspace as one
// line (thought map · n nodes) that opens on a click.
// Then the parts in the file's order: problem, solution, scope, out of scope, the proposed items (op,
// id, → target, text, note), the tickets rule, the history. What changed since the last commit is
// marked (page.marks: new, modified; a removed part, map node or item is shown struck through until
// the next commit), on the map too; what the last write changed flashes (el.flash).
// The Markdown arrives rendered by the server, raw HTML shown as text (core/records/render.mjs), so
// it goes in through unsafeHTML.

import { LitElement, html, nothing } from '/vendor/lit-element/lit-element.js'
import { unsafeHTML } from '/vendor/lit-html/directives/unsafe-html.js'
import '/shell/record-chip.mjs'
import '/shell/mind-map.mjs'
import { ui } from './strings.mjs'
import { TONE } from './changes-list.mjs'
import { mapTree, openQuestions, idOf } from '../thoughts.mjs'

const TEXT_PARTS = ['problem', 'solution', 'scope', 'outOfScope']
const OP_TONE = { add: 'ok', change: 'info', supersede: 'warn' }
const MARK_TONE = { new: 'ok', modified: 'info', removed: 'bad' }

/** @param {string | undefined} rendered */
const md = (rendered) => (rendered ? unsafeHTML(rendered) : nothing)

export class ChangePage extends LitElement {
  static properties = { page: { attribute: false }, error: { attribute: false }, missing: { attribute: false }, flash: { attribute: false }, lang: {}, open: { state: true } }

  constructor() {
    super()
    /** @type {any} */
    this.page = null
    /** @type {string | null} */
    this.error = null
    /** @type {string | null} */
    this.missing = null
    /** @type {any} */
    this.flash = null
    this.lang = ''
    /** @type {boolean | null} the workspace opened or closed by hand; null: as the stage says */
    this.open = null
  }

  createRenderRoot() { return this }

  // the classes of a part: its mark since the last commit, and the flash of the last write
  /** @param {'sections' | 'questions' | 'items' | 'thoughts' | 'title'} kind @param {string} [key] */
  marked(kind, key) {
    const of = (/** @type {any} */ d) => (!d ? null : kind === 'title' ? d.title : d[kind]?.[key ?? ''] ?? null)
    const mark = of(this.page?.marks)
    const flash = of(this.flash)
    return [mark ? `is-${mark}` : '', flash && flash !== 'removed' ? 'is-flash' : ''].filter(Boolean).join(' ')
  }

  /** @param {string | null | undefined} mark */
  badge(mark) {
    return mark ? html`<span class=${`gw-badge gw-badge--${MARK_TONE[mark]}`}>${ui(`mark.${mark}`)}</span>` : nothing
  }

  render() {
    const back = html`<a class="page__back" href="/?module=changes" target="_top">← ${ui('page.back')}</a>`
    if (this.missing) return html`${back}<div class="gw-empty" role="alert">
      <p class="gw-empty__title">${ui('page.missing.title', { id: this.missing })}</p><p class="gw-empty__text">${ui('page.missing.text')}</p></div>`
    const p = this.page
    if (!p) return this.error
      ? html`${back}<div class="gw-empty" role="alert"><p class="gw-empty__title">${ui('page.error.title')}</p><p class="gw-empty__text">${ui('error.text', { error: this.error })}</p></div>`
      : html`${back}<p class="changes__loading">${ui('page.loading')}</p>`
    return html`${back}
      ${this.error ? html`<div class="gw-callout gw-callout--warn page__stale" role="status"><div class="gw-callout__body">${ui('page.stale', { error: this.error })}</div></div>` : nothing}
      <article class="page" aria-labelledby="page-title">
        ${this.head(p)}
        ${this.workspace(p)}
        ${TEXT_PARTS.map((k) => this.part(p, k))}
        ${this.items(p)}
        ${this.tickets(p)}
        ${this.history(p)}
      </article>`
  }

  /** @param {any} p */
  head(p) {
    const marks = p.marks
    return html`<header class="page__head">
      <div class="change__head">
        <span class="gw-tag change__id">${p.id}</span>
        <h1 class=${`page__title ${this.marked('title')}`} id="page-title">${p.title}${this.badge(marks?.title)}</h1>
        <span class=${`gw-badge gw-badge--dot gw-badge--${TONE[p.stage] ?? 'neutral'}`}>${ui(`stage.${p.stage}`)}</span>
      </div>
      ${p.ideas.length || p.milestone ? html`<div class="change__links">
        ${p.ideas.length ? html`<span class="change__label">${ui('row.ideas')}</span>
          ${p.ideas.map((/** @type {any} */ l) => html`<gw-record-chip .record=${l}></gw-record-chip>`)}` : nothing}
        ${p.milestone ? html`<span class="change__label">${ui('row.milestone')}</span><gw-record-chip .record=${p.milestone}></gw-record-chip>` : nothing}
      </div>` : nothing}
      <p class="page__file"><span class="gw-tag">${p.file}</span>${marks ? html` · <span>${ui('page.since')}</span>` : nothing}</p>
    </header>`
  }

  /** @param {any} p @param {string} key */
  part(p, key) {
    const mark = p.marks?.sections?.[key]
    const text = p.content.sections[key]
    return html`<section class=${`part ${this.marked('sections', key)}`} data-part=${key}>
      <h2 class="part__title">${ui(`part.${key}`)}${this.badge(mark)}</h2>
      ${text ? html`<div class="md">${md(p.html.sections[key])}</div>`
        : mark === 'removed' ? html`<div class="md is-gone">${md(p.html.sections[key])}</div>`
        : html`<p class="part__empty">${ui('part.empty')}</p>`}
    </section>`
  }

  /** @param {any} p */
  workspace(p) {
    const thoughts = p.content.thoughts ?? []
    const removed = p.marks?.removed?.thoughts ?? []
    const open = this.open ?? (p.stage !== 'awaiting-approval' && (thoughts.length > 0 || p.questions > 0))
    const count = ui(thoughts.length === 1 ? 'ws.nodes.one' : 'ws.nodes', { n: thoughts.length })
    const toggle = () => { this.open = !open }
    if (!open) return html`<section class="workspace is-collapsed" data-part="workspace">
      <button class="workspace__bar" type="button" aria-expanded="false" @click=${toggle}>
        <span class="workspace__chevron" aria-hidden="true">▸</span>${ui('ws.map')} · ${count}${p.questions ? html` · ${ui(p.questions === 1 ? 'row.questions.one' : 'row.questions', { n: p.questions })}` : nothing}</button>
    </section>`
    /** @type {Record<string, string>} */
    const marks = {}
    for (const [key, mark] of Object.entries(p.marks?.thoughts ?? {})) marks[idOf(key)] = mark
    for (const t of removed) marks[t.id] = 'removed'
    const flash = Object.keys(this.flash?.thoughts ?? {}).map(idOf)
    const questions = openQuestions(thoughts, p.marks)
    const older = p.content.questions.filter((/** @type {any} */ q) => !q.done)
    return html`<section class="workspace" data-part="workspace">
      <button class="workspace__bar" type="button" aria-expanded="true" @click=${toggle}>
        <span class="workspace__chevron" aria-hidden="true">▾</span>${ui('ws.map')} · ${count}</button>
      <div class="workspace__body">
        <gw-mind-map class="workspace__map" .tree=${mapTree(p.title, thoughts, removed)} .marks=${marks} .flash=${flash}></gw-mind-map>
        <aside class="workspace__panel" aria-labelledby="ws-questions">
          <h2 class="part__title" id="ws-questions">${ui('ws.questions')}<span class="gw-badge gw-badge--count">${p.questions}</span></h2>
          ${questions.length || older.length ? html`<ol class="open-questions">
            ${questions.map((q) => html`<li class=${`open-question ${this.marked('thoughts', q.key)}`} data-id=${q.id}>
              <button class="open-question__text" type="button" title=${ui('ws.jump')} @click=${() => this.jump(q.id)}>${q.text}</button>${this.badge(p.marks?.thoughts?.[q.key])}
              ${q.note ? html`<p class="open-question__note">${q.note}</p>` : nothing}
              ${q.options.length ? html`<ul class="options">${q.options.map((o) => html`<li class=${`option ${o.recommended ? 'is-recommended' : ''}`} data-id=${o.id}>
                ${o.recommended ? html`<span class="option__star" aria-label=${ui('ws.recommended')}>★</span>` : nothing}<span>${o.text}</span></li>`)}</ul>` : nothing}
            </li>`)}
            ${older.map((/** @type {any} */ q) => html`<li class=${`open-question is-older ${this.marked('questions', q.key)}`} data-key=${q.key}>
              <div class="md">${md(p.html.questions[q.key])}</div><span class="gw-badge gw-badge--neutral">${ui('ws.older')}</span></li>`)}
          </ol>` : html`<p class="part__empty">${ui('ws.none')}</p>`}
        </aside>
      </div>
    </section>`
  }

  /** scrolls the map to a question's node @param {string} id */
  jump(id) {
    /** @type {any} */ (this.querySelector('gw-mind-map'))?.focusNode(id)
  }

  /** @param {any} p */
  items(p) {
    const removed = p.marks?.removed?.items ?? []
    return html`<section class="part" data-part="items">
      <h2 class="part__title">${ui('part.items')}<span class="gw-badge gw-badge--count">${p.content.items.length}</span></h2>
      ${p.content.items.length || removed.length ? html`<ul class="items">
        ${p.content.items.map((/** @type {any} */ i) => this.item(p, i, p.marks?.items?.[i.id]))}
        ${removed.map((/** @type {any} */ i) => this.item(p, i, 'removed'))}
      </ul>` : html`<p class="part__empty">${ui('item.none')}</p>`}
    </section>`
  }

  /** @param {any} p @param {any} i @param {string | undefined} mark */
  item(p, i, mark) {
    const gone = mark === 'removed'
    const struck = gone ? 'is-gone' : ''
    return html`<li class=${`item ${gone ? 'is-removed' : this.marked('items', i.id)}`} data-id=${i.id}>
      <div class=${`item__line ${struck}`}>
        <span class=${`gw-badge gw-badge--${OP_TONE[i.op] ?? 'neutral'}`}>${i.op}</span>
        <span class="gw-tag item__id">${i.id}</span><span class="item__arrow" aria-label=${ui('item.to')}>→</span><span class="gw-tag item__target">${i.target}</span>
        ${this.badge(mark)}
      </div>
      ${i.text ? html`<p class=${`item__text ${struck}`}>${i.text}</p>` : nothing}
      ${i.note ? html`<div class=${`md item__note ${struck}`}>${md(p.html.notes[i.id])}</div>` : nothing}
    </li>`
  }

  /** @param {any} p */
  tickets(p) {
    return html`<section class="part" data-part="tickets">
      <h2 class="part__title">${ui('part.tickets')}</h2>
      <p>${p.tickets ? html`${ui('tickets.rule')} <code>**Change:** ${p.tickets}</code>` : html`<span class="part__empty">${ui('tickets.none')}</span>`}</p>
    </section>`
  }

  /** @param {any} p */
  history(p) {
    return html`<section class="part" data-part="history">
      <h2 class="part__title">${ui('part.history')}</h2>
      ${p.history.length ? html`<ul class="history">${p.history.map((/** @type {string} */ h) => html`<li>${h.replace(/^-\s*/, '')}</li>`)}</ul>`
        : html`<p class="part__empty">${ui('part.empty')}</p>`}
    </section>`
  }
}

if (!customElements.get('gw-change-page')) customElements.define('gw-change-page', ChangePage)
