// The Plan module as the core server loads it: manifest, view and endpoints.
//
//   GET /api/plan/map[?v=<version>]  the map, or { same: true } when the browser already has that version
//   PUT /api/plan/map                { base, data }: a browser save made on version `base`, merged;
//                                    409 with the current map when `base` is unknown (nothing saved)
//   GET /api/plan/ids[?v=<version>]  { v, ids }: the ids of the map's nodes, or { v, same: true } as above;
//                                    what Build checks the tickets' PRD lines against, without the map
//   GET /api/plan/glossary           { text } of the project's GLOSSARY.md
//
// Live updates (core/events.mjs): the map file changing is the topic "plan.map", the glossary
// "plan.glossary"; the page then asks /api/plan/map again (the documents follow the map).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { openMap } from './map-store.mjs'
import { VERSION } from '../../core/version.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// The ids of the map's nodes, the root first, each before its children.
function nodeIds(map) {
  const ids = []
  const walk = (node) => {
    if (node.id != null) ids.push(String(node.id))
    for (const c of node.children || []) walk(c)
  }
  if (map?.nodeData) walk(map.nodeData)
  return ids
}

export default {
  id: 'plan',
  name: 'Plan',
  tagline: { en: 'Mind map & product docs', hu: 'Gondolattérkép és termékdokumentumok' },
  icon: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7l3.9 3.2M18 7l-3.9 3.2M6 17l3.9-3.2M18 17l-3.9-3.2"/>',   // a map: a centre and four branches
  version: VERSION,   // the package's: one version for Groundwork and its modules
  view: { dir: HERE, files: ['index.html', 'node-types.mjs', 'documents.mjs', 'doc-strings.mjs', 'ui-strings.mjs', 'map-theme.mjs', 'deep-link.mjs'] },
  // The folders Plan may write to: the map and its documents, and its local state.
  writes: ['docs/product', '.groundwork/plan'],
  // Local state from before the move to .groundwork/plan/ (the prd-maker prototype).
  moves: { '.prd-maker': '.groundwork/plan' },
  // `groundwork plan <command>` runs plan.mjs: the skill's tool and the hook.
  cli: path.join(HERE, 'plan.mjs'),
  // What `groundwork init` puts into a project for Claude Code.
  claude: {
    skills: [path.join(HERE, 'skills', 'groundwork-prd-maker')],
    hooks: [{ event: 'UserPromptSubmit', run: 'plan hook' }],   // installed as `<RUNNER> plan hook`
  },
  watch: (p) => (p === 'docs/product/mindmap.json' ? 'plan.map' : p === 'GLOSSARY.md' ? 'plan.glossary' : null),
  api({ root, files }) {
    const store = openMap(root, files)
    return async (req, res, sub, url) => {
      if (sub === '/glossary' && req.method === 'GET') return send(res, 200, { text: store.glossary() }), true
      if (sub === '/ids' && req.method === 'GET') {
        if (!store.exists()) return send(res, 404, { error: `no mindmap.json in ${root}` }), true
        const v = store.version()
        if (url.searchParams.get('v') === v) return send(res, 200, { v, same: true }), true
        return send(res, 200, { v, ids: nodeIds(store.read().data) }), true
      }
      if (sub !== '/map') return false
      if (req.method === 'GET') {
        if (!store.exists()) return send(res, 404, { error: `no mindmap.json in ${root}` }), true
        const v = store.version()
        if (url.searchParams.get('v') === v) return send(res, 200, { v, same: true }), true
        return send(res, 200, store.read()), true
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
