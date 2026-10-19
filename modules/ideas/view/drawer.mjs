// The drawer: one idea opened from the board, every field editable (d-ideas-edit). The page keeps
// what is typed in a draft, so a live re-read of the board does not wipe it; Save sends the draft
// on the version the drawer opened (api.mjs), and a newer save made elsewhere is reported, not lost.
// Rejected needs a reason (f-ideas-reject). Number, author and date are facts, shown, not edited.
//
//   drawer(draft, act)   the dialog's content; null draft -> nothing
//     draft  { idea: as listed, values: { title, body, source, kind, impact, effort, rationale, status, reason,
//              links: 'a, b' }, saving, error }
//     act    { edit(name, value), save(), close() }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { STATUSES, KINDS, LEVELS } from '../fields.mjs'
import { ui } from './strings.mjs'

const CLOSE = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`

// The draft as the changes the server takes: links typed as "a, b" become a list.
export const changesOf = (values) => ({ ...values, links: values.links.split(',').map((l) => l.trim()).filter(Boolean) })
export const valuesOf = (idea) => ({
  title: idea.title ?? '', body: idea.body ?? '', source: idea.source ?? '', kind: idea.kind ?? '',
  impact: idea.impact ?? '', effort: idea.effort ?? '', rationale: idea.rationale ?? '', status: idea.status, reason: idea.reason ?? '',
  links: (idea.links ?? []).join(', '),
})

const on = (act, name) => (e) => act.edit(name, e.target.value)

const options = (list, value, label, none) => html`
  ${none ? html`<option value="" ?selected=${!value}>${none}</option>` : nothing}
  ${list.map((v) => html`<option value=${v} ?selected=${v === value}>${ui(`${label}.${v}`)}</option>`)}`

const field = (name, label, control, hint) => html`
  <label class="form__field" for=${`f-${name}`}><span class="form__label">${label}</span>${control}${hint ? html`<span class="form__hint">${hint}</span>` : nothing}</label>`

export function drawer(draft, act) {
  if (!draft) return nothing
  const { idea, values: v } = draft
  const rejected = v.status === 'rejected'
  return html`<form class="drawer" method="dialog" @submit=${(e) => { e.preventDefault(); act.save() }}>
    <header class="drawer__head">
      <div class="drawer__kicker">
        <span class="gw-tag">${idea.id}</span>
        ${idea.author ? html`<span class="gw-badge">${ui(`author.${idea.author}`)}</span>` : nothing}
        ${idea.created ? html`<span class="drawer__muted">${idea.created}</span>` : nothing}
      </div>
      <h2 id="drawer-title" class="drawer__title">${ui('drawer.title', { id: idea.id })}</h2>
      <button type="button" class="gw-btn gw-btn--icon gw-btn--ghost" title=${ui('drawer.close')} aria-label=${ui('drawer.close')} @click=${act.close}>${CLOSE}</button>
    </header>
    <div class="drawer__body">
      ${field('title', ui('field.title'), html`<input class="gw-field" id="f-title" name="title" required .value=${v.title} @input=${on(act, 'title')}>`)}
      ${field('body', ui('field.body'), html`<textarea class="gw-field" id="f-body" name="body" rows="7" .value=${v.body} @input=${on(act, 'body')}></textarea>`)}
      <div class="form__row">
        ${field('status', ui('field.status'), html`<select class="gw-field" id="f-status" name="status" @change=${on(act, 'status')}>${options(STATUSES, v.status, 'status')}</select>`)}
        ${field('kind', ui('field.kind'), html`<select class="gw-field" id="f-kind" name="kind" @change=${on(act, 'kind')}>${options(KINDS, v.kind, 'kind', v.kind ? null : ui('level.none'))}</select>`)}
      </div>
      ${rejected ? field('reason', ui('field.reason'), html`<textarea class="gw-field" id="f-reason" name="reason" rows="3" required .value=${v.reason} @input=${on(act, 'reason')}></textarea>`, ui('field.reason-hint')) : nothing}
      <div class="form__row">
        ${field('impact', ui('field.impact'), html`<select class="gw-field" id="f-impact" name="impact" @change=${on(act, 'impact')}>${options(LEVELS, v.impact, 'level', ui('level.none'))}</select>`)}
        ${field('effort', ui('field.effort'), html`<select class="gw-field" id="f-effort" name="effort" @change=${on(act, 'effort')}>${options(LEVELS, v.effort, 'level', ui('level.none'))}</select>`)}
      </div>
      ${field('rationale', ui('field.rationale'), html`<input class="gw-field" id="f-rationale" name="rationale" .value=${v.rationale} @input=${on(act, 'rationale')}>`)}
      ${field('source', ui('field.source'), html`<input class="gw-field" id="f-source" name="source" .value=${v.source} @input=${on(act, 'source')}>`)}
      ${field('links', ui('field.links'), html`<input class="gw-field" id="f-links" name="links" .value=${v.links} @input=${on(act, 'links')}>`, ui('field.links-hint'))}
      ${draft.error ? html`<div class="gw-callout gw-callout--bad" role="alert"><div class="gw-callout__body">${draft.error}</div></div>` : nothing}
    </div>
    <footer class="drawer__foot">
      <button type="button" class="gw-btn" @click=${act.close}>${ui('drawer.cancel')}</button>
      <button type="submit" class="gw-btn gw-btn--primary" ?disabled=${draft.saving}>${ui('drawer.save')}</button>
    </footer>
  </form>`
}
