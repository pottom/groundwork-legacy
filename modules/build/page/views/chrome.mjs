// The page around the views: its own bar (only opened alone: inside the shell the shell's header
// shows the project, the live state and the version), the start screen (no server: choose a
// folder), and the tabs with the filters of the current view.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { live } from '/vendor/lit-html/directives/live.js';
import { reader, VIEWS, FILTERS, INFO_KINDS, POLL_MS } from '../config.mjs';
import { i18n, ui, tx, LANGS, clock, statusName } from '../text.mjs';
import { state, app, actions, applies, matches, visibleTickets } from '../state.mjs';
import { icon, count } from '../parts.mjs';

const { CLOSED } = reader;

// ---- The page's own bar ----

function liveState() {
  const s = app.source;
  if (app.serverDown || (s.server && app.liveState === 'off')) return ['warn', ui('live.down-short')];
  if (app.lostAccess) return ['warn', ui('live.lost-short')];
  if (s.server) return [app.liveState === 'on' ? 'ok' : 'neutral', ui(app.liveState === 'on' ? 'live.on' : 'live.connecting')];
  if (s.live) return ['ok', ui('live.polling', { sec: POLL_MS / 1000 })];
  return ['neutral', ui('live.snapshot')];
}

export function topView() {
  const m = app.model, s = app.source;
  const name = m ? m.projectName || ui('page.project') : '';
  const [tone, text] = s ? liveState() : ['neutral', ''];
  const version = s && s.server ? s.version : '';
  return html`<div class="bar">
  <h1 class="brand" id="project">${name ? html`<span>${name}</span><small>${ui('page.subtitle')}</small>` : html`<span>${ui('page.title')}</span>`}</h1>
  <span class="live-state" ?hidden=${!s}><span class="gw-dot gw-dot--${tone}${tone === 'ok' ? ' gw-dot--pulse' : ''}"></span><span aria-live="polite">${text} <span class="when">· ${ui('live.read', { at: app.lastChecked ? clock(app.lastChecked) : '–' })}</span></span></span>
  <button type="button" class="gw-btn gw-btn--sm" ?hidden=${!s || !!s.server} @click=${actions.otherFolder}>${ui('live.change')}</button>
  <span class="gw-tag" ?hidden=${!version} title=${version ? `Groundwork ${version}` : ''}>${version ? `v${version}` : ''}</span>
  <select id="lang" class="gw-lang gw-field" aria-label=${ui('page.lang')} @change=${(e) => i18n.set(e.target.value)}>${Object.entries(LANGS).map(([code, label]) => html`<option value=${code} .selected=${live(code === i18n.lang)}>${label}</option>`)}</select>
</div>`;
}

// ---- The start screen ----

export function startView(canPick) {
  const resume = app.resumeName;
  return html`<div class="gw-card"><div class="gw-card__body">
  <h2>${ui('page.title')}</h2>
  <p>${ui('start.intro')}</p>
  <div ?hidden=${!resume}>
    <div class="choices"><button type="button" class="gw-btn gw-btn--primary" @click=${actions.resume}>${ui('start.resume', { name: resume })}</button></div>
    <p class="muted">${ui('start.resume-note')}</p>
  </div>
  <div class="choices">
    <button type="button" class="gw-btn${resume ? '' : ' gw-btn--primary'}" ?hidden=${!canPick} @click=${actions.pickFolder}>${ui(resume ? 'start.pick-other' : 'start.pick')}</button>
    <button type="button" class="gw-btn" @click=${actions.chooseSnapshot}>${ui('start.snapshot')}</button>
    <input type="file" id="dir-input" webkitdirectory multiple hidden @change=${actions.snapshotChosen}>
  </div>
  <p class="muted">${canPick ? ui('start.mode-live', { sec: POLL_MS / 1000 }) : ui('start.mode-snapshot')}</p>
  <div class="gw-callout gw-callout--bad" ?hidden=${!app.startError}>${app.startError}</div>
  <div class="drop">${ui('start.drop')}</div>
  <div class="rules"><p>${tx('start.rules')}</p></div>
</div></div>`;
}

// ---- Tabs and filters ----

function tabs() {
  const m = app.model;
  const real = m.problems.filter((p) => !INFO_KINDS.has(p.kind)).length;
  const branches = app.git.data ? app.git.data.refs.filter((r) => r.kind !== 'tag').length : 0;
  return html`<nav class="gw-tabs" id="tabs" aria-label=${ui('page.views')}>${VIEWS.map(([id, label]) => {
    let b = nothing;
    if (id === 'waiting') b = count(m.open.length);
    if (id === 'git' && app.git.data) b = count(branches);
    if (id === 'checks' && real) b = html`<span class="gw-badge gw-badge--warn" title=${ui('checks.real', { n: real })}>${real}</span>`;
    else if (id === 'checks' && m.problems.length) b = count(m.problems.length);
    return html`<a href="#/${id}" aria-current=${state.view === id ? 'page' : nothing}>${ui(label)}${b}</a>`;
  })}</nav>`;
}

