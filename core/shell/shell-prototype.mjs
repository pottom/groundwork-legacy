// PROTOTYPE — throwaway. Three directions for the shell's look, on the real / route:
//   /?variant=A   Rail       a left sidebar; the module sits in an inset card
//   /?variant=B   Island     a floating pill bar with a segmented module switch
//   /?variant=C   Workspace  a two-tier header: breadcrumb bar + large descriptive tabs
// The floating bar at the bottom (or ← →) cycles them. Lives on branch prototype/shell-look only.

import { SHELL_STRINGS } from './strings.mjs'
import { LANGS, DEFAULT_LANG } from './i18n.mjs'

const T = SHELL_STRINGS[DEFAULT_LANG]
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const VARIANTS = { A: 'Rail', B: 'Island', C: 'Workspace' }

const ABOUT = {
  plan: { en: 'Mind map & product docs', icon: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7l3.9 3.2M18 7l-3.9 3.2M6 17l3.9-3.2M18 17l-3.9-3.2"/>' },
  build: { en: 'Tickets, progress & branches', icon: '<rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="14" width="7" height="6" rx="1.6"/><path d="M14 17.5l2 2 4-4.5"/>' },
}
const icon = (id) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ABOUT[id]?.icon ?? '<rect x="4" y="4" width="16" height="16" rx="3"/>'}</svg>`

const LOGO = `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true">
  <defs><linearGradient id="gwg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--p-a1)"/><stop offset="1" stop-color="var(--p-a2)"/></linearGradient></defs>
  <rect width="32" height="32" rx="9" fill="url(#gwg)"/>
  <path d="M8 20.5l8 4 8-4M8 16l8 4 8-4M16 7.5l8 4-8 4-8-4z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>
</svg>`

export function prototypeShellPage({ project, version, modules, active, params }) {
  const variant = VARIANTS[params.get('variant')] ? params.get('variant') : 'A'
  const views = modules.filter((m) => m.view)
  const current = views.find((m) => m.id === active) ?? views[0]
  const rest = new URLSearchParams(current && current.id === active ? params : undefined)
  rest.delete('module'); rest.delete('variant')
  const query = rest.size ? '?' + rest : ''
  const href = (m) => `/?module=${esc(encodeURIComponent(m.id))}&amp;variant=${variant}`
  const cur = (m) => (m === current ? ' aria-current="page"' : '')
  const frame = current
    ? `<iframe class="gw-view" title="${esc(current.name)}" src="/${esc(encodeURIComponent(current.id))}/${esc(query)}"></iframe>`
    : `<p class="gw-empty" data-i18n="noView">${esc(T.noView)}</p>`
  const lang = `<select class="p-lang" aria-label="${esc(T.language)}" data-i18n-aria-label="language">${Object.entries(LANGS).map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join('')}</select>`
  const live = `<span class="p-live" data-live><i></i><b>Live</b></span>`
  const initials = project.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'G'

  const bodies = {
    A: `
<aside class="a-rail">
  <div class="a-brand">${LOGO}<span>Groundwork</span></div>
  <div class="a-project"><span class="a-avatar">${esc(initials)}</span><span class="a-pname"><b>${esc(project)}</b><small>Local project</small></span></div>
  <div class="a-label" data-i18n="nav">${esc(T.nav)}</div>
  <nav class="a-nav" aria-label="${esc(T.nav)}" data-i18n-aria-label="nav">
    ${views.map((m) => `<a href="${href(m)}"${cur(m)}>${icon(m.id)}<span><b>${esc(m.name)}</b><small>${esc(ABOUT[m.id]?.en ?? '')}</small></span></a>`).join('\n    ')}
  </nav>
  <div class="a-foot">${live}<div class="a-row">${lang}<span class="p-ver">v${esc(version)}</span></div></div>
</aside>
<main class="a-main"><div class="a-card">${frame}</div></main>`,

    B: `
