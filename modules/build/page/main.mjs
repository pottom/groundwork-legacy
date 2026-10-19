// The Build page: what its controls do (the `actions` the views call), the address (#/<view>/<doc>),
// the keyboard, the language, and the boot. index.html loads this module from the core server;
// Build has no mode without it.

import { GIT_PAGE } from './config.mjs';
import { i18n, ui } from './text.mjs';
import { state, app, actions, applies, docHref } from './state.mjs';
import { findServer, serverSource } from './server.mjs';
import { refresh, refreshGit, start } from './refresh.mjs';
import { VIEW_RENDERERS, renderAll, renderView, renderNav, renderOverview, renderDrawer, renderTop, renderStart } from './render.mjs';
import { renderMarkdown } from './markdown.mjs';

const $ = (id) => document.getElementById(id);
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

// ---- The address: #/<view> and #/<view>/<path of the open document> ----

function readHash() {
  const m = /^#\/([a-z]+)(?:\/(.+))?$/.exec(location.hash);
  const view = m && VIEW_RENDERERS[m[1]] ? m[1] : 'waiting';
  let doc = null;
  if (m && m[2]) { try { doc = decodeURIComponent(m[2]); } catch (e) { doc = null; } }
  const viewChanged = view !== state.view;
  state.view = view;
  state.doc = doc;
  if (!app.model) return;
  if (viewChanged) { renderNav(true); renderOverview(); renderView(); window.scrollTo(0, 0); }
  renderDrawer();
}
window.addEventListener('hashchange', readHash);

// The PRD filter came in the address (?prd=): it goes from there too, so a reload shows everything.
function clearPrd() {
  state.prd = '';
  try {
    const url = new URL(location.href);
    url.searchParams.delete('prd');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch (e) { /* the filter is gone anyway */ }
}

let typing = null;

Object.assign(actions, {
  // Read everything again now, and say so also when nothing changed.
  readAgain() {
    if (app.source) refresh(undefined, { asked: true });
  },
  typed(e) {
    state.q = e.target.value;
    clearTimeout(typing);
    typing = setTimeout(renderView, 120);
  },
  setFilter(key, value) { state[key] = value; renderView(); },
  clearFilter(which) {
    if (which === 'all') { state.q = ''; state.status = ''; state.area = ''; state.showClosed = false; clearPrd(); }
    else if (which === 'prd') clearPrd();
    else if (which === 'closed') state.showClosed = false;
    else state[which] = '';
    renderView();
  },
  showClosed() { state.showClosed = true; renderView(); },
  toggleFilters() { state.filtersOpen = !state.filtersOpen; renderNav(false); },
  moreDays() { state.activityDays += 30; renderView(); },
  showGithubEvents(on) { state.githubEvents = on; renderView(); },
  moreCommits() {
    app.git.limit += GIT_PAGE;
    app.git.loadingMore = true;
    renderView();
    refreshGit().then(() => { app.git.loadingMore = false; renderNav(false); renderView(); });
  },
  // A number of the overview: scroll to its group.
  jumpTo(e, id) {
    const el = $(id);
    if (el) { e.preventDefault(); el.scrollIntoView({ block: 'start', behavior: smooth() }); }
  },
  // A branch of the table: show its commit in the graph.
  gitJump(hash) {
    app.git.hit = hash;
    renderView();
    const row = document.querySelector(`.graph .row[data-commit="${CSS.escape(hash)}"]`);
    if (row) row.scrollIntoView({ block: 'center', behavior: smooth() });
    else app.git.hit = '';
  },
  toggleCommit(hash) {
    if (String(window.getSelection())) return;
    if (app.git.open.has(hash)) app.git.open.delete(hash); else app.git.open.add(hash);
    renderView();
  },
  closeDrawer() {
    const back = app.lastOpener;
    location.hash = '#/' + state.view;
    requestAnimationFrame(() => {
      const el = back && [...document.querySelectorAll('#main a[data-doc]')].find((a) => a.dataset.doc === back);
      if (el) el.focus();
    });
  },
});

// ---- Clicks on links and rows, the keyboard ----

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-doc]');
  if (link) { if (!$('drawer').contains(link)) app.lastOpener = link.dataset.doc; return; }
  const row = e.target.closest('tr[data-doc]');
  if (row && !e.target.closest('a, button') && !String(window.getSelection())) {
    app.lastOpener = row.dataset.doc;
    location.hash = docHref(row.dataset.doc);
  }
});
document.addEventListener('toggle', (e) => {
  const key = e.target.dataset && e.target.dataset.key;
  if (key) { if (e.target.open) app.openDetails.add(key); else app.openDetails.delete(key); }
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('drawer').hidden) { e.preventDefault(); actions.closeDrawer(); return; }
  if (e.key === '/' && !$('app').hidden && $('drawer').hidden && applies('q') && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
});
$('shade').addEventListener('click', () => actions.closeDrawer());

// ---- Layout: the tabs stick right under the page's own bar (none inside the shell) ----
// Light or dark follows the operating system (the shell's theme); there is no switch here.

const topHeight = () => document.documentElement.style.setProperty('--top-h', (getComputedStyle($('top')).display !== 'none' ? $('top').offsetHeight : 0) + 'px');
if (typeof ResizeObserver === 'function') new ResizeObserver(topHeight).observe($('top'));
window.addEventListener('resize', topHeight);

// ---- Language: inside the shell the shell's picker sets it and this page follows (i18n
// listens); alone, the page shows its own picker in its own bar, which the shell hides ----

function relabel() {
  i18n.apply(document);
  renderStart();
  if (app.model) renderAll();
  else { document.title = ui('page.title'); renderTop(); }
}
i18n.onChange(relabel);
relabel();
topHeight();

// ---- Boot ----

async function boot() {
  readHash();
  const hello = await findServer();
  if (hello) { await start(serverSource(hello)); return; }
  // Served by something else: Build needs the core server.
  $('start').hidden = false;
  renderStart();
}

// For checks from the console or a test: the parsed state, read only.
window.developmentStatus = { get model() { return app.model; }, get source() { return app.source; }, get changes() { return app.changeLog; }, refresh, renderMarkdown };

boot();
