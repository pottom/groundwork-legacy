// The Plan module as the core server loads it: manifest, view and endpoints.
//
//   GET /api/plan/map[?v=<version>]  the map, or { same: true } when the browser already has that version
//   PUT /api/plan/map                { base, data }: a browser save made on version `base`, merged;
//                                    409 with the current map when `base` is unknown (nothing saved)
//   GET /api/plan/glossary           { text } of the project's GLOSSARY.md
//
// Live updates (core/events.mjs): the map file changing is the topic "plan.map", the glossary
// "plan.glossary"; the page then asks /api/plan/map again (the documents follow the map).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { openMap } from './map-store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default {
  id: 'plan',
  name: 'Plan',
  version: '0.1.0',
  view: { dir: HERE, files: ['index.html', 'node-types.mjs', 'documents.mjs', 'doc-strings.mjs', 'ui-strings.mjs', 'map-theme.mjs', 'deep-link.mjs'] },
  // The folders Plan may write to: the map and its documents, and its local state.
  writes: ['docs/product', '.groundwork/plan'],
  // Local state from before the move to .groundwork/plan/ (the prd-maker prototype).
  moves: { '.prd-maker': '.groundwork/plan' },
  watch: (p) => (p === 'docs/product/mindmap.json' ? 'plan.map' : p === 'GLOSSARY.md' ? 'plan.glossary' : null),
  api({ root, files }) {
    const store = openMap(root, files)
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
          const saved = store.saveFromBrowser(base, data)
          send(res, saved.stale ? 409 : 200, saved)
        } catch (e) {
          send(res, 400, { error: e.message })
        }
        return true
      }
      return false
    }
  },
}
