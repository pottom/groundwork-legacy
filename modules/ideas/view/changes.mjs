// What an accepted idea became: the changes that name it (the list's `changes`, computed by the
// server from the change records and the Spec), each as one line, `→ C-12 · Implementing, 4 items
// in the Spec · 2/5 tickets done` (../summary.mjs, d-idea-summary), a link to the change's page in
// the shell (/?module=changes&change=C-12). The ticket counts are Build's (GET /api/build/changes);
// without Build the line has none. Without the Changes module there are no changes, and nothing
// shows. The look waits for the UI plan (I-12).
//
//   changePart(idea, tickets)   the template, or nothing; tickets: { 'C-12': { total, done } }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { recordHref } from '/shell/record-link.mjs'
import { changeSummary } from '../summary.mjs'
import { ui } from './strings.mjs'

const change = (c, tickets) => html`<a class="gw-tag" href=${recordHref({ id: c.id, name: 'change', module: 'changes' })} target="_top"
  title=${ui('card.change-open', { id: c.id, title: c.title })}>${changeSummary(c, tickets?.[c.id], ui)}</a>`

export function changePart(idea, tickets) {
  if (!idea.changes?.length) return nothing
  return html`<p class="idea__changes">${idea.changes.map((c) => change(c, tickets))}</p>`
}
