// The Ideas module as the core server loads it: manifest, view and endpoints.
//
//   GET /ideas/               the kanban (index.html)
//   GET /api/ideas/list       { ideas: [{ id: 'I-12', n, file, version, title, body, author, source, kind,
//                                         impact, effort, status, reason, until, duplicate, links, created, history }] }
//   PUT /api/ideas/item/I-12  { base: version, changes: { title?, body?, source?, kind?, impact?, effort?,
//                                status?, reason?, until?, duplicate?, links? } } -> { idea }; 409 { error, idea }
//                             when the file changed since `base`; 400 a wrong value (Rejected needs a
//                             reason, Snoozed a date, Duplicate an idea); 404 no such idea; 415 not sent
//                             as application/json (so no other site can post one)
//
// Ideas are records of the core's record store: the manifest declares the type I (`records`,
// store.mjs IDEA_TYPE), with its folder docs/product/ideas/ and its lifecycle, and the store writes
// the files. Ideas itself writes nothing (`writes` is empty). `groundwork ideas add|list|move`
// (ideas.mjs) goes through the same store. The browser is the human and may set every column; the
// command is Claude and only New and Considering (d-ideas-ai-limits), which the store enforces.
// Accepting an idea is a change of status only (a change record comes with C-6).
//
// Live updates (core/events.mjs): an idea file changing is the topic "ideas.items" (and the core's
// "records"); the page then asks /api/ideas/list again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson, isJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { IDEAS, IDEA_TYPE, openIdeas } from './store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default {
  id: 'ideas',
  name: 'Ideas',
  tagline: { en: 'Numbered ideas on a board', hu: 'Számozott ötletek táblán' },
  icon: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',   // a light bulb
  version: VERSION,   // the package's: one version for Groundwork and its modules
  // The page: a thin index.html, its own modules under view/ (lit-html templates; view/main.mjs is the
  // entry), and the modules it shares with the server.
  view: { dir: HERE, files: [
    'index.html', 'view/ideas.css', 'view/main.mjs', 'view/board.mjs', 'view/strings.mjs',
    'view/api.mjs', 'view/drawer.mjs', 'view/reject.mjs', 'view/matrix.mjs', 'view/tickets.mjs', 'view/links.mjs',
    'ui-strings.mjs', 'fields.mjs', 'matrix.mjs', 'ticket.mjs',
  ] },
  // Ideas writes nothing itself: the core's record store writes the idea files.
  writes: [],
  // The record type it brings: the core's record store keeps the ideas (core/records/store.mjs).
  records: [IDEA_TYPE],
  // Nothing another module may read yet (modules/README.md).
  public: [],
  // `groundwork ideas <command>` runs ideas.mjs.
  cli: path.join(HERE, 'ideas.mjs'),
  // `groundwork init` installs this skill: Claude files its side observations as ideas through the CLI.
  claude: { skills: [path.join(HERE, 'skills', 'groundwork-ideas')] },
  watch: (p) => (p.startsWith(IDEAS + '/') && /^I-\d+[^/]*\.md$/.test(p.slice(IDEAS.length + 1)) ? 'ideas.items' : null),
  api({ records }) {
    const store = openIdeas(records)
    return async (req, res, sub) => {
      if (sub === '/list') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
        return send(res, 200, { ideas: store.list() }), true
      }
      const item = /^\/item\/(I-\d+)$/.exec(sub)
      if (!item) return false
      if (req.method !== 'PUT') return send(res, 405, { error: 'method not allowed' }), true
      // Only a JSON request: another web site cannot send one here without the browser asking first.
      if (!isJson(req)) return send(res, 415, { error: 'send JSON' }), true
      try {
        const { base, changes } = await readJson(req)
        send(res, 200, { idea: store.update(item[1], changes ?? {}, { base, by: 'human' }) })
      } catch (e) {
        if (e.code === 'stale') send(res, 409, { error: e.message, idea: store.list().find((i) => i.id === item[1]) })
        else send(res, e.code === 'missing' ? 404 : e.code === 'forbidden' ? 403 : 400, { error: e.message })
      }
      return true
    }
  },
}
