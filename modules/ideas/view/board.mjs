// The kanban: one column per status (New · Considering · Accepted · Rejected · Snoozed · Duplicate), a card per idea
// with its number, title, author, source, estimate, its nodes on Plan's map (links that open Plan
// there) and, when rejected, the reason (snoozed: until when; duplicate: of which idea). The human
// decides here: a card opens in the drawer (its title is a button), moves by drag and drop onto
// another column, or by its move menu from the keyboard. Renders with lit-html on the shared .gw-*
// components (/shell/theme.css).
//
//   board(state, act)   the template
//     state  { ideas, error, fresh: Set of ids that just arrived, menu: the id whose move menu is open,
//              over: the column a card is dragged over, tickets: { 'I-12': [ticket] } from Build,
//              sketches: { 'I-12': [names of the sketches that link to it] } from Sketch }
//     act    { open(idea), move(idea, status), menu(id | null), over(status | null), copyPrompt(idea) }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { STATUSES } from '../fields.mjs'
import { ui } from './strings.mjs'
import { ticketPart } from './tickets.mjs'
import { mapLinks } from './links.mjs'

const BULB = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>`
const MOVE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`
export const TONES = { new: 'info', considering: 'warn', accepted: 'ok', rejected: 'neutral', snoozed: 'neutral', duplicate: 'neutral' }
const AUTHOR_TONES = { claude: 'violet', human: 'accent' }
export const DRAG_TYPE = 'text/x-groundwork-idea'   // a card being dragged, on the board and the matrix

