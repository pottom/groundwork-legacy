// The core server: one local server for every module.
//
//   GET  /[?module=<id>]       the shell: header, navigation, the module's view (shell/shell.mjs)
//   GET  /api/modules          the manifests: [{ id, name, version, path }]
//   *    /api/<module>/...     the module's endpoints
//   GET  /shell/*.css          the shared look: theme.css (style variables) and shell.css
//   GET  /vendor/...           the bundled dependencies in core/vendor (libraries, fonts)
//   GET  /<module>/...         the module's view (only the files its manifest lists)
//
// It listens on 127.0.0.1 only and answers a request whose Host header names any
// other host with 403, so a web page elsewhere cannot reach it through DNS rebinding.
//
// A module (see modules/README.md) is a plain object:
//   { id, name, version,
//     view: { dir, files: ['index.html', ...] },           served under /<id>/, index.html at /<id>/
//     writes: ['docs/product', '.groundwork/<id>'],         the folders it may write to
//     api: ({ root, files }) => (req, res, subpath, url) => handled }   subpath: the path after /api/<id>
// The handler returns (or resolves to) true when it answered, anything else means 404.
// `files` is the module's only way to write: it writes only under `writes` (see files.mjs).

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, TYPES } from './http.mjs'
import { moduleFiles } from './files.mjs'
import { shellPage } from './shell/shell.mjs'

export const HOST = '127.0.0.1'
const LOCAL_NAMES = new Set(['127.0.0.1', 'localhost'])

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

// The first path segments the core answers itself; a module with one of these ids would be hidden.
const RESERVED = new Set(['api', 'shell', 'vendor'])

export async function startServer({ root, modules, port = 4477, vendor = VENDOR_DIR }) {
  for (const m of modules) if (RESERVED.has(m.id)) throw new Error(`module id "${m.id}" is reserved by the core`)
  const mods = modules.map((m) => ({ ...m, handle: m.api ? m.api({ root, files: moduleFiles(root, m) }) : null }))
  const byId = new Map(mods.map((m) => [m.id, m]))
  const project = path.basename(path.resolve(root))

  const server = http.createServer(async (req, res) => {
    try {
      if (!isLocalHost(req.headers.host)) return send(res, 403, { error: 'forbidden host' })
      const url = new URL(req.url, 'http://localhost')
      const parts = url.pathname.split('/') // ['', first, ...rest]
      if (url.pathname === '/') {
        return send(res, 200, shellPage({ project, modules: mods, active: url.searchParams.get('module') }), TYPES['.html'])
      }
      if (url.pathname === '/api/modules') {
        return send(res, 200, mods.map(({ id, name, version }) => ({ id, name, version, path: `/${id}/` })))
      }
      if (parts[1] === 'api') {
        const mod = byId.get(parts[2])
        const sub = '/' + parts.slice(3).join('/')
        if (mod?.handle && (await mod.handle(req, res, sub, url)) === true) return
        if (!res.headersSent) send(res, 404, { error: 'not found' })
        return
      }
      if (parts[1] === 'shell' && req.method === 'GET') {
        const f = staticFile(SHELL_DIR, parts.slice(2).join('/'))
        if (f?.endsWith('.css')) return send(res, 200, fs.readFileSync(f), TYPES['.css'])
        return send(res, 404, { error: 'not found' })
      }
      if (parts[1] === 'vendor' && req.method === 'GET') {
        const f = staticFile(vendor, parts.slice(2).join('/'))
        if (f) return send(res, 200, fs.readFileSync(f), TYPES[path.extname(f)])
        return send(res, 404, { error: 'not found' })
      }
      const mod = byId.get(parts[1])
      if (mod?.view && req.method === 'GET') {
        if (parts.length === 2) { res.writeHead(301, { location: `/${mod.id}/${url.search}` }); return res.end() }
        const file = parts.slice(2).join('/') || 'index.html'
        if (mod.view.files.includes(file)) {
          const f = path.join(mod.view.dir, file)
          return send(res, 200, fs.readFileSync(f), TYPES[path.extname(f)] || 'application/octet-stream')
        }
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      if (!res.headersSent) send(res, 500, { error: e.message })
      else res.end()
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, HOST, () => {
      const address = server.address()
      resolve({
        server, address, port: address.port, url: `http://localhost:${address.port}/`,
        close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
      })
    })
  })
}
