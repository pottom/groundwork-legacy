// What the page holds: the view and the filters (`state`), what it read (`app`), and which tickets
// the filters let through. Nothing here renders or reads; the views read it, refresh.mjs and the
// page's events (main.mjs) change it.

import { reader, FILTERS, GIT_PAGE, FRESH_MS } from './config.mjs';

const { prdFilter, fold, isClosed } = reader;

const STORE_KEY = 'development-status:' + location.pathname;

// The view and the filters. prd: only the tickets naming this PRD item (Plan's link
// "/?module=build&prd=<id>"), closed ones too. The filters are not kept across reloads: a
// forgotten filter would contradict the overview.
export const state = {
  view: 'waiting', doc: null, q: '', status: '', area: '', prd: '', showClosed: false,
  activityDays: 14, githubEvents: null, filtersOpen: false,
};
try { state.prd = prdFilter(location.search); } catch (e) { /* no query */ }
try { localStorage.removeItem(STORE_KEY); } catch (e) { /* storage is optional */ }

export const NO_GIT = () => ({ data: null, error: '', limit: GIT_PAGE, open: new Set(), hit: '' });
export const NO_ISSUES = () => ({ fingerprint: '', repo: null, issues: [], byNumber: new Map() });

// What was read, and how the reading goes.
export const app = {
  source: null,        // { adapter, root, name, live, roots }; from the launcher's server also { server, launcher, version, git, github, reload }
  cache: new Map(),    // path → { size, mtime, text }
  model: null,         // what the ticket reader made of it
  listing: null,       // the last scan of the files
  changeLog: [],       // newest first: { at, items: [{ path, label, text }] }
  recent: new Map(),   // path → time of the last change seen in this session
  lastChecked: null,
  lostAccess: false,   // the browser stopped letting the page read the folder
  serverDown: false,
  liveState: '',       // the live stream's state when the page runs without the shell
  git: NO_GIT(),       // the git history from the server: { data, error, limit, open: Set of hashes, hit }
  issues: NO_ISSUES(), // the GitHub issues the server sent: the source of the GitHub tickets
  map: { key: '', ids: null },   // the ids of Plan's map
  openDetails: new Set(),        // the <details> the user opened (areas, the change log)
  lastOpener: null,              // the document whose link opened the drawer, to focus it again
  startError: '',
  resumeName: '',                // the remembered folder, offered on the start screen
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

// The folder handle survives a reload in IndexedDB (the permission does not).
function idb(mode, run) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('development-status', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('handles');
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('handles', mode);
          const req = run(tx.objectStore('handles'));
          tx.oncomplete = () => resolve(req ? req.result : null);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      };
    } catch (e) { resolve(null); }
  });
}
export const rememberHandle = (h) => idb('readwrite', (s) => s.put(h, STORE_KEY));
export const forgetHandle = () => idb('readwrite', (s) => s.delete(STORE_KEY));
export const recallHandle = () => idb('readonly', (s) => s.get(STORE_KEY));