<header class="b-top">
  <div class="b-left">${LOGO}<span class="b-crumb"><span>Groundwork</span><i>/</i><b>${esc(project)}</b></span></div>
  <nav class="b-island" aria-label="${esc(T.nav)}" data-i18n-aria-label="nav" style="--n:${views.length};--i:${Math.max(0, views.indexOf(current))}">
    <span class="b-thumb"></span>
    ${views.map((m) => `<a href="${href(m)}"${cur(m)}>${icon(m.id)}${esc(m.name)}</a>`).join('\n    ')}
  </nav>
  <div class="b-right">${live}${lang}<span class="p-ver">v${esc(version)}</span></div>
</header>
<main class="b-main">${frame}</main>`,

    C: `
<header class="c-head">
  <div class="c-bar">
    ${LOGO}<span class="c-word">Groundwork</span><span class="c-sep">/</span><span class="c-project">${esc(project)}</span>
    <span class="c-spacer"></span>${live}${lang}<span class="p-ver">v${esc(version)}</span>
  </div>
  <nav class="c-tabs" aria-label="${esc(T.nav)}" data-i18n-aria-label="nav">
    ${views.map((m, i) => `<a href="${href(m)}"${cur(m)}><span class="c-num">0${i + 1}</span>${icon(m.id)}<span><b>${esc(m.name)}</b><small>${esc(ABOUT[m.id]?.en ?? '')}</small></span></a>`).join('\n    ')}
  </nav>
</header>
<main class="c-main">${frame}</main>`,
  }

  return `<!doctype html>
<html lang="${DEFAULT_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project)}${current ? ` · ${esc(current.name)}` : ''} · Groundwork · prototype ${variant}</title>
<link rel="stylesheet" href="/shell/theme.css">
<style>${CSS}</style>
</head>
<body class="p v${variant}">
${bodies[variant]}
<div class="p-switch" role="toolbar" aria-label="Prototype variants">
  <button data-go="-1" aria-label="Previous variant">←</button>
  <span><b>${variant}</b> ${VARIANTS[variant]} <em>prototype</em></span>
  <button data-go="1" aria-label="Next variant">→</button>
</div>
<script type="module">
import { createI18n } from '/shell/i18n.mjs'
import { SHELL_STRINGS } from '/shell/strings.mjs'
const i18n = createI18n(SHELL_STRINGS)
const pick = document.querySelector('.p-lang')
const show = () => { i18n.apply(document); pick.value = i18n.lang }
pick.onchange = () => i18n.set(pick.value)
i18n.onChange(show)
show()

const keys = ${JSON.stringify(Object.keys(VARIANTS))}
const go = (d) => { const u = new URL(location.href); u.searchParams.set('variant', keys[(keys.indexOf(${JSON.stringify(variant)}) + d + keys.length) % keys.length]); location.replace(u) }
document.querySelectorAll('.p-switch [data-go]').forEach((b) => b.onclick = () => go(+b.dataset.go))
addEventListener('keydown', (e) => { if (e.target.closest?.('input,textarea,select,[contenteditable]')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1) })

const liveEl = document.querySelector('[data-live]')
const es = new EventSource('/api/events')
es.addEventListener('hello', () => liveEl.dataset.state = 'on')
es.onerror = () => liveEl.dataset.state = 'off'
</script>
</body>
</html>
`
}

const CSS = `
* { box-sizing: border-box; }
html, body.p { height: 100%; margin: 0; }
body.p {
  --p-a1: #5b7cfa; --p-a2: #9b5cf6;
  --p-glass: rgb(255 255 255 / .72);
  --p-chrome: #f1efe9;
  background: var(--gw-bg); color: var(--gw-fg); font: var(--gw-text) var(--gw-font);
  -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  body.p { --p-a1: #7d9cf0; --p-a2: #b48cf8; --p-glass: rgb(28 30 35 / .72); --p-chrome: #101114; }
}
.gw-view { display: block; width: 100%; height: 100%; border: 0; background: var(--gw-bg); }
.gw-empty { padding: 24px; color: var(--gw-muted); }
.ic { width: 18px; height: 18px; flex: none; }
.logo { width: 26px; height: 26px; flex: none; display: block; }
a { color: inherit; text-decoration: none; }
a:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--gw-focus); outline-offset: 2px; }

