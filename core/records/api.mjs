// @ts-check
// The record store's endpoints, which the core server answers itself (the store is the core's):
//
//   GET /api/records[?type=I]   { records: [StoredRecord] }, in id order
//   GET /api/records/I-5        { record: ShownRecord }: with links (resolved, or plain ids), linkedFrom,
//                               outline (a change's proposed items) and the body as safe html;
//                               404 when there is none
//   GET /api/records/core/tech  an id of the Spec (spec-store.mjs): { document: StoredDoc } with its
//                               sections, items and problems; { part: { id, ...SpecPart, documents } };
//                               { section: { ...SpecSection, document } }; { item: { ...SpecItem, document } }
//   GET /api/records/d-x        an id a pending change adds: { proposed: { op, id, target, text?,
//                               note?, change: { id, title, status, file } } }
//   GET /api/records/c-core     an old id a merged change lists (resolve.mjs): { alias: { id, to,
//                               change, note } } and, beside it, what `to` resolves to as above
//
// Read only: a module writes its records through its own endpoints, which call the store with
// by: 'human' (the browser is the human). Live updates: a record file or a Spec document
// changing is the topic "records" (recordTopic, which core/events.mjs asks).

import { send } from '../http.mjs'
import { SPEC_DIR } from './spec-format.mjs'

/** @typedef {ReturnType<typeof import('./store.mjs').openRecords>} Store */

/**
 * The handler for /api/records and below: true when it answered.
 * @param {Store} store
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, url: URL) => boolean}
 */
export function recordsApi(store) {
  return (req, res, url) => {
    const m = /^\/api\/records(?:\/([^/]+(?:\/[^/]+)?))?\/?$/.exec(url.pathname)
    if (!m) return false
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
    if (!m[1]) {
      const type = url.searchParams.get('type')
      return send(res, 200, { records: store.list(type ?? undefined).filter((r) => !type || r.type === type) }), true
    }
    let id
    try { id = decodeURIComponent(m[1]) } catch { return send(res, 400, { error: 'bad id' }), true }
    const record = store.show(id)
    if (record) return send(res, 200, { record }), true
    const resolved = store.resolve(id)
    if (!resolved) return send(res, 404, { error: `no record ${id}` }), true
    return send(res, 200, payload(store, resolved)), true
  }
}

/**
 * @param {Store} store
 * @param {import('./resolve.mjs').Resolved} r
 * @returns {Record<string, any>}
 */
function payload(store, r) {
  if (r.kind === 'record') return { record: store.show(r.id) }
  if (r.kind === 'proposed') return { proposed: { ...r.item, change: r.change } }
  if (r.kind === 'alias') return { alias: { id: r.id, to: r.to, change: r.change, note: r.note }, ...(r.target ? payload(store, r.target) : {}) }
  const found = r.found
  if (found.kind === 'document') return { document: found.doc }
  if (found.kind === 'part') return { part: { id: found.id, ...found.part, documents: found.documents } }
  if (found.kind === 'section') return { section: { ...found.section, document: found.document } }
  return { item: { ...found.item, document: found.document } }
}

/**
 * The live topic of a changed file: "records" for a record file of a declared type, else null.
 * @param {Store} store
 * @param {string} rel   relative to the root, '/'-separated
 */
export function recordTopic(store, rel) {
  if (rel.startsWith(SPEC_DIR + '/') && rel.endsWith('.md')) return 'records'
  for (const t of store.types()) {
    if (!rel.startsWith(t.folder + '/')) continue
    const name = rel.slice(t.folder.length + 1)
    if (new RegExp(`^${t.prefix}-\\d+(?:-[^/]*)?\\.md$`).test(name)) return 'records'
  }
  return null
}
