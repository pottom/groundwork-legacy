// Reading the project from the server, and again when it changed: the Markdown files, the GitHub
// issues, Plan's map ids, the sketches that link to tickets (Sketch), the agents working on them (Agents)
// and the git history, all in parallel.
// A live update names what changed, and only that is asked again; every (re)connect reads all.

import { reader, FRESH_MS, NO_REPO } from './config.mjs';
import { ui, clock, statusName, commentTitle } from './text.mjs';
import { state, app, actions, NO_GIT, NO_ISSUES } from './state.mjs';
import { scan } from './folder.mjs';
import { subscribe } from '/shell/live.mjs';
import { serverJson } from './server.mjs';
import { renderAll, renderView, renderDrawer, renderNav, renderNotices, renderLive, showStartScreen, toast } from './render.mjs';

const { readTickets, linkedSketches, linkedAgents } = reader;

function describeChange(path, before, after) {
  if (after && after.kind === 'ticket') {
    if (!before) return { label: after.label, text: () => ui('change.new-ticket', { title: after.title, status: statusName(after.status) }) };
    const parts = [];
    if (before.status !== after.status) parts.push(() => ui('change.status', { from: statusName(before.status), to: statusName(after.status) }));
    if (before.checks.done !== after.checks.done || before.checks.total !== after.checks.total) parts.push(() => ui('change.checks', { from: `${before.checks.done}/${before.checks.total}`, to: `${after.checks.done}/${after.checks.total}` }));
    if (after.comments.length > before.comments.length) { const c = after.comments[after.comments.length - 1]; parts.push(() => ui('change.comment', { title: commentTitle(c) })); }
    if (before.title !== after.title) parts.push(() => ui('change.title', { title: after.title }));
    if (before.fields['blocked by'] !== after.fields['blocked by']) parts.push(() => ui('change.blocked-by', { list: after.fields['blocked by'] || ui('change.none') }));
    return { label: after.label, text: () => parts.map((f) => f()).join('; ') || ui('change.text') };
  }
  const name = path.split('/').slice(-2).join('/');
  if (!after) return { label: before && before.label ? before.label : name, text: () => ui('change.deleted') };
  return { label: name, text: () => ui(before ? 'change.modified' : 'change.new-file') };
}

const ALL_PARTS = ['files', 'issues', 'map', 'sketches', 'agents', 'git'];
const TOPIC_PART = { 'build.files': 'files', 'build.issues': 'issues', 'build.git': 'git', 'plan.map': 'map', 'sketch.links': 'sketches', 'agents.events': 'agents' };
function partsOf(topics) {
  const parts = new Set();
  for (const t of topics) {
    if (TOPIC_PART[t]) parts.add(TOPIC_PART[t]);
    else if (t.startsWith('build.')) ALL_PARTS.forEach((p) => parts.add(p));
  }
  return [...parts];
}

let busy = false;
let pending = new Set();   // the parts asked for while a refresh ran
let announce = false;      // a refresh the user asked for: say when nothing changed

// announce: the user asked; say so also when nothing changed.
export async function refresh(parts = ALL_PARTS, { asked = false } = {}) {
  if (!app.source) return;
  if (asked) announce = true;
  for (const p of parts) pending.add(p);
  if (busy) return;
  busy = true;
  try {
    while (pending.size && app.source) {
      const want = pending;
      pending = new Set();
      await refreshOnce(want);
    }
  } finally {
    busy = false;
    renderLive();
  }
}

// The files that changed since the last round (read again), and the gone ones.
async function readFiles() {
  const next = await scan(app.source);
  const seen = new Set();
  const touched = [];
  await Promise.all(next.entries.map(async (e) => {
    seen.add(e.path);
    const old = app.cache.get(e.path);
    if (old && old.size === e.size && old.mtime === e.mtime) return;
    // A file caught mid-write is read again in the next round.
    try { app.cache.set(e.path, { size: e.size, mtime: e.mtime, text: await e.file.text() }); touched.push(e.path); } catch (err) { if (err.name === 'ServerDownError') throw err; }
  }));
  for (const path of [...app.cache.keys()]) if (!seen.has(path)) { app.cache.delete(path); touched.push(path); }
  app.listing = next;
  return touched;
}

