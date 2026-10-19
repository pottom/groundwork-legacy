// The impact–effort matrix (f-ideas-matrix): the open ideas (New and Considering) in a 2×2, impact
// up, effort across, the quick wins (high impact, low effort) highlighted; ideas without a full
// estimate sit in the "Unestimated" strip below. Where an idea sits, and what a move changes, is
// ../matrix.mjs. A card moves to another quadrant by drag and drop or by its move menu (keyboard);
// the move sets its impact and effort. Its title opens the drawer, as on the board.
//
//   matrix(state, act)   the template
//     state  as for the board (board.mjs); `over` is the quadrant a card is dragged over
//     act    { open(idea), place(idea, quadrant), menu(id | null), over(quadrant | null) }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { QUADRANTS, placeOnMatrix, quadrantOf } from '../matrix.mjs'
import { ui } from './strings.mjs'
import { DRAG_TYPE, TONES, menuKeys } from './board.mjs'

const MOVE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`

const moveMenu = (idea, act) => html`
  <div class="gw-popover move-menu" id=${`move-${idea.id}`} role="menu" aria-label=${ui('matrix.move-label', { id: idea.id })}
    @keydown=${(e) => menuKeys(e, act)}>
    <ul class="gw-popover__list">
      ${QUADRANTS.filter((q) => q.id !== quadrantOf(idea)).map((q) => html`<li><button type="button" class="gw-popover__item" role="menuitem"
        @click=${() => { act.menu(null); act.place(idea, q.id) }}>${ui(`quadrant.${q.id}`)}</button></li>`)}
    </ul>
  </div>`

const card = (idea, state, act) => html`
  <li class="gw-card idea${state.fresh.has(idea.id) ? ' is-fresh' : ''}" data-idea=${idea.id} draggable="true"
    @dragstart=${(e) => { e.dataTransfer.setData(DRAG_TYPE, idea.id); e.dataTransfer.effectAllowed = 'move' }}
    @dragend=${() => act.over(null)}>
    <div class="idea__head">
      <span class="gw-tag">${idea.id}</span>
      <span class="gw-dot gw-dot--${TONES[idea.status]}" title=${ui(`status.${idea.status}`)}></span>
      <span class="idea__spacer"></span>
      <button type="button" class="gw-btn gw-btn--icon gw-btn--ghost gw-btn--sm idea__move" aria-haspopup="menu"
        aria-expanded=${state.menu === idea.id ? 'true' : 'false'} aria-controls=${`move-${idea.id}`}
        title=${ui('matrix.move-label', { id: idea.id })} aria-label=${ui('matrix.move-label', { id: idea.id })}
        @click=${() => act.menu(state.menu === idea.id ? null : idea.id)}>${MOVE}</button>
    </div>
    ${state.menu === idea.id ? moveMenu(idea, act) : nothing}
    <h3 class="idea__title"><button type="button" class="idea__open" @click=${() => act.open(idea)}>${idea.title}</button></h3>
    ${idea.impact || idea.effort ? html`<p class="idea__estimate">
      ${idea.impact ? html`<span class="gw-badge">${ui('card.impact', { level: ui(`level.${idea.impact}`) })}</span>` : nothing}
      ${idea.effort ? html`<span class="gw-badge">${ui('card.effort', { level: ui(`level.${idea.effort}`) })}</span>` : nothing}</p>` : nothing}
  </li>`

const cards = (ideas, state, act) => (ideas.length
  ? html`<ol class="cards">${repeat(ideas, (i) => i.id, (i) => card(i, state, act))}</ol>`
  : html`<p class="column__empty">${ui('column.empty')}</p>`)

function drop(e, quadrant, ideas, act) {
  e.preventDefault()
  act.over(null)
  const idea = ideas.find((i) => i.id === e.dataTransfer.getData(DRAG_TYPE))
  if (idea && quadrantOf(idea) !== quadrant) act.place(idea, quadrant)
}

const quadrant = (q, placed, all, state, act) => html`
  <section class="quadrant quadrant--${q.id}${state.over === q.id ? ' is-over' : ''}" data-quadrant=${q.id} aria-labelledby=${`q-${q.id}`}
    @dragover=${(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (state.over !== q.id) act.over(q.id) } }}
    @dragleave=${(e) => { if (!e.currentTarget.contains(e.relatedTarget) && state.over === q.id) act.over(null) }}
    @drop=${(e) => drop(e, q.id, all, act)}>
    <div class="gw-section-head">
      <h2 class="gw-section-head__title" id=${`q-${q.id}`}>${ui(`quadrant.${q.id}`)}</h2>
      <span class="gw-badge gw-badge--count">${placed[q.id].length}</span>
    </div>
    <p class="quadrant__hint">${ui(`quadrant.${q.id}.hint`)}</p>
    ${cards(placed[q.id], state, act)}
  </section>`

export function matrix(state, act) {
  const placed = placeOnMatrix(state.ideas)
  const open = Object.values(placed).flat()
  return html`<div class="matrix" role="group" aria-label=${ui('matrix.label')}>
    <span class="matrix__axis matrix__axis--impact" aria-hidden="true">${ui('matrix.impact-axis')}</span>
    <span class="matrix__axis matrix__axis--effort" aria-hidden="true">${ui('matrix.effort-axis')}</span>
    <div class="matrix__grid">${QUADRANTS.map((q) => quadrant(q, placed, open, state, act))}</div>
    <section class="unestimated" aria-labelledby="q-unestimated">
      <div class="gw-section-head">
        <h2 class="gw-section-head__title" id="q-unestimated">${ui('matrix.unestimated')}</h2>
        <span class="gw-badge gw-badge--count">${placed.unestimated.length}</span>
      </div>
      ${cards(placed.unestimated, state, act)}
    </section>
  </div>`
}
