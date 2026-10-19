// The small pieces every view is made of, as lit-html templates on the shared .gw-* components
// (core/shell/theme.css): icons, status badges, counts, section heads, empty states, ticket links.

import { html, svg, nothing } from '/vendor/lit-html/lit-html.js';
import { reader } from './config.mjs';
import { ui, statusName, statusTitle, statusTone } from './text.mjs';
import { app, docHref, isFree } from './state.mjs';

const { isClosed, planLink } = reader;

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const ICONS = {
  refresh: svg`<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>`,
  x: svg`<path d="M7 7l10 10M17 7L7 17"/>`,
  close: svg`<path d="M6 6l12 12M18 6L6 18"/>`,
  check: svg`<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  doc: svg`<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>`,
  inbox: svg`<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>`,
  branch: svg`<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="8" r="2"/><path d="M7 8v8M17 10c0 4-10 2-10 6"/>`,
  search: svg`<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>`,
  filter: svg`<path d="M4 6h16M7 12h10M10 18h4"/>`,
};
export const icon = (name) => html`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

export const chip = (status) => html`<span class="gw-badge gw-badge--dot gw-badge--${statusTone(status)}" title=${statusTitle(status)}>${statusName(status)}</span>`;
export const badge = (tone, text, title) => html`<span class="gw-badge gw-badge--${tone}" title=${title || nothing}>${text}</span>`;
export const count = (n) => html`<span class="gw-badge gw-badge--count">${n}</span>`;
export const dash = html`<span class="dash">–</span>`;
export const sectionHead = (title, extra, hint) => html`<div class="gw-section-head"><h2 class="gw-section-head__title">${title}</h2>${extra || nothing}${hint ? html`<span class="gw-section-head__hint">${hint}</span>` : nothing}</div>`;
export const empty = (iconName, title, text) => html`<div class="gw-empty"><span class="gw-empty__icon">${icon(iconName)}</span><p class="gw-empty__title">${title}</p>${text ? html`<p class="gw-empty__text">${text}</p>` : nothing}</div>`;
// A link that opens a document in the drawer.
export const docLink = (path, content, cls) => html`<a class=${cls || nothing} href=${docHref(path)} data-doc=${path}>${content}</a>`;

export const ticketLink = (t, text) => html`<a class="gw-tag tref${isClosed(t) ? ' is-closed' : ''}" href=${docHref(t.path)} data-doc=${t.path} title=${t.title + ' · ' + statusName(t.status)}>${text || t.label}</a>`;
export const blockerLinks = (t) => t.blockers.map((b, i) => [i ? ' ' : '', b.ticket ? ticketLink(b.ticket) : html`<span class="gw-tag tref is-missing" title=${ui('table.no-such-ticket')}>${b.raw}?</span>`]);
export const ticketLinks = (list) => list.map((t, i) => [i ? ' ' : '', ticketLink(t)]);

// The PRD items a ticket came from (its "**PRD:**" line): each opens Plan focused on that map node
// (Plan's deep link, planLink in ticket-reader.mjs, in the whole window). Without Plan's map (no
// Plan module, or no map yet) there is nothing to open: the ids show as plain tags.
export const prdLinks = (t) => t.prd.map((id, i) => [i ? ' ' : '', app.map.ids
  ? html`<a class="gw-tag" href=${planLink(id)} target="_top" title=${ui('prd.open', { id })}>${id}</a>`
  : html`<span class="gw-tag">${id}</span>`]);

export const progress = (value, title) => html`<span class="gw-progress" style="--value:${value}%" title=${title || nothing}></span>`;
export const meter = (c) => (c.total
  ? html`<span class="meter" title=${ui('table.meter', { done: c.done, total: c.total })}>${progress(pct(c.done, c.total))}${c.done}/${c.total}</span>`
  : dash);

// Blocked by an open ticket, or freed: every blocker it names is closed.
export const flags = (t) => (t.blocked ? [' ', badge('bad', ui('flag.blocked'))] : isFree(t) ? [' ', badge('ok', ui('flag.free'), ui('flag.free-title'))] : nothing);

// A grid table on a card.
export const table = (head, rows, cls = '') => html`<div class="gw-card tablewrap"><table class=${'grid' + (cls ? ' ' + cls : '')}><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;

