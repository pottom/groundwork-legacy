// The drawer: a document or a ticket opened from any view, its facts above its text. The text is
// the one place the page shows HTML made from the project's files: renderMarkdown escapes every
// piece of source text (markdown.mjs), and only its output goes through unsafeHTML.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { unsafeHTML } from '/vendor/lit-html/directives/unsafe-html.js';
import { reader } from '../config.mjs';
import { ui, dateText } from '../text.mjs';
import { app, actions } from '../state.mjs';
import { renderMarkdown } from '../markdown.mjs';
import { icon, chip, badge, docLink, ticketLinks, blockerLinks, prdLinks, meter, flags } from '../parts.mjs';

const { fold, plainInline } = reader;

// The text without its first heading when that only repeats the title shown above it.
function withoutTitle(text, title) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^#\s+/.test(l));
  if (at < 0 || lines.slice(0, at).some((l) => l.trim())) return text;
  const h1 = plainInline(lines[at].replace(/^#\s+/, ''));
  return fold(h1).includes(fold(title)) ? lines.slice(at + 1).join('\n') : text;
}

const row = (k, v, has = v) => (has ? html`<dt>${k}</dt><dd>${v}</dd>` : nothing);

function ticketMeta(t) {
  const area = app.model.areas.get(t.area);
  const tag = (text) => html`<span class="gw-tag">${text}</span>`;
  return html`<dl class="meta">
${row(ui('table.area'), [t.area, area && area.spec ? [' · ', badge('neutral', ui('area.spec')), ' ', docLink(area.spec.path, area.spec.title)] : nothing], t.area || (area && area.spec))}
${row(ui('drawer.note'), t.statusNote)}
${row(ui('drawer.prd'), t.prd.length ? prdLinks(t) : html`<span class="muted">${ui('drawer.prd-none')}</span>`, t.prd.length || t.prdNone)}
${row(ui('table.checks'), meter(t.checks), t.checks.total)}
${row(ui('table.blocked-by'), [blockerLinks(t), t.notes.length ? html` <span class="muted">${t.notes.join('; ')}</span>` : nothing], t.blockers.length || t.notes.length)}
${row(ui('drawer.unlocks'), ticketLinks(t.dependents), t.dependents.length)}
${row(ui('drawer.earlier'), t.earlier)}${row(ui('drawer.type'), t.type)}
${row(ui('table.last-comment'), [dateText(t.lastComment), ' · ', ui('drawer.comments', { n: t.comments.filter((c) => !c.event).length })], t.lastComment)}
${row(ui('drawer.labels'), (t.labels || []).map((l, i) => [i ? ' ' : '', tag(l)]), (t.labels || []).length)}
${t.source === 'github' ? row(ui('drawer.github'), html`<a href=${t.url} target="_blank" rel="noopener noreferrer" class="gw-tag">${t.path} ↗</a>`) : row(ui('docs.file'), tag(t.path))}</dl>`;
}

const KINDS = { adr: 'docs.adr', spec: 'area.spec', readme: 'docs.readme', glossary: 'docs.glossary' };

export function drawerView(doc) {
  const ticket = doc.kind === 'ticket';
  const kicker = ticket
    ? [html`<span class="gw-tag">${doc.label}</span>`, chip(doc.status), flags(doc)]
    : [badge('neutral', ui(KINDS[doc.kind] || 'area.doc')), doc.area ? html`<span class="muted">${doc.area}</span>` : nothing];
  const meta = ticket
    ? ticketMeta(doc)
    : html`<dl class="meta"><dt>${ui('docs.file')}</dt><dd><span class="gw-tag">${doc.path}</span></dd>${doc.kind === 'adr' && doc.status ? html`<dt>${ui('docs.adr-status')}</dt><dd>${doc.status}</dd>` : nothing}</dl>`;
  return html`<header>
    <div><div class="kicker">${kicker}</div><h2 id="drawer-title">${doc.title}</h2></div>
    <button type="button" class="gw-btn gw-btn--icon" id="drawer-close" title=${ui('drawer.close-label')} aria-label=${ui('drawer.close-label')} @click=${actions.closeDrawer}>${icon('close')}</button>
  </header>
  <div class="scroll" id="drawer-body" tabindex="-1">${meta}<div class="md">${unsafeHTML(renderMarkdown(withoutTitle(doc.text, doc.title), { path: doc.path, model: app.model }))}</div></div>`;
}
