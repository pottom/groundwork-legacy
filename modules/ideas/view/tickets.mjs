// A card's tickets (d-ideas-ticket-line): the tickets whose "**Idea:** I-12" line names the idea, with
// their number and state, as Build's GET /api/build/ideas reports them; and, for an idea that may
// become one (canMakeTicket) with no ticket yet, "Make a ticket", which copies a ready prompt for Claude
// (../ticket.mjs). Without Build there are no tickets to show, and the button still works.
//
//   ticketPart(idea, tickets, act)   the template, or nothing
//     tickets  [{ label, title, status, closed, url? }] naming this idea, or undefined
//     act      { copyPrompt(idea) }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { canMakeTicket } from '../ticket.mjs'
import { ui } from './strings.mjs'

const tone = (t) => (t.closed ? (t.status === 'wontfix' ? 'neutral' : 'ok') : 'info')

const ticket = (t) => html`<li class="idea__ticket">
  ${t.url
    ? html`<a class="gw-tag" href=${t.url} target="_blank" rel="noopener" title=${t.title}>${t.label}</a>`
    : html`<span class="gw-tag" title=${t.title}>${t.label}</span>`}
  <span class="gw-badge gw-badge--dot gw-badge--${tone(t)}">${t.status}</span></li>`

export function ticketPart(idea, tickets, act) {
  if (tickets?.length) {
    return html`<ul class="idea__tickets" aria-label=${ui('card.tickets')}>${tickets.map(ticket)}</ul>`
  }
  if (!canMakeTicket(idea)) return nothing
  return html`<p class="idea__actions"><button type="button" class="gw-btn gw-btn--sm"
    title=${ui('card.make-ticket-title', { id: idea.id })} @click=${() => act.copyPrompt(idea)}>${ui('card.make-ticket')}</button></p>`
}

// The prompt, on the clipboard; false when the browser refused it.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
