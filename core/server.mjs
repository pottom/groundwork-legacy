// The core server: one local server for every module.
//
//   GET  /[?module=<id>]       the shell: header, navigation, the module's view (shell/shell.mjs)
//   GET  /api/modules          the manifests: [{ id, name, version, path }]
//   GET  /api/events           live updates: what changed, as Server-Sent Events (events.mjs)
//   *    /api/<module>/...     the module's endpoints
//   GET  /shell/...            the shared look (theme.css with controls.css and feedback.css, shell.css, the light/dark switch theme.js), the logo and favicon (logo.svg), the UI translation (i18n.mjs, strings.mjs), the live relay (live.mjs), the kept module frames (frames.mjs) and the modules' toasts (toasts.mjs)
//   GET  /vendor/...           the bundled dependencies in core/vendor (libraries, fonts)
//   GET  /<module>/...         the module's view (only the files its manifest lists)
//
// It listens on the loopback only: 127.0.0.1, and ::1 as well where the machine has it, because
// "localhost" (the address it prints and opens) resolves to ::1 first, and a browser that finds
// nothing there waits for its IPv4 fallback on every new connection (~200-300 ms). It answers a
// request whose Host header names any other host with 403, so a web page elsewhere cannot reach
// it through DNS rebinding. Idle connections stay open a minute (KEEP_ALIVE_MS), so a click after
// a pause needs no new one.
//
// A module (see modules/README.md) is a plain object:
//   { id, name, version,
//     view: { dir, files: ['index.html', ...] },           served under /<id>/, index.html at /<id>/
//     writes: ['docs/product', '.groundwork/<id>'],         the folders it may write to
//     watch: (path) => topic | [topic] | null,              optional: the live-update topic of a changed
//                                                          file (path relative to the root, "/"-separated)
//     api: ({ root, files, events }) => (req, res, subpath, url) => handled }   subpath: the path after /api/<id>
// The handler returns (or resolves to) true when it answered, anything else means 404.
// `files` is the module's only way to write: it writes only under `writes` (see files.mjs).
// `events` lets it push a live-update topic itself: events.publish(topic), events.every(ms, fn).

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, sendCached, sendFile, TYPES } from './http.mjs'
import { moduleFiles } from './files.mjs'
import { shellPage } from './shell/shell.mjs'
import { createEvents } from './events.mjs'
import { VERSION } from './version.mjs'
import { projectName } from './project-name.mjs'

export const HOST = '127.0.0.1'
const HOST6 = '::1'
const LOCAL_NAMES = new Set(['127.0.0.1', 'localhost', '[::1]'])
const KEEP_ALIVE_MS = 65000
// What listen() on ::1 fails with on a machine without an IPv6 loopback: then 127.0.0.1 is all there is.
const NO_IPV6 = new Set(['EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EINVAL'])

// The host name of a Host header, without the port: "localhost:4477" -> "localhost", "[::1]:80" -> "[::1]".
function hostName(header = '') {
  const m = /^(\[[^\]]*\]|[^:]*)(?::\d+)?$/.exec(header.trim().toLowerCase())
  return m ? m[1] : ''
}

export function isLocalHost(header) {
  return LOCAL_NAMES.has(hostName(header))
}

export const VENDOR_DIR = fileURLToPath(new URL('./vendor/', import.meta.url))
export const SHELL_DIR = fileURLToPath(new URL('./shell/', import.meta.url))
// The files of core/shell a page may load: the look and the UI translation (not shell.mjs).
const SHELL_BROWSER_FILES = new Set(['theme.css', 'theme.js', 'controls.css', 'feedback.css', 'shell.css', 'i18n.mjs', 'strings.mjs', 'live.mjs', 'frames.mjs', 'toasts.mjs', 'logo.svg'])

// The file under `dir` that the URL path `rest` (still percent-encoded) names, or null when it
// leaves the folder, names a dot file, or has a type the server does not serve (README, LICENSE).
export function staticFile(dir, rest) {
  let rel
  try { rel = decodeURIComponent(rest) } catch { return null }
  if (!rel || rel.includes('\0') || rel.split(/[\\/]/).some((p) => p.startsWith('.'))) return null
  const base = path.resolve(dir)
  const f = path.resolve(base, rel)
  if (!f.startsWith(base + path.sep) || !TYPES[path.extname(f)]) return null
  return fs.statSync(f, { throwIfNoEntry: false })?.isFile() ? f : null
}

