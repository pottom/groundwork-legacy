// The list of sessions and their agents (lit-html), as GET /api/agents/list gives them. An agent's
// row opens it, a session's head opens the session, through the address: #agent=<session>/<agent>
// or #agent=<session>. The open one shows its timeline and report (detail.mjs). One that needs
// attention (waiting for permission, stalled, failed: ../attention.mjs, judged at `now`, so the
// page clock makes a stall show) stands out, with its reason.
//
//   agentList({ sessions, error, focus, open, detail, detailError }, now)
//     the page's content; `now` (ms) times what still runs; `focus`: the session or agent a link
//     opened (?agent=<id>); `open` is { session, agent } or null

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { ui } from './strings.mjs'
import { duration, clock } from './time.mjs'
import { agentDetail } from './detail.mjs'
import { attentionOf } from '../attention.mjs'
import { branchHash } from './address.mjs'

const TONE = { running: 'info', done: 'ok', failed: 'bad' }

const badge = (state) => html`<span class="gw-badge gw-badge--dot gw-badge--${TONE[state] ?? 'neutral'}">${ui(`state.${state}`)}</span>`

// Why it needs attention, if it does.
const reason = (need) => need
  ? html`<span class="gw-badge gw-badge--warn agents-attention">${ui(`attention.${need.reason}`, { time: clock(need.since) })}</span>`
  : nothing

// When it started and how long it took (or has run so far).
function times(item, now) {
  const end = item.end ? Date.parse(item.end) : now
  return html`<span class="agents-times">
    <span>${ui('started', { time: clock(item.start) })}</span>
    <span class="agents-duration">${ui('took', { duration: duration(end - Date.parse(item.start)) })}</span>
  </span>`
}

// Its ticket ('#37'), which opens in Build in the whole window, and its branch, which links to its
// row in the worktrees below.
const ticketLink = (ref) => '/?module=build&ticket=' + encodeURIComponent(ref)
function links(item) {
  return [
    item.ticket ? html`<a class="gw-tag agents-ticket" href=${ticketLink(item.ticket)} target="_top" title=${ui(`ticket.from.${item.ticketFrom}`, { ticket: item.ticket })}>${item.ticket}</a>` : nothing,
    item.branch ? html`<a class="gw-tag agents-branch" href=${branchHash(item.branch)} title=${ui('branch', { branch: item.branch })}>${item.branch}</a>` : nothing,
  ]
}

const isOpen = (open, s, a) => !!open && open.session === s.id && (open.agent ?? null) === (a?.id ?? null)

// The link that opens an agent or a session, or closes the open one.
const opener = (href, opened) => html`<a class="gw-btn gw-btn--ghost gw-btn--sm agents-open" href=${opened ? '#' : href}
  aria-expanded=${opened ? 'true' : 'false'}>${ui(opened ? 'timeline.close' : 'timeline.open')}</a>`

const detail = (view, agent, state) => agentDetail({ detail: view.detail, error: view.detailError }, { agent, state })

function agentRow(s, a, view, now) {
  const opened = isOpen(view.open, s, a)
  const need = attentionOf(a, now)
  return html`<li class="agents-agent" id=${'agent-' + a.id} data-state=${a.state} data-attention=${need?.reason ?? nothing} ?data-focus=${view.focus === a.id} data-open=${opened ? 'true' : nothing}>
    ${badge(a.state)}
    ${reason(need)}
    <span class="agents-name">${a.description || ui('agent.unnamed')}</span>
    ${a.type ? html`<span class="gw-tag">${a.type}</span>` : nothing}
    ${links(a)}
    ${times(a, now)}
    ${opener(`#agent=${s.id}/${a.id}`, opened)}
    ${opened ? detail(view, true, a.state) : nothing}
  </li>`
}

function sessionCard(s, view, now) {
  const opened = isOpen(view.open, s, null)
  const need = attentionOf(s, now)
  return html`<section class="gw-card agents-session" id=${'agent-' + s.id} data-state=${s.state} data-attention=${need?.reason ?? nothing} ?data-focus=${view.focus === s.id}>
    <header class="gw-card__head agents-session__head">
      ${badge(s.state)}
      ${reason(need)}
      <h2 class="agents-session__title">${ui('session', { id: s.id.slice(0, 8) })}</h2>
      ${s.cwd ? html`<span class="gw-tag agents-cwd" title=${s.cwd}>${s.cwd}</span>` : nothing}
      ${links(s)}
      ${times(s, now)}
      ${opener(`#agent=${s.id}`, opened)}
    </header>
    <div class="gw-card__body">
      ${opened ? detail(view, false, s.state) : nothing}
      ${s.agents.length
        ? html`<ul class="agents-agents">${repeat(s.agents, (a) => a.id, (a) => agentRow(s, a, view, now))}</ul>`
        : html`<p class="agents-none">${ui('no-agents')}</p>`}
    </div>
  </section>`
}

export function agentList(view, now) {
  const { sessions, error } = view
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
    ${repeat(sessions, (s) => s.id, (s) => sessionCard(s, view, now))}`
}
