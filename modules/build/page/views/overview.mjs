// Above the views: the notices (what the page cannot do right now, and why) and, on the "Waiting
// on" view, the overview: four numbers and the progress under them, and the change log once
// something changed.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { live } from '/vendor/lit-html/directives/live.js';
import { reader, GROUPS } from '../config.mjs';
import { ui, tx, clock } from '../text.mjs';
import { app, actions, docHref } from '../state.mjs';
import { icon, pct } from '../parts.mjs';

const callout = (tone, body, action) => html`<div class="gw-callout gw-callout--${tone}" role="status"><div class="gw-callout__body">${body}</div>${action || nothing}</div>`;

// The refresh button's words: from the server or a live folder it reads again; a snapshot asks
// for the folder again.
export const refreshKey = () => (app.source && !app.source.live ? 'live.reread' : app.lostAccess ? 'live.renew' : 'live.refresh');

export function noticesView(inShell) {
  const out = [];
  const at = app.lastChecked ? clock(app.lastChecked) : '–';
  const source = app.source;
  if (app.serverDown && !inShell) out.push(callout('warn', ui('live.down', { at, launcher: source && source.launcher ? ' (' + source.launcher + ')' : '' })));
  if (app.lostAccess) out.push(callout('warn', ui('live.lost'), html`<button type="button" class="gw-btn gw-btn--sm" @click=${actions.readAgain}>${ui('live.renew')}</button>`));
  if (app.model.trackerPath == null && !app.model.repo) {
    const dir = reader.DEFAULT_TRACKER_DIR;
    out.push(callout('info', [tx('overview.no-tracker', { dir }), source && source.live ? nothing : [' ', tx('overview.no-tracker-snapshot', { dir })]]));
  }
  return out;
}

// One number of the strip; with a target it is a link that scrolls to that group.
function stat(tone, value, label, sub, good, target) {
  const cls = `gw-stat${value === 0 ? ' gw-stat--zero' : ''}${good ? ' gw-stat--good' : ''}`;
  const inner = html`<span class="gw-stat__label"><span class="gw-dot gw-dot--${tone}"></span>${label}</span><span class="gw-stat__value">${value}</span><span class="gw-stat__sub">${sub}</span>`;
  return target ? html`<a class=${cls} href="#/waiting" @click=${(e) => actions.jumpTo(e, target)}>${inner}</a>` : html`<div class=${cls}>${inner}</div>`;
}

function changes() {
  const m = app.model;
  const item = (it) => html`<li>${m.byPath.has(it.path) ? html`<a href=${docHref(it.path)} data-doc=${it.path}><b>${it.label}</b></a>` : html`<b>${it.label}</b>`}: ${it.text()}</li>`;
  const [latest, ...older] = app.changeLog;
  const summary = latest.items.slice(0, 3).map((it, i) => [i ? '; ' : '', html`<b>${it.label}</b> ${it.text()}`]);
  return html`<details class="changes" data-key="changes" ?open=${live(app.openDetails.has('changes'))}><summary><span class="gw-dot gw-dot--info"></span><span class="txt">${ui('overview.latest-change', { time: clock(latest.at) })} ${summary}${latest.items.length > 3 ? ui('overview.and-more', { n: latest.items.length - 3 }) : ''}</span></summary>
<ul>${latest.items.map(item)}</ul>${older.map((b) => html`<div class="older">${clock(b.at)}</div><ul>${b.items.map(item)}</ul>`)}</details>`;
}

export function overviewView() {
  const m = app.model;
  const total = m.tickets.length, open = m.open.length, done = total - open;
  const inGroup = (id) => m.open.filter((t) => GROUPS.find((g) => g.id === id).has(t.status));
  const agentAll = inGroup('agent');
  const agentFree = agentAll.filter((t) => !t.blocked).length;
  const human = inGroup('human').length;
  const blocked = m.open.filter((t) => t.blocked).length;
  const none = ui('kpi.none');
  const p = pct(done, total);
  const label = ui(refreshKey());
  const foot = html`<div class="summary__foot"><span class="gw-progress" style="--value:${p}%" role="img" aria-label=${ui('overview.bar-label', { open, done })}></span><span class="summary__pct">${total ? ui('overview.done', { p }) : '–'}<span>${ui('overview.closed', { done, total })}</span></span><button type="button" class="gw-btn gw-btn--icon gw-btn--sm" title=${label} aria-label=${label} @click=${actions.readAgain}>${icon('refresh')}</button></div>`;
  return html`<section class="gw-card summary" aria-label=${ui('overview.label')}><div class="stats">
${stat('neutral', open, ui('kpi.open'), ui('kpi.open-sub', { total }))}
${stat('accent', agentFree, ui('kpi.agent'), agentAll.length > agentFree ? ui('kpi.agent-sub-blocked', { n: agentAll.length - agentFree }) : agentFree ? ui('kpi.agent-sub') : '', false, agentFree ? 'group-agent' : '')}
${stat('warn', human, ui('kpi.human'), human ? ui('kpi.human-sub') : none, !human, human ? 'group-human' : '')}
${stat('bad', blocked, ui('kpi.blocked'), blocked ? ui('kpi.blocked-sub') : none, !blocked)}
</div>${total ? foot : nothing}</section>${app.changeLog.length ? changes() : nothing}`;
}
