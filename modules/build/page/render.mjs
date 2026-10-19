// Puts the views on the page: each part of index.html's skeleton is rendered from its lit-html
// template (views/) into its element, when what it shows changed. Also the drawer's opening and
// closing (focus, the inert page behind it) and the toasts.

import { html, render } from '/vendor/lit-html/lit-html.js';
import { repeat } from '/vendor/lit-html/directives/repeat.js';
import { TOAST_MS } from './config.mjs';
import { ui } from './text.mjs';
import { state, app } from './state.mjs';
import { topView, startView, navView } from './views/chrome.mjs';
import { noticesView, overviewView } from './views/overview.mjs';
import { waitingView, areasView } from './views/tickets.mjs';
import { depsView } from './views/deps.mjs';
import { activityView } from './views/activity.mjs';
import { checksView, docsView } from './views/docs.mjs';
import { gitView } from './views/git.mjs';
import { drawerView } from './views/drawer.mjs';

const $ = (id) => document.getElementById(id);

// Inside the shell (an iframe of /) the shell's header shows the project, the live state and the
// version: the page's own bar hides (build.css, .in-shell).
export const IN_SHELL = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
document.documentElement.classList.toggle('in-shell', IN_SHELL);

export const VIEW_RENDERERS = { waiting: waitingView, areas: areasView, deps: depsView, activity: activityView, checks: checksView, docs: docsView, git: gitView };

// The page's own bar: only when it runs without the shell (the shell hides it).
export function renderTop() {
  render(topView(), $('top'));
}
export const renderLive = () => { if (!IN_SHELL) renderTop(); };

export function renderStart() {
  render(startView(), $('start'));
}

export function renderNotices() {
  if (!app.model) return;
  const out = noticesView(IN_SHELL);
  render(out, $('notices'));
  $('notices').hidden = !out.length;
}

export function renderOverview() {
  const box = $('overview');
  box.hidden = state.view !== 'waiting';
  render(box.hidden ? [] : overviewView(), box);
}

// The tabs and the filters; scrollTab: keep the current tab in sight (on a narrow screen the
// tabs scroll sideways).
export function renderNav(scrollTab) {
  const m = app.model;
  if (state.status && !m.statusCounts.has(state.status)) state.status = '';
  if (state.area && !m.areas.has(state.area)) state.area = '';
  render(navView(), $('nav'));
  if (!scrollTab) return;
  const nav = $('tabs'), cur = nav.querySelector('[aria-current]');
  if (cur && (cur.offsetLeft < nav.scrollLeft || cur.offsetLeft + cur.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = cur.offsetLeft - 16;
}

export function renderView() {
  if (!app.model) return;
  const y = window.scrollY;
  render((VIEW_RENDERERS[state.view] || VIEW_RENDERERS.waiting)(), $('view'));
  renderNav(false);
  window.scrollTo(0, y);
}

export function renderDrawer() {
  const doc = app.model && state.doc ? app.model.byPath.get(state.doc) : null;
  const drawer = $('drawer');
  if (!doc) {
    if (!drawer.hidden) closeDrawerNow();
    return;
  }
  const keepScroll = drawer.dataset.path === doc.path ? $('drawer-body').scrollTop : 0;
  render(drawerView(doc), drawer);
  const body = $('drawer-body');
  const wasHidden = drawer.hidden;
  drawer.hidden = false;
  $('shade').hidden = false;
  $('top').inert = true;
  $('main').inert = true;
  document.body.style.overflow = 'hidden';
  body.scrollTop = keepScroll;
  if (wasHidden || drawer.dataset.path !== doc.path) $('drawer-close').focus();
  drawer.dataset.path = doc.path;
}

export function closeDrawerNow() {
  $('drawer').hidden = true;
  $('shade').hidden = true;
  $('top').inert = false;
  $('main').inert = false;
  document.body.style.overflow = '';
  delete $('drawer').dataset.path;
}

export function renderAll() {
  $('start').hidden = true;
  $('app').hidden = false;
  document.title = ui('page.title-open', { n: app.model.open.length, name: app.model.projectName || ui('page.project') });
  renderNotices();
  renderOverview();
  renderNav(true);
  renderView();
  renderDrawer();
  renderTop();
}

// The start screen, with an error when there is one.
export function showStartScreen() {
  $('app').hidden = true;
  $('start').hidden = false;
  document.title = ui('page.title');
  closeDrawerNow();
  renderStart();
  renderTop();
}

// A transient message (re-read, up to date): a toast that goes away by itself.
let toasts = [];
let toastId = 0;
const renderToasts = () => render(repeat(toasts, (t) => t.id, (t) => html`<div class="gw-toast gw-toast--${t.tone}">${t.text}</div>`), $('toasts'));
export function toast(text, tone = 'info') {
  const t = { id: ++toastId, text, tone };
  toasts = [...toasts, t];
  renderToasts();
  setTimeout(() => { toasts = toasts.filter((x) => x !== t); renderToasts(); }, TOAST_MS);
}
