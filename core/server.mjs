// The core server: one local server for every module.
//
//   GET  /                     start page, links every module
//   GET  /api/modules          the manifests: [{ id, name, version, path }]
//   *    /api/<module>/...     the module's endpoints
//   GET  /<module>/...         the module's view (only the files its manifest lists)
//
// It listens on 127.0.0.1 only and answers a request whose Host header names any
// other host with 403, so a web page elsewhere cannot reach it through DNS rebinding.
//
// A module (see modules/README.md) is a plain object:
//   { id, name, version,
//     view: { dir, files: ['index.html', ...] },           served under /<id>/, index.html at /<id>/
//     api: ({ root }) => (req, res, subpath) => handled }   subpath: the path after /api/<id>
// The handler returns (or resolves to) true when it answered, anything else means 404.

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { send, TYPES } from './http.mjs'

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

export function startServer({ root, modules, port = 4477 }) {
  const mods = modules.map((m) => ({ ...m, handle: m.api ? m.api({ root }) : null }))
  const byId = new Map(mods.map((m) => [m.id, m]))

  const server = http.createServer(async (req, res) => {
    try {
      if (!isLocalHost(req.headers.host)) return send(res, 403, { error: 'forbidden host' })
      const url = new URL(req.url, 'http://localhost')
      const parts = url.pathname.split('/') // ['', first, ...rest]
      if (url.pathname === '/') return send(res, 200, startPage(mods), TYPES['.html'])
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

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function startPage(mods) {
  const items = mods.filter((m) => m.view).map((m) => `<li><a href="/${esc(m.id)}/">${esc(m.name)}</a> <small>${esc(m.version)}</small></li>`)
  return `<!doctype html><meta charset="utf-8"><title>Groundwork</title>
<style>body{font:16px system-ui,sans-serif;margin:3rem;color-scheme:light dark}</style>
<h1>Groundwork</h1><ul>${items.join('')}</ul>\n`
}
