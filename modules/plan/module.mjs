// The Plan module as the core server loads it: manifest, view and endpoints.
//
//   GET /api/plan/map[?v=<version>]  the map, or { same: true } when the browser already has that version
//   PUT /api/plan/map                { base, data }: a browser save made on version `base`, merged
//   GET /api/plan/glossary           { text } of the project's GLOSSARY.md

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { openMap } from './map-store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default {
  id: 'plan',
  name: 'Plan',
  version: '0.1.0',
  view: { dir: HERE, files: ['index.html', 'node-types.mjs', 'documents.mjs'] },
  api({ root }) {
    const store = openMap(root)
    return async (req, res, sub, url) => {
      if (sub === '/glossary' && req.method === 'GET') return send(res, 200, { text: store.glossary() }), true
      if (sub !== '/map') return false
      if (req.method === 'GET') {
        if (!store.exists()) return send(res, 404, { error: `no mindmap.json in ${root}` }), true
        const cur = store.read()
        if (url.searchParams.get('v') === cur.v) return send(res, 200, { v: cur.v, same: true }), true
        return send(res, 200, cur), true
      }
      if (req.method === 'PUT') {
        try {
          const { base, data } = await readJson(req)
          send(res, 200, store.saveFromBrowser(base, data))
        } catch (e) {
          send(res, 400, { error: e.message })
        }
        return true
      }
      return false
    }
  },
}