async function refreshOnce(want) {
  const src = app.source;
  const wasDown = app.serverDown;
  try {
    const [files, issues, , gitChanged, sketchesChanged, agentsChanged] = await Promise.all([
      want.has('files') || !app.listing ? readFiles() : [],
      want.has('issues') ? refreshIssues() : [],
      want.has('map') ? refreshMap() : null,
      want.has('git') ? refreshGit() : false,
      want.has('sketches') ? refreshSketches() : false,
      want.has('agents') ? refreshAgents() : false,
    ]);
    if (src !== app.source) return;
    const touched = [...files, ...issues];
    const { listing, map } = app;
    const shape = listing.trackerPath + '|' + listing.adrPath + '|' + listing.others.length + '|' + (map.ids ? map.key : '-');
    const first = !app.model;
    let changed = 0;
    if (first || touched.length || shape !== src.shape) {
      src.shape = shape;
      const next = readTickets({
        name: src.name,
        files: { entries: app.cache, others: listing.others, trackerPath: listing.trackerPath, adrPath: listing.adrPath },
        github: app.issues.repo ? { repo: app.issues.repo, issues: app.issues.issues } : null,
        mapIds: map.ids,
      });
      if (!first && touched.length) {
        const now = Date.now();
        const items = touched.map((path) => ({ path, ...describeChange(path, app.model.byPath.get(path), next.byPath.get(path)) }));
        app.changeLog = [{ at: new Date(), items }, ...app.changeLog].slice(0, 40);
        for (const path of touched) app.recent.set(path, now);
        changed = items.length;
        setTimeout(() => { if (app.model) renderView(); }, FRESH_MS + 500);
      }
      app.model = next;
      app.sketches.byTicket = linkedSketches(next, app.sketches.linked);
      app.agents.byTicket = linkedAgents(next, app.agents.linked);
      renderAll();
      if (first && actions.openLinked) actions.openLinked();
    } else {
      if (gitChanged && app.model) { renderNav(true); if (state.view === 'git') renderView(); }
      if (sketchesChanged && app.model) app.sketches.byTicket = linkedSketches(app.model, app.sketches.linked);
      if (agentsChanged && app.model) app.agents.byTicket = linkedAgents(app.model, app.agents.linked);
      if ((sketchesChanged || agentsChanged) && app.model) { renderView(); renderDrawer(); }
    }
    app.lastChecked = new Date();
    app.serverDown = false;
    if (wasDown) renderNotices();
    if (changed) toast(ui('toast.changed', { n: changed, time: clock(app.lastChecked) }), 'ok');
    else if (announce) toast(ui('toast.same', { time: clock(app.lastChecked) }), 'info');
  } catch (err) {
    // The server stopped: keep what was read, keep asking; it may come back.
    if (err && err.name === 'ServerDownError') app.serverDown = true;
    else console.error(err);
    if (!app.model) showStart(ui('error.read', { error: err && err.message ? err.message : err }));
    else renderNotices();
  } finally {
    announce = false;
  }
}

// The project's GitHub issues, which the server fetches (the page never talks to GitHub); the
// paths of the tickets that changed. The server is told what the page has, and answers
// "unchanged" while the issues are the same.
async function refreshIssues() {
  const src = app.source;
  if (!src || !src.github) return [];
  const before = app.issues;
  const known = before.fingerprint ? '?known=' + encodeURIComponent(before.fingerprint) : '';
  let data;
  try { data = await serverJson('/issues' + known); } catch (err) { if (err.name === 'ServerDownError') throw err; return []; }
  if (data.unchanged) return [];
  const issues = data.available ? data.issues : [];
  const repo = data.available ? data.repo : null;
  const next = new Map(issues.map((i) => [i.number, JSON.stringify(i)]));
  const touched = [];
  for (const [n, json] of next) if (before.byNumber.get(n) !== json) touched.push(repo + '#' + n);
  for (const n of before.byNumber.keys()) if (!next.has(n)) touched.push(before.repo + '#' + n);
  app.issues = { fingerprint: data.fingerprint || '', repo, issues, byNumber: next };
  return touched;
}

