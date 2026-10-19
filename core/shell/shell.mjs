// The shell: the page the core server shows at /. A two-tier header: a bar with the brand, the
// project's name, whether the page is live, the language and the version; under it a tab per
// module, built from the manifests (icon, name, tagline). The chosen module's view shows below
// in a frame.
//
//   /                 the shell with the first module that has a view
//   /?module=<id>     the shell with that module
//   /?module=<id>&…   a deep link: the rest of the query goes to the module's frame
//                     (/?module=plan&node=d-trace shows /plan/?node=d-trace)
//
// The look (colours, typography, light or dark) comes from theme.css next to this file,
// served at /shell/theme.css; modules link the same file to share it (see README.md here).
//
// The UI text is English here and marked with data-i18n keys (strings.mjs, plus each module's
// tagline as module.<id>.tagline); in the browser i18n.mjs switches it to the chosen language,
// and the picker in the header changes it for the shell and the module's frame alike.

import { SHELL_STRINGS } from './strings.mjs'
import { LANGS, DEFAULT_LANG } from './i18n.mjs'

const T = SHELL_STRINGS[DEFAULT_LANG]
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
// JSON for inside a <script>: a "<" could end the script early.
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c')

// A module without an icon of its own gets a plain square.
const PLAIN_ICON = '<rect x="4.5" y="4.5" width="15" height="15" rx="3.5"/>'
const icon = (m) => `<svg class="gw-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.icon ?? PLAIN_ICON}</svg>`

const LOGO = `<svg class="gw-logo" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="9" fill="url(#gw-logo-fill)"/>
    <defs><linearGradient id="gw-logo-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--gw-accent)"/><stop offset="1" stop-color="var(--gw-accent-2)"/></linearGradient></defs>
    <path d="M8 20.5l8 4 8-4M8 16l8 4 8-4M16 7.5l8 4-8 4-8-4z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`

// The shell's strings with the modules' taglines added, one set per language.
function pageStrings(views) {
  const strings = {}
  for (const [lang, set] of Object.entries(SHELL_STRINGS)) {
    strings[lang] = { ...set }
    for (const m of views) if (m.tagline?.[lang]) strings[lang][`module.${m.id}.tagline`] = m.tagline[lang]
  }
  return strings
}

// project: the project's name; version: Groundwork's, shown in the header; modules: the manifests; active: the id of the module to show;
// params: the rest of the shell's query (URLSearchParams), handed on to that module's frame.
export function shellPage({ project, version, modules, active, params }) {
  const views = modules.filter((m) => m.view)
  const current = views.find((m) => m.id === active) ?? views[0]
  const tagline = (m) => {
    const text = m.tagline?.[DEFAULT_LANG]
    return text ? `<small class="gw-tab-tagline" data-i18n="module.${esc(m.id)}.tagline">${esc(text)}</small>` : ''
  }
  const tabs = views.map((m) => `<a href="/?module=${esc(encodeURIComponent(m.id))}"${m === current ? ' aria-current="page"' : ''}>${icon(m)}<span class="gw-tab-text"><b class="gw-tab-name">${esc(m.name)}</b>${tagline(m)}</span></a>`)
  const rest = new URLSearchParams(current && current.id === active ? params : undefined)
  rest.delete('module')
  const query = rest.size ? '?' + rest : ''
  const main = current
    ? `<iframe class="gw-view" title="${esc(current.name)}" src="/${esc(encodeURIComponent(current.id))}/${esc(query)}"></iframe>`
    : `<p class="gw-empty" data-i18n="noView">${esc(T.noView)}</p>`
  const langs = Object.entries(LANGS).map(([code, name]) => `<option value="${code}">${esc(name)}</option>`)
  return `<!doctype html>
<html lang="${DEFAULT_LANG}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project)}${current ? ` · ${esc(current.name)}` : ''} · Groundwork</title>
<link rel="stylesheet" href="/shell/theme.css">
<link rel="stylesheet" href="/shell/shell.css">
</head>
<body class="gw-shell">
<header class="gw-header">
  <div class="gw-bar">
    ${LOGO}
    <span class="gw-brand">Groundwork</span>
    <span class="gw-sep" aria-hidden="true">/</span>
    <span class="gw-project">${esc(project)}</span>
    <span class="gw-live" data-state="connecting" title="${esc(T.connectingTitle)}" data-i18n-title="connectingTitle"><i></i><span data-i18n="connecting">${esc(T.connecting)}</span></span>
    <select class="gw-lang" aria-label="${esc(T.language)}" data-i18n-aria-label="language">
      ${langs.join('\n      ')}
    </select>
    ${version ? `<span class="gw-version">v${esc(version)}</span>` : ''}
  </div>
  <nav class="gw-nav" aria-label="${esc(T.nav)}" data-i18n-aria-label="nav">
    ${tabs.join('\n    ')}
  </nav>
</header>
<main class="gw-main">${main}</main>
<script type="module">
import { createI18n } from '/shell/i18n.mjs'
const i18n = createI18n(${scriptJson(pageStrings(views))})
const pick = document.querySelector('.gw-lang')
const live = document.querySelector('.gw-live')
const STATES = { connecting: 'connecting', on: 'live', off: 'offline' }
const show = () => {
  const key = STATES[live.dataset.state]
  live.querySelector('span').dataset.i18n = key
  live.dataset.i18nTitle = key + 'Title'
  i18n.apply(document)
  pick.value = i18n.lang
}
pick.onchange = () => i18n.set(pick.value)
i18n.onChange(show)
show()
// Live: the server's update stream is open (EventSource reconnects by itself).
const events = new EventSource('/api/events')
events.addEventListener('hello', () => { live.dataset.state = 'on'; show() })
events.onerror = () => { live.dataset.state = 'off'; show() }
</script>
</body>
</html>
`
}
