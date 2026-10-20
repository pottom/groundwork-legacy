// <gw-record-chip>: a record (I-5, M-9, C-3) as a chip, its id and its title, opening the record in
// the module that declares its type. The first shared Lit component (d-lit, d-lit-scope-c3): any
// module page can use it, served at /shell/record-chip.mjs. The page needs Lit's import map in its
// <head> (core/vendor/README.md).
//
//   import '/shell/record-chip.mjs'
//   html`<gw-record-chip .record=${{ id: 'I-5', name: 'idea', module: 'ideas', title: 'Redesign' }}></gw-record-chip>`
//
// record is a resolved link of the record store ({ id, name?, module?, title? }; core/records/
// types.mjs: ResolvedLink). It renders into the page itself, not a shadow root, so the theme's
// .gw-record-chip (controls.css) styles it: an <a class="gw-tag gw-record-chip"> to the shell's deep
// link in the whole window (record-link.mjs), or a <span> of the same look when the record has no
// page (a milestone, or an id no module declares). Without a title it shows the id alone.

import { LitElement, html, nothing } from '/vendor/lit-element/lit-element.js'
import { recordHref, chipTitle } from './record-link.mjs'

export class RecordChip extends LitElement {
  static properties = { record: { attribute: false } }

  constructor() {
    super()
    /** @type {{ id: string, name?: string, module?: string, title?: string } | null} */
    this.record = null
  }

  // the page's own DOM, so the theme's styles reach it
  createRenderRoot() { return this }

  render() {
    const r = this.record
    if (!r?.id) return nothing
    const inner = html`<b class="gw-record-chip__id">${r.id}</b>${r.title ? html`<span class="gw-record-chip__title">${r.title}</span>` : nothing}`
    const href = recordHref(r)
    return href
      ? html`<a class="gw-tag gw-record-chip" href=${href} target="_top" title=${chipTitle(r)}>${inner}</a>`
      : html`<span class="gw-tag gw-record-chip" title=${chipTitle(r)}>${inner}</span>`
  }
}

if (!customElements.get('gw-record-chip')) customElements.define('gw-record-chip', RecordChip)