// The ids of Plan's map, which the reader checks the tickets' PRD lines against: Plan sends only
// the ids (GET /api/plan/ids, "same" while unchanged). No map (none in the project, Plan not
// running): ids null, and no PRD id counts as unknown.
async function refreshMap() {
  if (!app.source) return;
  try {
    const known = app.map.key ? '?v=' + encodeURIComponent(app.map.key) : '';
    const res = await fetch('/api/plan/ids' + known, { cache: 'no-store' });
    const data = res.ok ? await res.json() : null;
    if (data && data.same) return;
    const ids = data && Array.isArray(data.ids) ? data.ids.map(String) : null;
    app.map = { key: ids && data.v ? String(data.v) : '', ids };
  } catch (err) {
    app.map = { key: '', ids: null };   // no Plan, or the server stopped: try again next round
  }
}

// The sketches that link to tickets from Sketch's side (its public GET /api/sketch/links: linked.ticket,
// { '#34': ['flow'] }); true when they changed. No Sketch (not running, no answer): none, no error,
// and a ticket shows only its own "**Sketch:**" line.
async function refreshSketches() {
  let linked = null;
  try {
    const res = await fetch('/api/sketch/links', { cache: 'no-store' });
    linked = res.ok ? ((await res.json()).linked || {}).ticket || null : null;
  } catch (err) {
    linked = null;
  }
  const key = JSON.stringify(linked || {});
  if (key === app.sketches.key) return false;
  app.sketches = { ...app.sketches, key, linked };
  return true;
}

// The agents working on tickets, from Agents' side (its public GET /api/agents/tickets: tickets,
// { '#37': [{ id, session, label, branch, start }] }); true when they changed. No Agents (not
// running, no answer): no agent on any ticket, no error.
async function refreshAgents() {
  let linked = null;
  try {
    const res = await fetch('/api/agents/tickets', { cache: 'no-store' });
    linked = res.ok ? (await res.json()).tickets || null : null;
  } catch (err) {
    linked = null;
  }
  const key = JSON.stringify(linked || {});
  if (key === app.agents.key) return false;
  app.agents = { ...app.agents, key, linked };
  return true;
}

// The server's git history; true when it changed. The server is told what the page has, and
// answers "unchanged" while no ref moved.
export async function refreshGit() {
  const src = app.source, git = app.git;
  if (!src || !src.git) return false;
  const known = git.data && git.data.limit === git.limit ? '&known=' + git.data.fingerprint : '';
  let data;
  try { data = await serverJson('/git?limit=' + git.limit + known); } catch (err) { return false; }
  if (data.unchanged) return false;
  if (!data.available) {
    const error = data.error || NO_REPO;
    const changed = git.data !== null || git.error !== error;
    git.data = null;
    git.error = error;
    return changed;
  }
  git.data = data;
  git.error = '';
  return true;
}

// How the page follows the project: the core server's live updates (subscribe from
// /shell/live.mjs: the shell's one stream inside the shell, the page's own when opened alone) say
// what changed, and the page reads that again; every (re)connect reads everything, so nothing
// missed meanwhile is lost. The first hello is also the first read: the page listens before it
// reads, so one round of requests starts it (the shell answers at once when its stream is up).
let liveStop = null;

function startLive() {
  stopLive();
  if (!app.source) return;
  let heard = false;
  liveStop = subscribe({
    onHello: () => { heard = true; refresh(); },
    onChange: (topics) => { const parts = partsOf(topics); if (parts.length) refresh(parts); },
    onState: (s) => {
      app.liveState = s;
      // No live connection at all: read what there is once, so the page is not blank.
      if (s === 'off' && !heard && !app.model) { heard = true; refresh(); }
      if (s === 'off' && !app.serverDown) { app.serverDown = true; renderNotices(); }
      renderLive();
    },
  });
}

function stopLive() {
  if (liveStop) { liveStop(); liveStop = null; }
}

// Reads a new source from scratch, and follows it.
export async function start(src) {
  stopLive();
  Object.assign(app, {
    source: src, cache: new Map(), listing: null, model: null, changeLog: [], recent: new Map(),
    serverDown: false, git: NO_GIT(), issues: NO_ISSUES(), map: { key: '', ids: null }, startError: '',
  });
  startLive();
}

// Back to the start screen, with an error when there is one.
export function showStart(error) {
  stopLive();
  app.source = null;
  app.model = null;
  if (error) app.startError = error;
  showStartScreen();
}
