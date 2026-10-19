// The page's words: the UI translation (createI18n from i18n.js, the copy of core/shell/i18n.mjs,
// with BUILD_STRINGS from ui-strings.js; both classic scripts loaded before the page's modules),
// and the texts made from the model: status names, dates, times.

import { html, nothing } from '/vendor/lit-html/lit-html.js';
import { unsafeHTML } from '/vendor/lit-html/directives/unsafe-html.js';
import { reader, HUMAN, TEST } from './config.mjs';

const { UNPARSED, DONE } = reader;

// English by default, Hungarian too; the choice is shared with the shell. createI18n, LANGS and
// BUILD_STRINGS are globals of those classic scripts (a top-level const is no property of window).
export const i18n = createI18n(BUILD_STRINGS);
const languages = LANGS;
export { languages as LANGS };
export const ui = i18n.t;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A translated text for a template. A few texts hold markup (<code>): those are our own strings
// (ui-strings.js), their placeholders take plain text only, escaped. In the others a placeholder
// may also take a template (a ticket link, a <b>), which lit renders where the {name} stood.
export function tx(key, params) {
  const raw = ui(key);
  if (/[<&]/.test(raw)) {
    const vars = {};
    for (const [k, v] of Object.entries(params || {})) vars[k] = esc(v);
    return unsafeHTML(ui(key, vars));
  }
  if (!params) return raw;
  const values = [];
  const marks = {};
  for (const [k, v] of Object.entries(params)) marks[k] = '\u0001' + (values.push(v) - 1) + '\u0002';
  const pieces = ui(key, marks).split(/\u0001(\d+)\u0002/);
  return pieces.length === 1 ? pieces[0] : html`${pieces.map((p, i) => (i % 2 ? values[+p] : p || nothing))}`;
}

export const clock = (d) => d.toLocaleTimeString(i18n.lang, { hour: '2-digit', minute: '2-digit' });
export const dateText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString(i18n.lang, { month: 'short', day: 'numeric' });
};
export const fullTime = (sec) => new Date(sec * 1000).toLocaleString(i18n.lang);
export const relTime = (sec) => {
  const d = Date.now() / 1000 - sec;
  if (d < 90) return ui('git.now');
  if (d < 3600) return ui('git.minutes', { n: Math.round(d / 60) });
  if (d < 86400) return ui('git.hours', { n: Math.round(d / 3600) });
  if (d < 86400 * 45) return ui('git.days', { n: Math.round(d / 86400) });
  return new Date(sec * 1000).toLocaleDateString(i18n.lang);
};

// A status in the UI: its translated name and a tone; the label itself stays in the title.
export function statusTone(status) {
  if (status === UNPARSED) return 'bad';
  if (status === 'ready-for-agent') return 'accent';
  if (HUMAN.has(status)) return 'warn';
  if (TEST.test(status)) return 'violet';
  if (status === 'claimed') return 'info';
  if (DONE.has(status)) return 'ok';
  return 'neutral';
}
const STATUS_NAMES = {
  'ready-for-agent': 'status.ready-for-agent', 'ready-for-human': 'status.ready-for-human', 'needs-info': 'status.needs-info',
  'needs-triage': 'status.needs-triage', claimed: 'status.claimed', done: 'status.done', resolved: 'status.resolved',
  closed: 'status.closed', wontfix: 'status.wontfix', legacy: 'status.legacy', open: 'status.open',
};
export function statusName(status) {
  if (status === UNPARSED) return ui('status.unparsed');
  const test = TEST.exec(status);
  if (test) return ui('status.needs-test', { what: test[1].replace(/-/g, ' ') });
  return Object.prototype.hasOwnProperty.call(STATUS_NAMES, status) ? ui(STATUS_NAMES[status]) : status;
}
export const statusTitle = (status) => (status === UNPARSED ? '' : ui('status.label', { label: status }));

// A dated entry of a ticket: a heading of its own, or a GitHub issue's opening or closing.
export const commentTitle = (c) => (c.event ? ui(c.event === 'closed' ? 'activity.closed' : 'activity.opened') : c.title || ui('activity.untitled'));
