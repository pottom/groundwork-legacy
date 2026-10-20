// The Ideas module as the core server loads it: manifest, view and endpoints.
//
//   GET /ideas/               the kanban (index.html)
//   GET /api/ideas/list       { ideas: [{ id: 'I-12', n, file, version, title, body, author, source, kind,
//                                         impact, effort, status, reason, until, duplicate, links, created, history,
//                                         changes: [{ id: 'C-7', title, status, stage, merged, items, inSpec }],
//                                         marks: ['snooze-passed' | 'stale'] }] };
//                             changes: the changes that name the idea, with their stage, whether merged, and how
//                             many proposed items are in the Spec (store.mjs); marks: computed on each read (marks.mjs)
//   PUT /api/ideas/item/I-12  { base: version, changes: { title?, body?, source?, kind?, impact?, effort?,
//                                status?, reason?, until?, duplicate?, links? } } -> { idea }; 409 { error, idea }
//                             when the file changed since `base`; 400 a wrong value (Rejected needs a
//                             reason, Snoozed a date, Duplicate an idea), or a move to Accepted (code
//                             'accept': that is POST /api/ideas/accept); 404 no such idea; 415 not sent
//                             as application/json (so no other site can post one)
//   POST /api/ideas/accept?id=I-12   { route: 'grilling' | 'ticket', base? } -> { route, idea, change:
//                             { id, title, status, stage, merged, items, inSpec } }: the human accepts the idea, and the core's record
//                             store writes it and the change it opens together (store.accept, as
//                             'human'; core/records/accept.mjs). JSON only (415). Refused: 404 no idea;
//                             400 no such route (code 'bad'); 409 { error, code, idea? }: changed since
//                             `base` (code 'stale', with the idea as it is now), accepted already, or a
//                             half-written change from a broken accept on the other route (code 'state'). The ticket route's
//                             change is implementing at once; the board then copies the prompt for
//                             Claude that writes its ticket (ticket.mjs)
//
// Ideas are records of the core's record store: the manifest declares the type I (`records`,
// store.mjs IDEA_TYPE), with its folder docs/product/ideas/ and its lifecycle, and the store writes
// the files. Ideas itself writes nothing (`writes` is empty). `groundwork ideas add|list|move`
// (ideas.mjs) goes through the same store. The browser is the human and may set every column; the
// command is Claude and only New and Considering (d-ideas-ai-limits), which the store enforces.
// Accepting an idea opens a change (C-6, d-accept-in-core): the endpoint calls the record store's
// accept as the human, and the store lets only this module call it (it declares the ideas).
//
// Live updates (core/events.mjs): an idea file changing is the topic "ideas.items" (and the core's
// "records"); the page then asks /api/ideas/list again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson, isJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { IDEAS, IDEA_TYPE, openIdeas } from './store.mjs'
import { marks } from './marks.mjs'

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
    'view/api.mjs', 'view/drawer.mjs', 'view/reject.mjs', 'view/accept.mjs', 'view/changes.mjs', 'view/matrix.mjs', 'view/tickets.mjs', 'view/links.mjs',
    'ui-strings.mjs', 'fields.mjs', 'matrix.mjs', 'ticket.mjs', 'summary.mjs',
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
    // Each idea as the page gets it: with its quiet marks (marks.mjs), computed now, never written.
    /** @param {any} idea */
    const shown = (idea) => idea && { ...idea, marks: marks(idea, new Date()) }
    return async (req, res, sub, url) => {
      if (sub === '/list') {
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
        return send(res, 200, { ideas: store.list().map(shown) }), true
      }
      if (sub === '/accept') return accept(store, shown, req, res, url), true
      const item = /^\/item\/(I-\d+)$/.exec(sub)
      if (!item) return false
      if (req.method !== 'PUT') return send(res, 405, { error: 'method not allowed' }), true
      // Only a JSON request: another web site cannot send one here without the browser asking first.
      if (!isJson(req)) return send(res, 415, { error: 'send JSON' }), true
      try {
        const { base, changes } = await readJson(req)
        const was = records.get(item[1])
        if (changes?.status === 'accepted' && was && was.fields.status !== 'accepted') {
          return send(res, 400, { error: `${item[1]} is accepted on a route, which opens its change: POST /api/ideas/accept`, code: 'accept' }), true
        }
        send(res, 200, { idea: shown(store.update(item[1], changes ?? {}, { base, by: 'human' })) })
      } catch (e) {
        if (e.code === 'stale') send(res, 409, { error: e.message, idea: shown(store.get(item[1])) })
        else send(res, e.code === 'missing' ? 404 : e.code === 'forbidden' ? 403 : 400, { error: e.message })
      }
      return true
    }
  },
}

// The status of a refusal of accept, by its code; a wrong value of a type's rule is 400.
const REFUSED = { missing: 404, forbidden: 403, bad: 400, stale: 409, state: 409 }

// The human accepts an idea on a route: the record store writes the idea and its new change.
async function accept(store, shown, req, res, url) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
  // Only a JSON request: another web site cannot send one here without the browser asking first.
  if (!isJson(req)) return send(res, 415, { error: 'send JSON' })
  const id = url.searchParams.get('id') ?? ''
  let body
  try { body = (await readJson(req)) ?? {} } catch (e) { return send(res, 400, { error: e.message }) }
  const str = (v) => (typeof v === 'string' ? v : undefined)
  try {
    send(res, 200, store.accept(id, { route: str(body.route), base: str(body.base), by: 'human' }))
  } catch (e) {
    const idea = e.code === 'stale' ? shown(store.get(id)) : undefined
    send(res, REFUSED[e.code] ?? 400, { error: e.message, code: e.code, ...(idea ? { idea } : {}) })
  }
}
