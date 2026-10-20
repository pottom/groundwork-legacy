// The question a move to Accepted asks, by drag and drop or the move menu: which route?
// Grilling (a change, interviewed first) or Straight to a ticket (d-route-choice); the idea's kind
// gives the default (routeFor: product -> Grilling, engineering -> Straight to a ticket), the human
// chooses. Accepting opens the change (POST /api/ideas/accept); a refusal (the ticket route is not
// built yet) is shown here, as the server words it.
//
//   acceptForm(ask, act)   the dialog's content; null ask -> nothing
//     ask  { idea, route, saving, error }
//     act  { route(route), confirm(), cancel() }

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { ROUTES } from '../fields.mjs'
import { ui } from './strings.mjs'

export function acceptForm(ask, act) {
  if (!ask) return nothing
  return html`<form class="reject" method="dialog" @submit=${(e) => { e.preventDefault(); act.confirm() }}>
    <h2 id="accept-title" class="reject__title">${ui('accept.title', { id: ask.idea.id })}</h2>
    <p class="reject__idea">${ask.idea.title}</p>
    <div class="form__field">
      <span class="form__label" id="accept-route">${ui('accept.route')}</span>
      <div class="gw-seg" role="group" aria-labelledby="accept-route">
        ${ROUTES.map((r) => html`<button type="button" aria-pressed=${ask.route === r ? 'true' : 'false'}
          @click=${() => act.route(r)}>${ui(`route.${r}`)}</button>`)}
      </div>
      <span class="form__hint">${ui(`route.${ask.route}.hint`)}</span>
    </div>
    ${ask.error ? html`<div class="gw-callout gw-callout--bad" role="alert"><div class="gw-callout__body">${ask.error}</div></div>` : nothing}
    <footer class="reject__foot">
      <button type="button" class="gw-btn" @click=${act.cancel}>${ui('drawer.cancel')}</button>
      <button type="submit" class="gw-btn gw-btn--primary" ?disabled=${ask.saving}>${ui('accept.confirm')}</button>
    </footer>
  </form>`
}
