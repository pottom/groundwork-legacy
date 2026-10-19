// The Plan module as the core server loads it: manifest, view and endpoints.
//
//   GET /api/plan/map[?v=<version>]  the map, or { same: true } when the browser already has that version
//   PUT /api/plan/map                { base, data }: a browser save made on version `base`, merged;
//                                    409 with the current map when `base` is unknown (nothing saved)
//   GET /api/plan/ids[?v=<version>]  { v, ids }: the ids of the map's nodes, or { v, same: true } as above;
//                                    what Build checks the tickets' PRD lines against, without the map
//   GET /api/plan/glossary           { text } of the project's GLOSSARY.md
//   POST /api/plan/todo              { idea: 'I-12', title, status?: 'todo'|'excluded', reason? } -> { id, added }:
//                                    an idea from the Ideas module as a node linked to it (todo.mjs);
//                                    400 a wrong body, 404 no map, 415 not sent as application/json
//                                    (so no other web site can post one)
//
// Live updates (core/events.mjs): the map file changing is the topic "plan.map", the glossary
// "plan.glossary"; the page then asks /api/plan/map again (the documents follow the map).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { openMap, nodeIds } from './map-store.mjs'
import { addIdea } from './todo.mjs'
import { VERSION } from '../../core/version.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// A GET of the map, or of what is made from it: 404 without a map; { v, same: true } when the
// browser already has version ?v=; else answer({ v, data }). The version and the answer come from
// one read of the file, so they always belong together.
function sendFromMap(store, root, res, url, answer) {
  if (!store.exists()) return send(res, 404, { error: `no mindmap.json in ${root}` })
  const map = store.read()
  if (url.searchParams.get('v') === map.v) return send(res, 200, { v: map.v, same: true })
  send(res, 200, answer(map))
}

export default {
  id: 'plan',
  name: 'Plan',
  tagline: { en: 'Mind map & product docs', hu: 'Gondolattérkép és termékdokumentumok' },
  icon: '<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7l3.9 3.2M18 7l-3.9 3.2M6 17l3.9-3.2M18 17l-3.9-3.2"/>',   // a map: a centre and four branches
  version: VERSION,   // the package's: one version for Groundwork and its modules
  // The page: a thin index.html, its own modules under view/ (lit-html templates; view/main.mjs is the
  // entry), and the modules it shares with the server and the tests.
  view: { dir: HERE, files: [
    'index.html', 'view/plan.css', 'view/map.css',
    'view/main.mjs', 'view/state.mjs', 'view/strings.mjs', 'view/icons.mjs', 'view/data.mjs', 'view/map.mjs', 'view/focus.mjs',
    'view/chrome.mjs', 'view/toolbar.mjs', 'view/legend.mjs', 'view/dock.mjs', 'view/document.mjs', 'view/editor.mjs',
    'node-types.mjs', 'documents.mjs', 'doc-strings.mjs', 'ui-strings.mjs', 'map-theme.mjs', 'deep-link.mjs', 'view-rules.mjs', 'markdown.mjs',
  ] },
  // The folders Plan may write to: the map and its documents, and its local state.
  writes: ['docs/product', '.groundwork/plan'],
  // What another module may use (modules/README.md): the map's ids, for Build's PRD checks; and the
  // one write another module may ask for, an idea as a node, for Ideas.
  public: ['GET /api/plan/ids', 'POST /api/plan/todo'],
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
      if (sub === '/ids' && req.method === 'GET') return sendFromMap(store, root, res, url, ({ v, data }) => ({ v, ids: nodeIds(data) })), true
      if (sub === '/todo') {
        if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' }), true
        // Only a JSON request: another web site cannot send one here without the browser asking first.
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return send(res, 415, { error: 'send JSON' }), true
        if (!store.exists()) return send(res, 404, { error: `no mindmap.json in ${root}` }), true
        try {
          send(res, 200, addIdea(store, await readJson(req)))
        } catch (e) {
          send(res, e.code === 'bad' || e instanceof SyntaxError ? 400 : 500, { error: e.message })
        }
        return true
      }
      if (sub !== '/map') return false
      if (req.method === 'GET') return sendFromMap(store, root, res, url, (map) => map), true
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
