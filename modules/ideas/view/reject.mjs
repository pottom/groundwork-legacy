// The question a move to Rejected asks, by drag and drop or by the move menu: why? The reason is
// required (f-ideas-reject); it is saved with the idea and shown on its card. Optionally the idea
// also goes to Plan's map as a non-goal, with the reason, so the PRD lists it.
//
//   rejectForm(ask, act)   the dialog's content; null ask -> nothing
//     ask  { idea, reason, toMap, error }
//     act  { edit(reason), toMap(on), confirm(), cancel() }
//   toMapCheck(on, act)    the "add to the map as a non-goal" checkbox; the drawer offers it too,
//                          when its status is set to Rejected (act.toMap(on))

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { ui } from './strings.mjs'

export const toMapCheck = (on, act) => html`<label class="reject__check"><input type="checkbox" name="to-map" .checked=${on} @change=${(e) => act.toMap(e.target.checked)}> ${ui('reject.to-map')}</label>`

export function rejectForm(ask, act) {
  if (!ask) return nothing
  return html`<form class="reject" method="dialog" @submit=${(e) => { e.preventDefault(); act.confirm() }}>
    <h2 id="reject-title" class="reject__title">${ui('reject.title', { id: ask.idea.id })}</h2>
    <p class="reject__idea">${ask.idea.title}</p>
    <label class="form__field" for="reject-reason">
      <span class="form__label">${ui('field.reason')}</span>
      <textarea class="gw-field" id="reject-reason" name="reason" rows="4" required autofocus .value=${ask.reason} @input=${(e) => act.edit(e.target.value)}></textarea>
      <span class="form__hint">${ui('field.reason-hint')}</span>
    </label>
    ${toMapCheck(ask.toMap, act)}
    ${ask.error ? html`<div class="gw-callout gw-callout--bad" role="alert"><div class="gw-callout__body">${ask.error}</div></div>` : nothing}
    <footer class="reject__foot">
      <button type="button" class="gw-btn" @click=${act.cancel}>${ui('drawer.cancel')}</button>
      <button type="submit" class="gw-btn gw-btn--danger" ?disabled=${!ask.reason.trim()}>${ui('reject.confirm')}</button>
    </footer>
  </form>`
}
