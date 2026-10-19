// The worktrees and branches (lit-html), as GET /api/agents/worktrees gives them: each against the
// integration branch it was cut from, merged or not, uncommitted changes, the agent in it and its
// ticket when known, and for one that is ready to clean up the commands to copy. The page runs
// nothing: the copy button only puts the commands on the clipboard.
//
//   worktreeList({ worktrees, copied }, copy)   copy(key, text) copies; `copied` is the key last copied

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { repeat } from '/vendor/lit-html/directives/repeat.js'
import { ui } from './strings.mjs'

const AGENT_TONE = { running: 'info', done: 'ok', failed: 'bad' }

// Where it stands against its base: merged, nothing of its own yet, or ahead/behind.
function standing(i) {
  if (!i.base) return i.worktree?.main ? nothing : html`<span class="gw-badge gw-badge--neutral">${ui('wt.no-base')}</span>`
  const counts = html`<span class="agents-wt__counts" title=${ui('wt.counts-title', { base: i.base })}>
    <span>${ui('wt.ahead', { n: i.ahead })}</span><span>${ui('wt.behind', { n: i.behind })}</span>
    <span class="agents-wt__base">${ui('wt.against')} <span class="gw-tag">${i.base}</span></span>
  </span>`
  const badge = i.ahead === 0 && i.behind === 0 && i.worktree && !i.worktree.main
    ? html`<span class="gw-badge gw-badge--neutral">${ui('wt.nothing-new')}</span>`
    : i.merged ? html`<span class="gw-badge gw-badge--dot gw-badge--ok">${ui('wt.merged')}</span>`
      : html`<span class="gw-badge gw-badge--dot gw-badge--info">${ui('wt.not-merged')}</span>`
  return html`${badge}${counts}`
}

function where(w) {
  if (!w) return html`<span class="gw-badge gw-badge--neutral">${ui('wt.branch-only')}</span>`
  return html`
    <span class="gw-badge gw-badge--neutral">${ui(w.main ? 'wt.main' : 'wt.worktree')}</span>
    ${w.locked ? html`<span class="gw-badge gw-badge--violet" title=${ui('wt.locked-title')}>${ui('wt.locked')}</span>` : nothing}
    ${w.missing ? html`<span class="gw-badge gw-badge--bad">${ui('wt.missing')}</span>` : nothing}
    ${w.dirty ? html`<span class="gw-badge gw-badge--dot gw-badge--warn">${ui('wt.dirty', { n: w.dirty })}</span>` : nothing}`
}

function who(i) {
  if (!i.agent && !i.ticket) return nothing
  return html`<span class="agents-wt__who">
    ${i.ticket ? html`<span class="gw-tag">${i.ticket}</span>` : nothing}
    ${i.agent ? html`<span class="gw-dot gw-dot--${AGENT_TONE[i.agent.state] ?? 'neutral'}${i.agent.state === 'running' ? ' gw-dot--pulse' : ''}"></span>
      <span>${i.agent.description || (i.agent.id ? ui('agent.unnamed') : ui('session', { id: i.agent.session.slice(0, 8) }))}</span>` : nothing}
  </span>`
}

function cleanUp(i, copied, copy) {
  if (!i.ready) return nothing
  const key = i.branch
  const text = i.commands.join('\n')
  return html`<div class="agents-wt__clean">
    <span class="gw-badge gw-badge--dot gw-badge--ok">${ui('wt.ready')}</span>
    <pre class="agents-wt__commands">${text}</pre>
    <button type="button" class="gw-btn gw-btn--sm" @click=${() => copy(key, text)}>${ui(copied === key ? 'wt.copied' : 'wt.copy')}</button>
  </div>`
}

function row(i, copied, copy) {
  return html`<li class="agents-wt" data-ready=${i.ready ? 'yes' : 'no'}>
    <div class="agents-wt__head">
      <span class="gw-tag agents-wt__branch" title=${i.worktree?.path ?? ''}>${i.branch ?? ui('wt.detached', { head: i.head })}</span>
      ${where(i.worktree)}
      ${standing(i)}
      ${who(i)}
    </div>
    ${cleanUp(i, copied, copy)}
  </li>`
}

export function worktreeList({ worktrees, copied }, copy) {
  if (!worktrees?.available) return nothing
  const ready = worktrees.items.filter((i) => i.ready).length
  return html`<section class="agents-worktrees">
    <div class="gw-section-head">
      <h2 class="gw-section-head__title">${ui('wt.title')}</h2>
      <span class="gw-badge gw-badge--count">${worktrees.items.length}</span>
      ${ready ? html`<span class="gw-badge gw-badge--ok">${ui('wt.ready-count', { n: ready })}</span>` : nothing}
      <span class="gw-section-head__hint">${ui('wt.hint')}</span>
    </div>
    <ul class="gw-card agents-wts">${repeat(worktrees.items, (i) => i.branch ?? i.worktree.path, (i) => row(i, copied, copy))}</ul>
  </section>`
}