.p-lang {
  appearance: none; padding: 4px 10px; border: 1px solid var(--gw-line); border-radius: 999px;
  background: transparent; color: var(--gw-fg-2); font: 500 12px/1.2 var(--gw-font); cursor: pointer;
}
.p-ver { font: 500 11px/1 var(--gw-font-mono); color: var(--gw-muted); padding: 4px 7px; border-radius: 6px; background: var(--gw-sunken); }
.p-live { display: inline-flex; align-items: center; gap: 6px; font: 500 12px/1 var(--gw-font); color: var(--gw-muted); }
.p-live i { width: 7px; height: 7px; border-radius: 50%; background: var(--gw-muted); }
.p-live[data-state="on"] i { background: var(--gw-ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gw-ok) 22%, transparent); animation: p-pulse 2.4s ease-in-out infinite; }
.p-live[data-state="off"] i { background: var(--gw-bad); }
@keyframes p-pulse { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--gw-ok) 0%, transparent); } }

/* the prototype switcher: not part of any design */
.p-switch {
  position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 99;
  display: flex; align-items: center; gap: 4px; padding: 5px; border-radius: 999px;
  background: #111; color: #fff; font: 13px/1 var(--gw-font); box-shadow: 0 8px 30px rgb(0 0 0 / .35);
}
.p-switch span { padding: 0 10px; white-space: nowrap; }
.p-switch em { font-style: normal; color: #f5c451; margin-left: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
.p-switch button { width: 30px; height: 30px; border: 0; border-radius: 50%; background: #2a2a2a; color: #fff; cursor: pointer; font-size: 14px; }
.p-switch button:hover { background: #3a3a3a; }

/* ---------- A: Rail ---------- */
body.vA { display: flex; background: var(--p-chrome); }
.a-rail { width: 248px; flex: none; display: flex; flex-direction: column; padding: 14px 12px; gap: 6px; }
.a-brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 14px; font-weight: 650; letter-spacing: -.01em; }
.a-project { display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; background: var(--gw-surface); border: 1px solid var(--gw-line); box-shadow: var(--gw-shadow); margin-bottom: 14px; }
.a-avatar { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font: 700 12px/1 var(--gw-font); color: #fff; background: linear-gradient(135deg, #f59e0b, #ef4444); }
.a-pname { display: flex; flex-direction: column; min-width: 0; }
.a-pname b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.a-pname small, .a-nav small { color: var(--gw-muted); font-size: 12px; }
.a-label { padding: 0 10px 6px; font: 600 11px/1 var(--gw-font); text-transform: uppercase; letter-spacing: .09em; color: var(--gw-muted); }
.a-nav { display: flex; flex-direction: column; gap: 2px; }
.a-nav a { position: relative; display: flex; align-items: center; gap: 12px; padding: 9px 10px; border-radius: 10px; color: var(--gw-fg-2); transition: background .15s; }
.a-nav a span { display: flex; flex-direction: column; line-height: 1.3; }
.a-nav a b { font-weight: 550; color: var(--gw-fg); }
.a-nav a:hover { background: color-mix(in srgb, var(--gw-fg) 6%, transparent); }
.a-nav a[aria-current="page"] { background: var(--gw-surface); box-shadow: var(--gw-shadow); color: var(--gw-accent); }
.a-nav a[aria-current="page"]::before { content: ''; position: absolute; left: -12px; top: 10px; bottom: 10px; width: 3px; border-radius: 0 3px 3px 0; background: linear-gradient(var(--p-a1), var(--p-a2)); }
.a-foot { margin-top: auto; display: flex; flex-direction: column; gap: 10px; padding: 10px; }
.a-row { display: flex; align-items: center; justify-content: space-between; }
.a-main { flex: 1; min-width: 0; padding: 10px 10px 10px 0; }
.a-card { height: 100%; border-radius: 16px; overflow: hidden; border: 1px solid var(--gw-line); background: var(--gw-bg); box-shadow: 0 1px 3px rgb(0 0 0 / .06), 0 12px 40px rgb(0 0 0 / .06); }
@media (max-width: 760px) {
  .a-rail { width: 64px; padding: 12px 8px; }
  .a-brand span, .a-project .a-pname, .a-label, .a-nav a span, .a-foot .a-row, .p-live b { display: none; }
  .a-project { padding: 6px; justify-content: center; } .a-nav a { justify-content: center; }
}

/* ---------- B: Island ---------- */
body.vB { display: flex; flex-direction: column; }
.b-top { position: relative; height: 60px; flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 16px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--p-a1) 7%, var(--gw-bg)), var(--gw-bg)); border-bottom: 1px solid var(--gw-line); }
.b-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.b-crumb { display: flex; align-items: baseline; gap: 8px; min-width: 0; white-space: nowrap; }
.b-crumb span { color: var(--gw-muted); font-weight: 500; }
.b-crumb i { font-style: normal; color: var(--gw-line-strong); }
.b-crumb b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.b-island { position: relative; display: grid; grid-template-columns: repeat(var(--n), 1fr); padding: 4px; border-radius: 999px;
  background: var(--p-glass); backdrop-filter: blur(14px) saturate(1.4); border: 1px solid var(--gw-line); box-shadow: 0 6px 24px rgb(0 0 0 / .08), inset 0 1px 0 rgb(255 255 255 / .25); }
