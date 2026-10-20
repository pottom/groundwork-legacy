// <gw-target-picker>: where a proposed item may go instead (Elsewhere… on the approval list,
// d-approve-list-actions). A searchable list of the Spec's documents and sections, and of those the
// pending changes propose, each of those marked with the change that brings it (page.targets, the
// store's targets()). It renders into the page (no shadow root), so changes.css styles it.
//
//   el.targets   [{ target, kind: 'document' | 'section', title, document?, change? }]
//   el.kind      what moves: 'item' (into a document or a section) or 'section' (a document only)
//   el.current   the item's target now, which is not offered
//   el.busy      a move under way: the list waits
//   events       'pick' (detail: { target }), 'close' (Escape, or the close button)
//
// It writes nothing itself: the page sends the move (POST /api/changes/target). A new part is not
// made here: Claude proposes one in chat.

import { LitElement, html, nothing } from '/vendor/lit-element/lit-element.js'
import { ui } from './strings.mjs'

const SHOWN = 60   // the rows shown at once; the search narrows the rest

export class TargetPicker extends LitElement {
  static properties = { targets: { attribute: false }, kind: {}, current: {}, busy: { type: Boolean }, query: { state: true } }

  constructor() {
    super()
    /** @type {Array<{ target: string, kind: string, title: string, document?: string, change?: string }>} */
    this.targets = []
    this.kind = 'item'
    this.current = ''
    this.busy = false
    this.query = ''
  }

  createRenderRoot() { return this }

  firstUpdated() { /** @type {HTMLInputElement | null} */ (this.querySelector('input'))?.focus() }

  /** the targets that fit, matching every word of the search in the target, the title or the change */
  matches() {
    const words = this.query.toLowerCase().split(/\s+/).filter(Boolean)
    return this.targets.filter((t) => t.target !== this.current && (this.kind === 'item' || t.kind === 'document'))
      .filter((t) => { const hay = `${t.target} ${t.title} ${t.change ?? ''}`.toLowerCase(); return words.every((w) => hay.includes(w)) })
  }

  /** @param {string} name @param {object} [detail] */
  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true })) }

  /** @param {KeyboardEvent} e */
  key(e) {
    if (e.key === 'Escape') { e.stopPropagation(); this.emit('close') }
    if (e.key === 'Enter') { const first = this.matches()[0]; if (first && !this.busy) this.emit('pick', { target: first.target }) }
  }

  render() {
    const found = this.matches()
    return html`<div class="picker" role="dialog" aria-label=${ui('target.label')} @keydown=${(/** @type {KeyboardEvent} */ e) => this.key(e)}>
      <div class="picker__head">
        <input class="gw-field picker__search" type="search" placeholder=${ui(this.kind === 'section' ? 'target.search.section' : 'target.search')}
          .value=${this.query} @input=${(/** @type {InputEvent} */ e) => { this.query = /** @type {HTMLInputElement} */ (e.target).value }}>
        <button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" @click=${() => this.emit('close')}>${ui('target.close')}</button>
      </div>
      ${found.length ? html`<ul class="picker__list" role="listbox">
        ${found.slice(0, SHOWN).map((t) => html`<li role="option" aria-selected="false">
          <button type="button" class="picker__row" ?disabled=${this.busy} @click=${() => this.emit('pick', { target: t.target })}>
            <span class="picker__title">${t.kind === 'section' ? html`<span class="picker__in">${t.document} ›</span> ` : nothing}${t.title}</span>
            <span class="gw-tag">${t.target}</span>
            ${t.change ? html`<span class="gw-badge gw-badge--warn">${ui('target.from', { id: t.change })}</span>` : nothing}
          </button></li>`)}
      </ul>${found.length > SHOWN ? html`<p class="picker__more">${ui('target.more', { n: found.length - SHOWN })}</p>` : nothing}`
        : html`<p class="part__empty">${ui('target.none')}</p>`}
    </div>`
  }
}

if (!customElements.get('gw-target-picker')) customElements.define('gw-target-picker', TargetPicker)
