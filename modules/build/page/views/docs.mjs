// The checks view (what the ticket reader found inconsistent) and the documents view (the
// project's own documents, the specs, the decision records and the rest).

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { reader, PROBLEM_KINDS } from '../config.mjs';
import { ui, tx } from '../text.mjs';
import { state, app } from '../state.mjs';
import { chip, badge, count, dash, sectionHead, empty, docLink, ticketLink, table } from '../parts.mjs';

const { fold, isClosed } = reader;

const heads = (...titles) => titles.map((t) => html`<th>${t}</th>`);

export function checksView() {
  const q = fold(state.q.trim());
  const list = app.model.problems.filter((p) => p.tickets.some((t) => (!state.area || t.area === state.area) && (!q || t.hay.includes(q))));
  const sections = PROBLEM_KINDS.map(([kind, title, info]) => {
    const items = list.filter((p) => p.kind === kind);
    if (!items.length) return null;
    const openOnes = items.filter((p) => p.tickets.some((t) => !isClosed(t))).length;
    const row = (p) => html`<tr><td class="c-title">${p.tickets.map((t) => html`${ticketLink(t)} ${docLink(t.path, t.title, 'open')}<div class="note">${t.path}</div>`)}</td><td class="c-st">${p.tickets.map((t, i) => [i ? html`<br>` : nothing, chip(t.status)])}</td><td>${ui(p.key, p.params)}</td></tr>`;
    return html`<section class="group${info ? ' info' : ''}">${sectionHead(ui(title), [count(items.length), info ? badge('info', ui('checks.info')) : nothing], ui('checks.affects', { n: openOnes }))}${table(html`<th>${ui('table.ticket')}</th><th class="c-st">${ui('table.status')}</th><th>${ui('checks.problem')}</th>`, items.map(row))}</section>`;
  }).filter(Boolean);
  return html`<p class="lead">${ui('checks.lead')}</p>${sections.length ? sections : empty('check', ui('checks.empty'), '')}`;
}

// Only the kinds of document the project has; one line at the end names the missing ones.
export function docsView() {
  const m = app.model;
  const q = fold(state.q.trim());
  const ok = (d) => (!state.area || d.area === state.area) && (!q || d.hay.includes(q));
  const link = (d) => docLink(d.path, d.title, 'open');
  const specs = m.docs.filter((d) => d.kind === 'spec' && ok(d));
  const other = m.docs.filter((d) => d.kind === 'doc' && ok(d));
  const adrs = state.area ? [] : m.adrs.filter((d) => !q || d.hay.includes(q));
  const row = (d) => html`<tr data-doc=${d.path}><td class="c-area">${d.area || '–'}</td><td class="c-title">${link(d)}<div class="note mono">${d.path}</div></td></tr>`;
  const own = state.area ? [] : [m.readme, ...m.glossaries].filter((d) => d && (!q || d.hay.includes(q)));
  const parts = [];
  if (own.length) parts.push(html`<section class="group">${sectionHead(ui('docs.own'), count(own.length), ui('docs.own.hint'))}${table(heads(ui('docs.title'), ui('docs.file')), own.map((d) => html`<tr data-doc=${d.path}><td class="c-title">${link(d)}</td><td>${badge('neutral', ui(d.kind === 'readme' ? 'docs.readme' : 'docs.glossary'))} <span class="mono muted">${d.path}</span></td></tr>`))}</section>`);
  if (specs.length) parts.push(html`<section class="group">${sectionHead(ui('docs.specs'), count(specs.length), '')}${table(heads(ui('table.area'), ui('docs.spec')), specs.map(row))}</section>`);
  if (adrs.length) parts.push(html`<section class="group">${sectionHead(ui('docs.adrs'), count(adrs.length), m.adrPath ? html`<span class="mono">${m.adrPath}/</span>` : '')}${table(heads(ui('table.num'), ui('docs.decision'), ui('docs.adr-status')), adrs.map((d) => html`<tr data-doc=${d.path}><td class="c-num">${d.num || '–'}</td><td class="c-title">${link(d)}</td><td>${d.status || dash}</td></tr>`))}</section>`);
  if (other.length) parts.push(html`<section class="group">${sectionHead(ui('docs.other'), count(other.length), ui('docs.other.hint'))}${table(heads(ui('table.area'), ui('docs.document')), other.map(row))}</section>`);
  if (q || state.area) return parts.length ? parts : empty('doc', ui('docs.empty'), '');
  const missing = [!specs.length && ui('docs.missing-specs'), !adrs.length && ui('docs.missing-adrs')].filter(Boolean);
  return [parts, missing.length ? empty('doc', ui(missing.length === 2 ? 'docs.none-both' : 'docs.none-one', { what: missing[0] }), tx('docs.none-text')) : nothing];
}
