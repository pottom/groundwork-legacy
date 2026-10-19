// What the page holds: the view and the filters (`state`), what it read (`app`), and which tickets
// the filters let through. Nothing here renders or reads; the views read it, refresh.mjs and the
// page's events (main.mjs) change it.

import { reader, FILTERS, GIT_PAGE, FRESH_MS } from './config.mjs';

const { prdFilter, ticketFilter, fold, isClosed } = reader;

// The view and the filters. prd: only the tickets naming this PRD item (Plan's link
// "/?module=build&prd=<id>"), closed ones too. ticket: the ticket a link asks to open (a sketch's
// link, "/?module=build&ticket=#34"), opened in the drawer once the tickets are read. The filters are not kept across reloads: a
// forgotten filter would contradict the overview.
export const state = {
  view: 'waiting', doc: null, q: '', status: '', area: '', prd: '', ticket: '', showClosed: false,
  activityDays: 14, githubEvents: null, filtersOpen: false,
};
try { state.prd = prdFilter(location.search); state.ticket = ticketFilter(location.search); } catch (e) { /* no query */ }

export const NO_GIT = () => ({ data: null, error: '', limit: GIT_PAGE, open: new Set(), hit: '' });
export const NO_ISSUES = () => ({ fingerprint: '', repo: null, issues: [], byNumber: new Map() });

// What was read, and how the reading goes.
export const app = {
  source: null,        // the server's project (server.mjs): { adapter, root, name, roots, server, launcher, version, git, github, reload }
  cache: new Map(),    // path → { size, mtime, text }
  model: null,         // what the ticket reader made of it
  listing: null,       // the last scan of the files
  changeLog: [],       // newest first: { at, items: [{ path, label, text }] }
  recent: new Map(),   // path → time of the last change seen in this session
  lastChecked: null,
  serverDown: false,
  liveState: '',       // the live stream's state when the page runs without the shell
  git: NO_GIT(),       // the git history from the server: { data, error, limit, open: Set of hashes, hit }
  issues: NO_ISSUES(), // the GitHub issues the server sent: the source of the GitHub tickets
  map: { key: '', ids: null },   // the ids of Plan's map
  openDetails: new Set(),        // the <details> the user opened (areas, the change log)
  lastOpener: null,              // the document whose link opened the drawer, to focus it again
  startError: '',
};

// What the views and the page's controls do; main.mjs fills it in (it needs the refresh, which
// needs the views: set late, so no module imports in a circle).
export const actions = {};

// Is filter f (q, status, area, closed) in force on the current view?
export const applies = (f) => (FILTERS[state.view] || []).includes(f);

export function matches(t, ignoreClosed) {
  if (state.prd && !t.prd.includes(state.prd)) return false;
  if (state.area && t.area !== state.area) return false;
  if (state.status && applies('status') && t.status !== state.status) return false;
  if (state.q && !t.hay.includes(fold(state.q.trim()))) return false;
  if (!ignoreClosed && !state.showClosed && !state.status && !state.prd && isClosed(t)) return false;
  return true;
}
export const visibleTickets = () => app.model.tickets.filter((t) => matches(t, false));

export const docHref = (path) => '#/' + state.view + '/' + encodeURIComponent(path);
export const isFresh = (path) => app.recent.has(path) && Date.now() - app.recent.get(path) < FRESH_MS;
// Every blocker it names is closed: the ticket is free to start.
export const isFree = (t) => !isClosed(t) && !t.blocked && t.blockers.length > 0 && t.blockers.every((b) => b.ticket);
