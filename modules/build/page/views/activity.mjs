// The activity view: the dated comments of the tickets, by day. A GitHub issue's opening and
// closing are not comments: hidden unless asked for, and then one line per ticket and day
// ("Opened and closed on GitHub").

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { reader } from '../config.mjs';
import { ui, dateText, commentTitle } from '../text.mjs';
import { state, app, actions } from '../state.mjs';
import { chip, empty, docLink, ticketLink } from '../parts.mjs';

const { fold } = reader;

const notes = (list) => {
  const ev = list.filter((c) => c.event).map((c) => c.event);
  return [
    list.filter((c) => !c.event).map((c) => html`<div>${commentTitle(c)}</div>`),
    ev.length ? html`<div class="event">${ui(ev.includes('opened') && ev.includes('closed') ? 'activity.opened-closed' : ev.includes('closed') ? 'activity.closed' : 'activity.opened')}</div>` : nothing,
  ];
};

const day = ([date, byTicket]) => html`<section class="day"><div class="day__head"><h3>${dateText(date)}</h3><span>${ui('activity.tickets', { n: byTicket.size })}</span></div><ul class="gw-card">${[...byTicket.entries()].map(([t, list]) => html`<li><div class="node">${ticketLink(t)} ${docLink(t.path, t.title, 'ttl')} ${chip(t.status)}${t.area ? html` <span class="rel">${t.area}</span>` : nothing}</div><div class="notes">${notes(list)}</div></li>`)}</ul></section>`;

export function activityView() {
  const q = fold(state.q.trim());
  const ok = (t) => (!state.area || t.area === state.area) && (!q || t.hay.includes(q)) && (!state.prd || t.prd.includes(state.prd));
  const days = new Map();
  const mine = app.model.comments.filter((c) => ok(c.ticket));
  const events = mine.filter((c) => c.event).length;
  // Until asked, the events show only where there is nothing else to show.
  const showEvents = state.githubEvents == null ? events === mine.length : state.githubEvents;
  for (const c of mine) {
    if (c.event && !showEvents) continue;
    if (!days.has(c.date)) days.set(c.date, new Map());
    const byTicket = days.get(c.date);
    if (!byTicket.has(c.ticket)) byTicket.set(c.ticket, []);
    byTicket.get(c.ticket).push(c);
  }
  const all = [...days.entries()];
  const toggle = events ? html`<div class="view-actions"><button type="button" class="gw-btn gw-btn--sm" aria-pressed=${String(showEvents)} @click=${() => actions.showGithubEvents(!showEvents)}>${ui('activity.github-events', { n: events })}</button></div>` : nothing;
  return html`<p class="lead">${ui('activity.lead')}</p>${toggle}${all.length ? all.slice(0, state.activityDays).map(day) : empty('inbox', ui('activity.empty'), events && !showEvents ? ui('activity.empty-events', { n: events }) : '')}${all.length > state.activityDays ? html`<button type="button" class="gw-btn" @click=${actions.moreDays}>${ui('activity.more', { n: all.length - state.activityDays })}</button>` : nothing}`;
}
