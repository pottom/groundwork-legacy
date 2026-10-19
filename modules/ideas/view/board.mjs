// The kanban: one column per status (New · Considering · To develop · Rejected), a card per idea
// with its number, title, author and source. Read-only for now. Renders with lit-html on the
// shared .gw-* components (/shell/theme.css).
//
//   board({ ideas, error, fresh })   the template; `fresh` holds the ids of ideas that just arrived

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { STATUSES } from '../fields.mjs'
import { ui } from './strings.mjs'

const BULB = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/></svg>`
const TONES = { new: 'info', considering: 'warn', 'to-develop': 'ok', rejected: 'neutral' }
const AUTHOR_TONES = { claude: 'violet', human: 'accent' }

const card = (idea, fresh) => html`
  <li class="gw-card idea${fresh.has(idea.id) ? ' is-fresh' : ''}" data-idea=${idea.id}>
    <div class="idea__head">
      <span class="gw-tag">${idea.id}</span>
      ${idea.author ? html`<span class="gw-badge gw-badge--${AUTHOR_TONES[idea.author] ?? 'neutral'}">${ui(`author.${idea.author}`)}</span>` : nothing}
    </div>
    <h3 class="idea__title">${idea.title}</h3>
    ${idea.source ? html`<p class="idea__source" title=${ui('card.source', { source: idea.source })}>${idea.source}</p>` : nothing}
  </li>`

const column = (status, ideas, fresh) => html`
  <section class="column" data-status=${status} aria-labelledby=${`col-${status}`}>
    <div class="gw-section-head">
      <span class="gw-dot gw-dot--${TONES[status]}" aria-hidden="true"></span>
      <h2 class="gw-section-head__title" id=${`col-${status}`}>${ui(`status.${status}`)}</h2>
      <span class="gw-badge gw-badge--count">${ideas.length}</span>
    </div>
    ${ideas.length
      ? html`<ol class="cards">${repeat(ideas, (i) => i.id, (i) => card(i, fresh))}</ol>`
      : html`<p class="column__empty">${ui('column.empty')}</p>`}
  </section>`

const emptyState = (title, text, action) => html`
  <div class="gw-empty">
    <span class="gw-empty__icon">${BULB}</span>
    <p class="gw-empty__title">${title}</p>
    <p class="gw-empty__text">${text}</p>
    ${action ? html`<div class="gw-empty__action"><code class="gw-tag">${action}</code></div>` : nothing}
  </div>`

export function board({ ideas, error, fresh = new Set() }) {
  if (error) return emptyState(ui('error.title'), ui('error.text', { error }))
  if (!ideas) return nothing
  if (!ideas.length) return emptyState(ui('empty.title'), ui('empty.text'), 'npx @pottom/groundwork ideas add "…"')
  return html`<div class="board" role="group" aria-label=${ui('board.label')}>
    ${STATUSES.map((s) => column(s, ideas.filter((i) => i.status === s), fresh))}
  </div>`
}
