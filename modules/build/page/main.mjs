// The Build page: what its controls do (the `actions` the views call), the address (#/<view>/<doc>),
// the keyboard, choosing a folder (button, snapshot, drag and drop), the language, and the boot.
// index.html loads this module from the server; opened as a file it loads page.bundle.js, the same
// modules as one classic script (file-bundle.mjs).

import { GIT_PAGE } from './config.mjs';
import { i18n, ui } from './text.mjs';
import { state, app, actions, applies, docHref, rememberHandle, forgetHandle, recallHandle } from './state.mjs';
import { handleAdapter, entryAdapter, treeAdapter, treeFromFiles } from './folder.mjs';
import { findServer, serverSource } from './server.mjs';
import { refresh, refreshGit, start, showStart } from './refresh.mjs';
import { VIEW_RENDERERS, canPick, renderAll, renderView, renderNav, renderOverview, renderDrawer, renderTop, renderStart } from './render.mjs';
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

// ---- Choosing the folder ----

async function useHandle(handle) {
  await rememberHandle(handle);
  await start({ adapter: handleAdapter, root: handle, name: handle.name, live: true });
}

function startError(error) {
  app.startError = error;
  renderStart();
}

let typing = null;

Object.assign(actions, {
  // Read again now: from the server or a live folder; a snapshot asks for the folder again; a
  // folder the browser stopped letting the page read asks for the permission first.
  async readAgain() {
    const src = app.source;
    if (!src) return;
    if (!src.live) { $('dir-input').click(); return; }
    if (app.lostAccess) {
      try { if (await src.root.requestPermission({ mode: 'read' }) !== 'granted') return; } catch (e) { return; }
    }
    refresh(undefined, { asked: true });
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
  async pickFolder() {
    try {
      await useHandle(await window.showDirectoryPicker({ mode: 'read', id: 'development-status' }));
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      startError(ui('error.open', { error: err && err.message ? err.message : err }));
    }
  },
  chooseSnapshot() { $('dir-input').click(); },
  async snapshotChosen(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    const tree = treeFromFiles(files);
    await start({ adapter: treeAdapter, root: tree.root, name: tree.name, live: false });
  },
  async otherFolder() {
    await forgetHandle();
    showStart();
    if (canPick) actions.pickFolder();
  },
  resume: async () => {},   // set by boot() when there is a remembered folder
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

// From the server the live updates say what changed; a folder read in the browser is read again
// when the page comes back into sight.
document.addEventListener('visibilitychange', () => { if (!document.hidden && app.source && app.source.live && !app.source.server) refresh(); });

// ---- A dropped folder: live where the browser hands out a handle, a snapshot elsewhere ----

let dragDepth = 0;
const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
document.addEventListener('dragenter', (e) => { if (hasFiles(e)) { dragDepth++; document.body.classList.add('dragging'); } });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', async (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const item = [...e.dataTransfer.items].find((it) => it.kind === 'file');
  if (!item) return;
  // Both calls must happen before the handler yields.
  const handlePromise = typeof item.getAsFileSystemHandle === 'function' ? item.getAsFileSystemHandle() : null;
  const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
  let handle = null;
  try { handle = handlePromise ? await handlePromise : null; } catch (err) { handle = null; }
  if (handle && handle.kind === 'directory') return useHandle(handle);
  if (entry && entry.isDirectory) return start({ adapter: entryAdapter, root: entry, name: entry.name, live: false });
  startError(ui('error.drop-file'));
});

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
  $('start').hidden = false;
  if (!canPick) return;
  const saved = await recallHandle();
  if (!saved || typeof saved.queryPermission !== 'function') return;
  let permission = 'prompt';
  try { permission = await saved.queryPermission({ mode: 'read' }); } catch (e) { /* ask again */ }
  if (permission === 'granted') { await start({ adapter: handleAdapter, root: saved, name: saved.name, live: true }); return; }
  app.resumeName = saved.name;
  actions.resume = async () => {
    try {
      if (await saved.requestPermission({ mode: 'read' }) === 'granted') await start({ adapter: handleAdapter, root: saved, name: saved.name, live: true });
    } catch (err) {
      startError(ui('error.gone', { error: err && err.message ? err.message : err }));
    }
  };
  renderStart();
}

// For checks from the console or a test: the parsed state, read only.
window.developmentStatus = { get model() { return app.model; }, get source() { return app.source; }, get changes() { return app.changeLog; }, refresh, renderMarkdown };

boot();