.b-island a { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 7px 22px; border-radius: 999px; font-weight: 550; color: var(--gw-fg-2); transition: color .2s; }
.b-island a[aria-current="page"] { color: #fff; }
.b-thumb { position: absolute; top: 4px; bottom: 4px; left: 4px; width: calc((100% - 8px) / var(--n)); transform: translateX(calc(100% * var(--i)));
  border-radius: 999px; background: linear-gradient(135deg, var(--p-a1), var(--p-a2)); box-shadow: 0 4px 14px color-mix(in srgb, var(--p-a1) 45%, transparent); transition: transform .3s cubic-bezier(.2,.8,.2,1); }
.b-right { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.b-main { flex: 1; min-height: 0; }
@media (max-width: 760px) { .b-crumb, .b-right .p-live b, .b-right .p-ver { display: none; } .b-island a { padding: 7px 14px; } }

/* ---------- C: Workspace ---------- */
body.vC { display: flex; flex-direction: column; }
.c-head { flex: none; background: var(--gw-surface); border-bottom: 1px solid var(--gw-line); position: relative; }
.c-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, var(--p-a1), var(--p-a2), transparent); opacity: .5; }
.c-bar { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 20px; border-bottom: 1px solid var(--gw-line); }
.c-word { font-weight: 650; letter-spacing: -.01em; }
.c-sep { color: var(--gw-line-strong); font-size: 18px; }
.c-project { font: italic 600 17px/1 var(--gw-font-serif); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.c-spacer { flex: 1; }
.c-bar > .p-live, .c-bar > .p-lang { margin-right: 4px; }
.c-tabs { display: flex; gap: 6px; padding: 8px 14px 0; }
.c-tabs a { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 18px 12px 12px; border-radius: 12px 12px 0 0; color: var(--gw-fg-2); transition: background .15s; }
.c-tabs a span:last-child { display: flex; flex-direction: column; line-height: 1.25; }
.c-tabs b { font-weight: 600; color: var(--gw-fg); }
.c-tabs small { font-size: 12px; color: var(--gw-muted); }
.c-num { font: 500 11px/1 var(--gw-font-mono); color: var(--gw-muted); }
.c-tabs a:hover { background: var(--gw-sunken); }
.c-tabs a[aria-current="page"] { background: var(--gw-bg); color: var(--gw-accent); box-shadow: inset 0 1px 0 var(--gw-line), inset 1px 0 0 var(--gw-line), inset -1px 0 0 var(--gw-line); }
.c-tabs a[aria-current="page"]::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--gw-bg); }
.c-tabs a[aria-current="page"]::before { content: ''; position: absolute; left: 12px; right: 12px; top: -1px; height: 2px; border-radius: 2px; background: linear-gradient(90deg, var(--p-a1), var(--p-a2)); }
.c-main { flex: 1; min-height: 0; }
@media (max-width: 760px) { .c-tabs small, .c-num, .c-word, .c-sep, .c-bar .p-ver { display: none; } }
`
