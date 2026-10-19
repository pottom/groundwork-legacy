// The shell: the page the core server shows at /. A header with the project's name and a
// navigation built from the module manifests; the chosen module's view shows below it in a frame.
//
//   /                 the shell with the first module that has a view
//   /?module=<id>     the shell with that module
//
// The look (colours, typography, light or dark) comes from theme.css next to this file,
// served at /shell/theme.css; modules link the same file to share it (see README.md here).

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// project: the project's name; modules: the manifests; active: the id of the module to show.
export function shellPage({ project, modules, active }) {
  const views = modules.filter((m) => m.view)
  const current = views.find((m) => m.id === active) ?? views[0]
  const nav = views.map((m) => `<a href="/?module=${esc(encodeURIComponent(m.id))}"${m === current ? ' aria-current="page"' : ''}>${esc(m.name)}</a>`)
  const main = current
    ? `<iframe class="gw-view" title="${esc(current.name)}" src="/${esc(encodeURIComponent(current.id))}/"></iframe>`
    : '<p class="gw-empty">No module has a view.</p>'
  return `<!doctype html>
<html lang="en">
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
  <nav class="gw-nav" aria-label="Modules">${nav.join('')}</nav>
  <span class="gw-brand">Groundwork</span>
</header>
<main class="gw-main">${main}</main>
</body>
</html>
`
}
