// What an accepted idea became: the changes that name it (the list's `changes`, computed by the
// server from the change records), each as `→ C-7 · Grilling`, a link to the change's page in the
// shell (/?module=changes&change=C-7). Without the Changes module there are none, and nothing shows.
// The summary of where they are (d-idea-summary) builds on this.
//
//   changePart(idea)   the template, or nothing

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { recordHref } from '/shell/record-link.mjs'
import { ui } from './strings.mjs'

const change = (c) => html`<a class="gw-tag" href=${recordHref({ id: c.id, name: 'change', module: 'changes' })} target="_top"
  title=${ui('card.change-open', { id: c.id, title: c.title })}>${ui('card.change', { id: c.id, stage: ui(`change.${c.status}`) })}</a>`

export function changePart(idea) {
  if (!idea.changes?.length) return nothing
  return html`<p class="idea__changes">${idea.changes.map(change)}</p>`
}
