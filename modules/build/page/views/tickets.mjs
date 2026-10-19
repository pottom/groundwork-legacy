// The ticket views: "Waiting on" (the open tickets grouped by who they wait for) and "Areas" (each
// area with its spec, documents and tickets), both on the same ticket table.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { live } from '/vendor/lit-html/directives/live.js';
import { reader, GROUPS } from '../config.mjs';
import { ui, tx, statusName, dateText } from '../text.mjs';
import { state, app, matches, visibleTickets, isFresh } from '../state.mjs';
import { icon, chip, badge, count, dash, sectionHead, empty, docLink, blockerLinks, prdLinks, sketchLinks, meter, flags, progress, pct, table } from '../parts.mjs';

const { fold, isClosed, waitingOn } = reader;

function ticketRow(t) {
  const blockers = t.blockers.length ? blockerLinks(t) : null;
  return html`<tr data-doc=${t.path} class=${t.blocked ? 'is-blocked' : nothing}>
<td class="c-num">${t.label}</td>
<td class="c-title">${docLink(t.path, t.title, 'open')}${flags(t)}${isFresh(t.path) ? [' ', badge('info', ui('flag.fresh'))] : nothing}
${t.statusNote ? html`<div class="note" title=${t.statusNote}>${t.statusNote}</div>` : nothing}${t.prd.length ? html`<div class="refs-line"><span>${ui('table.prd-sub')}</span>${prdLinks(t)}</div>` : nothing}${t.sketches.length ? html`<div class="refs-line"><span>${ui('table.sketch-sub')}</span>${sketchLinks(t)}</div>` : nothing}<div class="sub">${chip(t.status)}${t.area ? html`<span>${t.area}</span>` : nothing}${blockers ? html`<span>${tx('table.blocked-by-sub', { list: blockers })}</span>` : nothing}</div></td>
<td class="c-area">${t.area || dash}</td>
<td class="c-st">${chip(t.status)}</td>
<td class="c-chk">${meter(t.checks)}</td>
<td class="c-blk">${blockers || dash}</td>
<td class="c-last">${t.lastComment ? dateText(t.lastComment) : dash}</td>
</tr>`;
}

export function ticketTable(list) {
  if (!list.length) return empty('inbox', ui('table.empty'), '');
  return table(
    html`<th class="c-num">${ui('table.num')}</th><th>${ui('table.ticket')}</th><th class="c-area">${ui('table.area')}</th><th class="c-st">${ui('table.status')}</th><th class="c-chk">${ui('table.checks')}</th><th class="c-blk">${ui('table.blocked-by')}</th><th class="c-last">${ui('table.last-comment')}</th>`,
    list.map(ticketRow),
  );
}

export function waitingView() {
  const list = visibleTickets();
  // A group with nothing in it is one quiet line; with a status filter on, only what it lets through shows.
  const section = (id, title, hint, items, always) => {
    if (!items.length && !(always && !state.status && !state.q.trim())) return nothing;
    if (!items.length) return html`<section class="group is-empty" id="group-${id}">${sectionHead(title, count(0), html`<span class="none-yet">${icon('check')}${ui('group.none')}</span>`)}</section>`;
    return html`<section class="group" id="group-${id}">${sectionHead(title, count(items.length), hint)}${ticketTable(items)}</section>`;
  };
  // Each open ticket in exactly one section, the one the overview counts it in (reader.waitingOn).
  const parts = GROUPS.map((g) => section(g.id, ui(g.title), ui(g.hint), list.filter((t) => waitingOn(t) === g.id), g.id === 'agent' || g.id === 'human'));
  const rest = list.filter((t) => waitingOn(t) === 'other');
  for (const s of [...new Set(rest.map((t) => t.status))].sort()) parts.push(section('s-' + s, statusName(s), ui('group.unknown.hint'), rest.filter((t) => t.status === s)));
  parts.push(section('unparsed', ui('group.unparsed'), ui('group.unparsed.hint'), list.filter((t) => waitingOn(t) === 'unparsed')));
  parts.push(section('closed', ui('group.closed'), ui('group.closed.hint'), list.filter(isClosed)));
  return parts.some((p) => p !== nothing) ? parts : empty('inbox', ui('table.empty'), ui('filter.nothing'));
}

function areaCard(a, anySpec, q) {
  const tickets = a.tickets.filter((t) => matches(t, false));
  if ((q || state.status) && !tickets.length && !(q && !state.status && fold(a.name + ' ' + (a.spec ? a.spec.title : '')).includes(q))) return nothing;
  const key = 'area:' + a.name;
  const specBadge = badge('neutral', ui('area.spec'));
  const doc = (b, d) => html`<li>${b}${docLink(d.path, d.title)}<span class="path">${d.rel}</span></li>`;
  const docs = a.docs.map((d) => doc(badge('neutral', d.rel.split('/').length > 1 ? d.rel.split('/')[0] : ui('area.doc')), d));
  return html`<details class="area gw-card${anySpec ? '' : ' no-specs'}" data-key=${key} ?open=${live(app.openDetails.has(key))}>
<summary><span class="area__name">${a.name || ui('area.root')}</span>
${anySpec ? html`<span class="area__spec">${a.spec ? [specBadge, a.spec.title] : html`<span class="muted">${ui('area.no-spec')}</span>`}</span>` : nothing}
${progress(pct(a.closed, a.tickets.length), ui('area.bar-title', { closed: a.closed, total: a.tickets.length }))}
<span class="area__cnt">${a.tickets.length ? tx('area.count', { open: html`<b>${a.open}</b>`, closed: a.closed }) : ui('area.no-tickets')}</span></summary>
<div class="inner">${a.spec || docs.length || a.extras ? html`<ul class="doclist">
${a.spec ? doc(specBadge, a.spec) : nothing}
${docs}${a.extras ? html`<li class="muted">${badge('neutral', ui('area.other'))}${ui('area.extras', { n: a.extras })}</li>` : nothing}</ul>` : html`<div style="height:12px"></div>`}
${a.tickets.length ? ticketTable(tickets) : nothing}${tickets.length < a.tickets.length ? html`<p class="muted">${ui('area.hidden', { n: a.tickets.length - tickets.length })}</p>` : nothing}</div></details>`;
}

export function areasView() {
  const q = fold(state.q.trim());
  const anySpec = app.model.areaList.some((a) => a.spec);
  const cards = app.model.areaList.filter((a) => !state.area || a.name === state.area).map((a) => areaCard(a, anySpec, q));
  return html`<p class="lead">${ui('area.lead')}</p>${cards.some((c) => c !== nothing) ? cards : empty('inbox', ui('area.empty'), '')}`;
}
