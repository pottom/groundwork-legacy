// An open agent (or session): its timeline and its final report (lit-html), as
// GET /api/agents/agent gives them. Test runs and commits stand out; the report is Markdown,
// rendered with the safe options of markdown.mjs (raw HTML shows as text).
//
//   agentDetail({ detail, error }, { agent, state })
//     detail: { steps, report } or null while it loads; agent: whether it is a subagent (a session
//     has no report); state: running | done | failed

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { unsafeHTML } from '/vendor/lit-html/directives/unsafe-html.js'
import { Marked } from '/vendor/marked/marked.esm.js'
import { MARKDOWN_OPTIONS } from './markdown.mjs'
import { ui } from './strings.mjs'
import { clock } from './time.mjs'

const marked = new Marked(MARKDOWN_OPTIONS)
const OUTCOME = { passed: 'ok', failed: 'bad', ran: 'neutral' }

const tags = (list, more) => html`${list.map((x) => html`<span class="gw-tag">${x}</span>`)}${more ? html`<span class="agents-more">${ui('more', { count: more })}</span>` : nothing}`

// What a step names: its files, commands, tools, test outcome, commit, skill or subagent.
function what(s) {
  switch (s.kind) {
    case 'read': case 'edit': return tags(s.files, s.more)
    case 'command': return tags(s.commands)
    case 'tool': return tags(s.tools)
    case 'test': return html`<span class="gw-badge gw-badge--dot gw-badge--${OUTCOME[s.outcome] ?? 'neutral'}">${ui(`outcome.${s.outcome}`)}</span>${tags(s.commands)}`
    case 'commit': return s.commit === true ? nothing : html`<span class="gw-tag agents-hash">${s.commit}</span>`
    case 'skill': return tags([s.skill])
    case 'agent': return html`<span class="agents-name">${s.description ?? ''}</span>`
    case 'waiting': return tags([s.notification])
    default: return nothing
  }
}

function step(s) {
  return html`<li class="agents-step" data-kind=${s.kind} data-outcome=${s.outcome ?? nothing}>
    <time class="agents-step__time" datetime=${s.start}>${clock(s.start)}</time>
    <span class="agents-step__label">${ui(`step.${s.kind}`)}</span>
    <span class="agents-step__what">${what(s)}</span>
    ${s.count > 1 ? html`<span class="agents-step__count">${ui('calls', { count: s.count })}</span>` : nothing}
    ${s.failed && s.kind !== 'test' ? html`<span class="gw-badge gw-badge--bad">${ui('failed-calls', { count: s.failed })}</span>` : nothing}
  </li>`
}

function report(detail, state) {
  const body = detail.report
    ? html`<div class="agents-report__body">${unsafeHTML(marked.parse(detail.report))}</div>`
    : html`<p class="agents-none">${ui(state === 'running' ? 'report.pending' : 'report.none')}</p>`
  return html`<section class="agents-report"><h3 class="agents-detail__title">${ui('report.title')}</h3>${body}</section>`
}

export function agentDetail({ detail, error }, { agent, state }) {
  if (error) return html`<div class="agents-detail"><p class="agents-none">${ui('timeline.error')}</p></div>`
  if (!detail) return html`<div class="agents-detail" aria-busy="true"></div>`
  return html`<div class="agents-detail">
    <section>
      <h3 class="agents-detail__title">${ui('timeline.title')}</h3>
      ${detail.steps.length
        ? html`<ol class="agents-steps">${detail.steps.map(step)}</ol>`
        : html`<p class="agents-none">${ui('timeline.empty')}</p>`}
    </section>
    ${agent ? report(detail, state) : nothing}
  </div>`
}