// How long the browser keeps a file: cachePolicy in http.mjs (fonts a week, the bundled libraries
// five minutes, anything else is asked for again, a 304 while unchanged). /api/ answers are never kept.

// The first path segments the core answers itself; a module with one of these ids would be hidden.
const RESERVED = new Set(['api', 'shell', 'vendor'])

export async function startServer({ root, modules, port = 4477, vendor = VENDOR_DIR }) {
  for (const m of modules) if (RESERVED.has(m.id)) throw new Error(`module id "${m.id}" is reserved by the core`)
  const events = createEvents({ root: path.resolve(root), modules })
  const mods = modules.map((m) => ({ ...m, handle: m.api ? m.api({ root, files: moduleFiles(root, m), events: events.api }) : null }))
  const byId = new Map(mods.map((m) => [m.id, m]))
  const project = projectName(root)

  const handler = async (req, res) => {
    try {
      if (!isLocalHost(req.headers.host)) return send(res, 403, { error: 'forbidden host' })
      const url = new URL(req.url, 'http://localhost')
      const parts = url.pathname.split('/') // ['', first, ...rest]
      if (url.pathname === '/') {
        return sendCached(req, res, shellPage({ project, version: VERSION, modules: mods, active: url.searchParams.get('module'), params: url.searchParams }), TYPES['.html'])
      }
      if (url.pathname === '/api/modules') {
        return send(res, 200, mods.map(({ id, name, version }) => ({ id, name, version, path: `/${id}/` })))
      }
      if (url.pathname === '/api/events' && req.method === 'GET') return events.stream(req, res)
      if (parts[1] === 'api') {
        const mod = byId.get(parts[2])
        const sub = '/' + parts.slice(3).join('/')
        if (mod?.handle && (await mod.handle(req, res, sub, url)) === true) return
        if (!res.headersSent) send(res, 404, { error: 'not found' })
        return
      }
      if (parts[1] === 'shell' && req.method === 'GET') {
        const f = staticFile(SHELL_DIR, parts.slice(2).join('/'))
        if (f && SHELL_BROWSER_FILES.has(path.basename(f))) return sendFile(req, res, f)
        return send(res, 404, { error: 'not found' })
      }
      if (parts[1] === 'vendor' && req.method === 'GET') {
        const f = staticFile(vendor, parts.slice(2).join('/'))
        if (f) return sendFile(req, res, f, { vendor: true })
        return send(res, 404, { error: 'not found' })
      }
      const mod = byId.get(parts[1])
      if (mod?.view && req.method === 'GET') {
        if (parts.length === 2) { res.writeHead(301, { location: `/${mod.id}/${url.search}` }); return res.end() }
        const file = parts.slice(2).join('/') || 'index.html'
        if (mod.view.files.includes(file)) {
          const f = path.join(mod.view.dir, file)
          return sendFile(req, res, f)
        }
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      if (!res.headersSent) send(res, 500, { error: e.message })
      else res.end()
    }
  }

  const make = () => Object.assign(http.createServer(handler), { keepAliveTimeout: KEEP_ALIVE_MS })
  const server = make()
  const listen = (srv, p, host) => new Promise((resolve, reject) => {
    srv.once('error', reject)
    srv.listen(p, host, () => { srv.off('error', reject); resolve() })
  })
  const shut = (srv) => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r()) })

  await listen(server, port, HOST)
  const address = server.address()
  let server6 = make()
  try {
    await listen(server6, address.port, HOST6)
  } catch (e) {
    server6 = null
    if (!NO_IPV6.has(e.code)) { events.close(); await shut(server); throw e }
  }
  return {
    server, address, port: address.port, url: `http://localhost:${address.port}/`,
    close: async () => { events.close(); await Promise.all([shut(server), server6 && shut(server6)]) },
  }
}
