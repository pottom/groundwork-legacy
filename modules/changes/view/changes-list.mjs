// <gw-changes-list>: the list of changes, grouped by stage (d-changes-list). A Lit component that
// renders into the page (no shadow root), so the theme's .gw-* components and changes.css style it.
//
//   el.stages    the stage ids in group order (the server's, GET /api/changes/list)
//   el.changes   the rows, as the server gives them; null while the first read is under way
//   el.error     why the list could not be read, or null
//   el.fresh     the ids of the rows the last read changed, highlighted for a moment (a Set)
//   el.lang      the UI language; setting it renders again in it
//
// Each group is a section header with its count, then a card per change: id, title and stage, the
// number of open questions and of proposed items, and the change's ideas and milestone as record
// chips (<gw-record-chip>, shared from the core). A group with no change is left out. The title
// opens the change's page, through the shell's deep link (/?module=changes&change=C-3), so the
// address names the change and a reload opens it again.

import { LitElement, html, nothing } from '/vendor/lit-element/lit-element.js'
import '/shell/record-chip.mjs'
import { ui } from './strings.mjs'

// The tone of each stage's badge: the interview under way (violet, as the stage of thinking, apart
// from the work's statuses), the human is needed (warn), work under way (info), finished (ok).
export const TONE = { grilling: 'violet', 'awaiting-approval': 'warn', implementing: 'info', done: 'ok', dropped: 'neutral' }

/** The shell's deep link of a change's page. @param {string} id */
export const pageHref = (id) => `/?module=changes&change=${encodeURIComponent(id)}`

/** @param {string} key @param {number} n */
const count = (key, n) => ui(n === 0 ? `${key}.none` : n === 1 ? `${key}.one` : key, { n })

export class ChangesList extends LitElement {
  static properties = { stages: { attribute: false }, changes: { attribute: false }, error: { attribute: false }, fresh: { attribute: false }, lang: {} }

  constructor() {
    super()
    /** @type {string[]} */
    this.stages = []
    /** @type {any[] | null} */
    this.changes = null
    /** @type {string | null} */
    this.error = null
    /** @type {Set<string>} */
    this.fresh = new Set()
    this.lang = ''
  }

  createRenderRoot() { return this }

  render() {
    if (this.error) return html`<div class="gw-empty" role="alert">
      <p class="gw-empty__title">${ui('error.title')}</p><p class="gw-empty__text">${ui('error.text', { error: this.error })}</p></div>`
    if (!this.changes) return html`<p class="changes__loading">${ui('loading')}</p>`
    if (!this.changes.length) return html`<div class="gw-empty">
      <p class="gw-empty__title">${ui('empty.title')}</p><p class="gw-empty__text">${ui('empty.text')}</p></div>`
    const all = this.changes
    return html`<div class="changes" aria-label=${ui('list.label')}>
      ${this.stages.map((stage) => {
        const rows = all.filter((c) => c.stage === stage)
        return rows.length ? this.group(stage, rows) : nothing
      })}
    </div>`
  }

  /** @param {string} stage @param {any[]} rows */
  group(stage, rows) {
    return html`<section class="stage" data-stage=${stage} aria-labelledby=${`stage-${stage}`}>
      <div class="gw-section-head">
        <h2 class="gw-section-head__title" id=${`stage-${stage}`}>${ui(`stage.${stage}`)}</h2>
        <span class="gw-badge gw-badge--count">${rows.length}</span>
      </div>
      <ul class="changes__rows">${rows.map((c) => this.row(c))}</ul>
    </section>`
  }

  /** @param {any} c */
  row(c) {
    return html`<li class=${`change gw-card${this.fresh.has(c.id) ? ' is-flash' : ''}`} data-id=${c.id}>
      <div class="change__head">
        <span class="gw-tag change__id">${c.id}</span>
        <h3 class="change__title"><a href=${pageHref(c.id)} target="_top">${c.title}</a></h3>
        <span class=${`gw-badge gw-badge--dot gw-badge--${TONE[c.stage] ?? 'neutral'}`}>${ui(`stage.${c.stage}`)}</span>
      </div>
      <div class="change__facts">
        <span class=${c.questions ? 'change__count is-open' : 'change__count'}>${count('row.questions', c.questions)}</span>
        <span class="change__count">${count('row.items', c.items)}</span>
      </div>
      ${c.ideas.length || c.milestone ? html`<div class="change__links">
        ${c.ideas.length ? html`<span class="change__label">${ui('row.ideas')}</span>
          ${c.ideas.map((/** @type {any} */ l) => html`<gw-record-chip .record=${l}></gw-record-chip>`)}` : nothing}
        ${c.milestone ? html`<span class="change__label">${ui('row.milestone')}</span>
          <gw-record-chip .record=${c.milestone}></gw-record-chip>` : nothing}
      </div>` : nothing}
    </li>`
  }
}

if (!customElements.get('gw-changes-list')) customElements.define('gw-changes-list', ChangesList)
