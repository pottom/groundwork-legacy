// The shell: the page the core server shows at /. A header with the project's name and a
// navigation built from the module manifests; the chosen module's view shows below it in a frame.
//
//   /                 the shell with the first module that has a view
//   /?module=<id>     the shell with that module
//
// The look (colours, typography, light or dark) comes from theme.css next to this file,
// served at /shell/theme.css; modules link the same file to share it (see README.md here).
//
// The UI text is English here and marked with data-i18n keys (strings.mjs); in the browser
// i18n.mjs switches it to the chosen language, and the picker in the header changes it for
// the shell and the module's frame alike.

import { SHELL_STRINGS } from './strings.mjs'
import { LANGS, DEFAULT_LANG } from './i18n.mjs'

const T = SHELL_STRINGS[DEFAULT_LANG]
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// project: the project's name; modules: the manifests; active: the id of the module to show.
export function shellPage({ project, modules, active }) {
  const views = modules.filter((m) => m.view)
  const current = views.find((m) => m.id === active) ?? views[0]
  const nav = views.map((m) => `<a href="/?module=${esc(encodeURIComponent(m.id))}"${m === current ? ' aria-current="page"' : ''}>${esc(m.name)}</a>`)
  const main = current
    ? `<iframe class="gw-view" title="${esc(current.name)}" src="/${esc(encodeURIComponent(current.id))}/"></iframe>`
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
  <span class="gw-project">${esc(project)}</span>
  <nav class="gw-nav" aria-label="${esc(T.nav)}" data-i18n-aria-label="nav">${nav.join('')}</nav>
  <select class="gw-lang" aria-label="${esc(T.language)}" data-i18n-aria-label="language">
    ${langs.join('\n    ')}
  </select>
  <span class="gw-brand">Groundwork</span>
</header>
<main class="gw-main">${main}</main>
<script type="module">
import { createI18n } from '/shell/i18n.mjs'
import { SHELL_STRINGS } from '/shell/strings.mjs'
const i18n = createI18n(SHELL_STRINGS)
const pick = document.querySelector('.gw-lang')
const show = () => { i18n.apply(document); pick.value = i18n.lang }
pick.onchange = () => i18n.set(pick.value)
i18n.onChange(show)
show()
</script>
</body>
</html>
`
}