// A filter in force, with its ✕ (.gw-pill).
const pill = (label, value, clear) => html`<span class="gw-pill">${label} <b>${value}</b><button type="button" title=${ui('filter.remove')} aria-label=${ui('filter.remove-label', { what: label })} @click=${clear}>${icon('x')}</button></span>`;

function pills() {
  const out = [];
  if (state.prd) out.push(pill(ui('filter.prd'), state.prd, () => actions.clearFilter('prd')));
  if (state.q.trim() && applies('q')) out.push(pill(ui('filter.search-pill'), '“' + state.q.trim() + '”', () => actions.clearFilter('q')));
  if (state.status && applies('status')) out.push(pill(ui('filter.status'), statusName(state.status), () => actions.clearFilter('status')));
  if (state.area && applies('area')) out.push(pill(ui('filter.area'), state.area, () => actions.clearFilter('area')));
  if (state.showClosed && applies('closed')) out.push(pill(ui('filter.closed-pill'), ui('filter.shown-yes'), () => actions.clearFilter('closed')));
  return out;
}

// How many tickets the filters show, and how many closed ones they hide.
function shownSummary() {
  if (!applies('closed')) return nothing;
  const shown = visibleTickets().length;
  const hidden = app.model.tickets.filter((t) => matches(t, true)).length - shown;
  return [ui('filter.shown', { n: shown }), hidden ? html` · ${ui('filter.hidden', { n: hidden })} <button type="button" @click=${actions.showClosed}>${ui('filter.show')}</button>` : nothing];
}

export function navView() {
  const m = app.model;
  const statuses = [...m.statusCounts.keys()].sort((a, b) => CLOSED.has(a) - CLOSED.has(b) || statusName(a).localeCompare(statusName(b), i18n.lang));
  const areas = [...m.areas.values()].filter((a) => a.name).sort((a, b) => a.name.localeCompare(b.name));
  const fs = FILTERS[state.view] || [];
  const off = (f) => !fs.includes(f) || (f === 'area' && !areas.length);
  const active = pills();
  const n = active.length - (state.prd ? 1 : 0) - (state.q.trim() && applies('q') ? 1 : 0);
  return html`${tabs()}
<div class="filters gw-toolbar${state.filtersOpen ? ' is-open' : ''}" id="filters" role="search" ?hidden=${!fs.length}>
  <div class="search" ?hidden=${off('q')}>
    ${icon('search')}
    <input type="search" class="gw-field" id="q" placeholder=${ui('filter.search')} aria-label=${ui('filter.search-label')} .value=${live(state.q)} @input=${actions.typed}>
  </div>
  <button type="button" class="gw-btn" id="f-toggle" aria-expanded=${String(state.filtersOpen)} aria-controls="f-more" ?hidden=${!fs.some((f) => f !== 'q')} @click=${actions.toggleFilters}>${icon('filter')}<span>${ui('filter.toggle')}</span><span class="gw-badge gw-badge--accent" ?hidden=${!n}>${n}</span></button>
  <div class="filter-more" id="f-more">
    <select class="gw-field" aria-label=${ui('filter.status')} ?hidden=${off('status')} @change=${(e) => actions.setFilter('status', e.target.value)}>
      <option value="" .selected=${live(!state.status)}>${ui('filter.all-statuses')}</option>
      ${statuses.map((s) => html`<option value=${s} .selected=${live(s === state.status)}>${statusName(s)} (${m.statusCounts.get(s)})</option>`)}
    </select>
    <select class="gw-field" aria-label=${ui('filter.area')} ?hidden=${off('area')} @change=${(e) => actions.setFilter('area', e.target.value)}>
      <option value="" .selected=${live(!state.area)}>${ui('filter.all-areas')}</option>
      ${areas.map((a) => html`<option value=${a.name} .selected=${live(a.name === state.area)}>${a.name} (${a.open}/${a.tickets.length})</option>`)}
    </select>
    <label class="check" ?hidden=${off('closed')}><input type="checkbox" .checked=${live(state.showClosed)} @change=${(e) => actions.setFilter('showClosed', e.target.checked)}> <span>${ui('filter.closed')}</span></label>
  </div>
  <span class="gw-toolbar__spacer"></span>
  <span class="f-summary" aria-live="polite">${shownSummary()}</span>
</div>
<div class="active" ?hidden=${!active.length}>${active.length ? [html`<span>${ui('filter.active')}</span>`, active, active.length > 1 ? html`<button type="button" class="link" @click=${() => actions.clearFilter('all')}>${ui('filter.clear')}</button>` : nothing] : nothing}</div>`;
}