// The move menu: the other columns, as menu items. Arrow keys walk it, Escape closes it.
export function menuKeys(e, act) {
  const items = [...e.currentTarget.querySelectorAll('[role="menuitem"]')]
  const at = items.indexOf(document.activeElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    items[(at + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    act.menu(null)
  }
}

const moveMenu = (idea, act) => html`
  <div class="gw-popover move-menu" id=${`move-${idea.id}`} role="menu" aria-label=${ui('card.move-label', { id: idea.id })}
    @keydown=${(e) => menuKeys(e, act)}>
    <ul class="gw-popover__list">
      ${STATUSES.filter((s) => s !== idea.status).map((s) => html`<li><button type="button" class="gw-popover__item" role="menuitem"
        @click=${() => { act.menu(null); act.move(idea, s) }}><i class="gw-dot gw-dot--${TONES[s]}" aria-hidden="true"></i>${ui(`status.${s}`)}</button></li>`)}
    </ul>
  </div>`

// A card's quiet marks, which the server computes on each read (marks.mjs): a label and its title.
// They only tell; nothing moves the idea or asks for attention (d-snooze-manual, d-stale-quiet).
const MARKS = () => ({
  'snooze-passed': [ui('mark.snooze-passed'), ui('mark.snooze-passed-title')],
  stale: [ui('mark.stale'), ui('mark.stale-title')],
})
const markBadges = (idea) => (idea.marks ?? []).map((m) => MARKS()[m]).filter(Boolean)
  .map(([label, title]) => html`<span class="gw-badge gw-badge--neutral idea__mark" title=${title}>${label}</span>`)

const card = (idea, state, act) => html`
  <li class="gw-card idea${state.fresh.has(idea.id) ? ' is-fresh' : ''}" data-idea=${idea.id} draggable="true"
    @dragstart=${(e) => { e.dataTransfer.setData(DRAG_TYPE, idea.id); e.dataTransfer.effectAllowed = 'move' }}
    @dragend=${() => act.over(null)}>
    <div class="idea__head">
      <span class="gw-tag">${idea.id}</span>
      ${idea.author ? html`<span class="gw-badge gw-badge--${AUTHOR_TONES[idea.author] ?? 'neutral'}">${ui(`author.${idea.author}`)}</span>` : nothing}
      ${markBadges(idea)}
      <span class="idea__spacer"></span>
      <button type="button" class="gw-btn gw-btn--icon gw-btn--ghost gw-btn--sm idea__move" aria-haspopup="menu"
        aria-expanded=${state.menu === idea.id ? 'true' : 'false'} aria-controls=${`move-${idea.id}`}
        title=${ui('card.move-label', { id: idea.id })} aria-label=${ui('card.move-label', { id: idea.id })}
        @click=${() => act.menu(state.menu === idea.id ? null : idea.id)}>${MOVE}</button>
    </div>
    ${state.menu === idea.id ? moveMenu(idea, act) : nothing}
    <h3 class="idea__title"><button type="button" class="idea__open" @click=${() => act.open(idea)}>${idea.title}</button></h3>
    ${idea.source ? html`<p class="idea__source" title=${ui('card.source', { source: idea.source })}>${idea.source}</p>` : nothing}
    ${idea.impact || idea.effort ? html`<p class="idea__estimate">
      ${idea.impact ? html`<span class="gw-badge">${ui('card.impact', { level: ui(`level.${idea.impact}`) })}</span>` : nothing}
      ${idea.effort ? html`<span class="gw-badge">${ui('card.effort', { level: ui(`level.${idea.effort}`) })}</span>` : nothing}</p>` : nothing}
    ${mapLinks(idea).length ? html`<p class="idea__map">${mapLinks(idea).map((l) => html`<a class="gw-tag" href=${l.href} target="_top"
      title=${ui('card.on-map', { node: l.id })} aria-label=${ui('card.on-map', { node: l.id })}>${l.id}</a>`)}</p>` : nothing}
    ${state.sketches?.[idea.id]?.length ? html`<p class="idea__sketches">${state.sketches[idea.id].map((name) => html`<a class="gw-tag"
      href=${'/?module=sketch&sketch=' + encodeURIComponent(name)} target="_top" title=${ui('card.sketch-open', { name })}>${ui('card.sketch', { name })}</a>`)}</p>` : nothing}
    ${idea.status === 'rejected' && idea.reason ? html`<p class="idea__reason"><span class="idea__reason-label">${ui('card.reason')}</span> ${idea.reason}</p>` : nothing}
    ${idea.status === 'snoozed' && idea.until ? html`<p class="idea__reason">${ui('card.until', { date: idea.until })}</p>` : nothing}
    ${idea.status === 'duplicate' && idea.duplicate ? html`<p class="idea__reason">${ui('card.duplicate', { id: idea.duplicate })}</p>` : nothing}
    ${ticketPart(idea, state.tickets?.[idea.id], act)}
  </li>`

function drop(e, status, ideas, act) {
  e.preventDefault()
  act.over(null)
  const idea = ideas.find((i) => i.id === e.dataTransfer.getData(DRAG_TYPE))
  if (idea && idea.status !== status) act.move(idea, status)
}

const column = (status, all, state, act) => {
  const ideas = all.filter((i) => i.status === status)
  return html`
  <section class="column${state.over === status ? ' is-over' : ''}" data-status=${status} aria-labelledby=${`col-${status}`}
    @dragover=${(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (state.over !== status) act.over(status) } }}
    @dragleave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget) && state.over === status) act.over(null) }}
    @drop=${(e) => drop(e, status, all, act)}>
    <div class="gw-section-head">
      <span class="gw-dot gw-dot--${TONES[status]}" aria-hidden="true"></span>
      <h2 class="gw-section-head__title" id=${`col-${status}`}>${ui(`status.${status}`)}</h2>
      <span class="gw-badge gw-badge--count">${ideas.length}</span>
    </div>
    ${ideas.length
      ? html`<ol class="cards">${repeat(ideas, (i) => i.id, (i) => card(i, state, act))}</ol>`
      : html`<p class="column__empty">${ui('column.empty')}</p>`}
  </section>`
}

const emptyState = (title, text, action) => html`
  <div class="gw-empty">
    <span class="gw-empty__icon">${BULB}</span>
    <p class="gw-empty__title">${title}</p>
    <p class="gw-empty__text">${text}</p>
    ${action ? html`<div class="gw-empty__action"><code class="gw-tag">${action}</code></div>` : nothing}
  </div>`

export function board(state, act) {
  const { ideas, error } = state
  if (error) return emptyState(ui('error.title'), ui('error.text', { error }))
  if (!ideas) return nothing
  if (!ideas.length) return emptyState(ui('empty.title'), ui('empty.text'), 'npx @pottom/groundwork ideas add "…"')
  return html`<div class="board" role="group" aria-label=${ui('board.label')}>
    ${STATUSES.map((s) => column(s, ideas, state, act))}
  </div>`
}
