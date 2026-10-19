// The list of sessions and their agents (lit-html), as GET /api/agents/list gives them.
//
//   agentList({ sessions, error }, now)   the page's content; `now` (ms) times what still runs

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { ui } from './strings.mjs'
import { duration, clock } from './time.mjs'

const TONE = { running: 'info', done: 'ok', failed: 'bad' }

const badge = (state) => html`<span class="gw-badge gw-badge--dot gw-badge--${TONE[state] ?? 'neutral'}">${ui(`state.${state}`)}</span>`

// When it started and how long it took (or has run so far).
function times(item, now) {
  const end = item.end ? Date.parse(item.end) : now
  return html`<span class="agents-times">
    <span>${ui('started', { time: clock(item.start) })}</span>
    <span class="agents-duration">${ui('took', { duration: duration(end - Date.parse(item.start)) })}</span>
  </span>`
}

function agentRow(a, now) {
  return html`<li class="agents-agent" data-state=${a.state}>
    ${badge(a.state)}
    <span class="agents-name">${a.description || ui('agent.unnamed')}</span>
    ${a.type ? html`<span class="gw-tag">${a.type}</span>` : nothing}
    ${times(a, now)}
  </li>`
}

function sessionCard(s, now) {
  return html`<section class="gw-card agents-session" data-state=${s.state}>
    <header class="gw-card__head agents-session__head">
      ${badge(s.state)}
      <h2 class="agents-session__title">${ui('session', { id: s.id.slice(0, 8) })}</h2>
      ${s.cwd ? html`<span class="gw-tag agents-cwd" title=${s.cwd}>${s.cwd}</span>` : nothing}
      ${times(s, now)}
    </header>
    <div class="gw-card__body">
      ${s.agents.length
        ? html`<ul class="agents-agents">${repeat(s.agents, (a) => a.id, (a) => agentRow(a, now))}</ul>`
        : html`<p class="agents-none">${ui('no-agents')}</p>`}
    </div>
  </section>`
}

export function agentList({ sessions, error }, now) {
  if (error) return html`<div class="gw-callout gw-callout--bad"><div class="gw-callout__body">${ui('error')}</div></div>`
  if (!sessions) return nothing
  if (!sessions.length) {
    return html`<div class="gw-empty">
      <p class="gw-empty__title">${ui('empty.title')}</p>
      <p class="gw-empty__text">${ui('empty.text')}</p>
      <div class="gw-empty__action"><span class="gw-tag">groundwork init</span></div>
    </div>`
  }
  return html`<div class="gw-section-head">
      <h1 class="gw-section-head__title">${ui('title')}</h1>
      <span class="gw-badge gw-badge--count">${sessions.length}</span>
      <span class="gw-section-head__hint">${ui('hint')}</span>
    </div>
    ${repeat(sessions, (s) => s.id, (s) => sessionCard(s, now))}`
}
