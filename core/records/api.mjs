// @ts-check
// The record store's endpoints, which the core server answers itself (the store is the core's):
//
//   GET /api/records[?type=I]   { records: [StoredRecord] }, in id order
//   GET /api/records/I-5        { record: ShownRecord }: with linkedFrom and the body as safe html;
//                               404 when there is none
//   GET /api/records/core/tech  an id of the Spec (spec-store.mjs): { document: StoredDoc } with its
//                               sections, items and problems; { part: { id, ...SpecPart, documents } };
//                               { section: { ...SpecSection, document } }; { item: { ...SpecItem, document } }
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
    const found = store.spec.find(id)
    if (!found) return send(res, 404, { error: `no record ${id}` }), true
    if (found.kind === 'document') return send(res, 200, { document: found.doc }), true
    if (found.kind === 'part') return send(res, 200, { part: { id, ...found.part, documents: found.documents } }), true
    if (found.kind === 'section') return send(res, 200, { section: { ...found.section, document: found.document } }), true
    return send(res, 200, { item: { ...found.item, document: found.document } }), true
  }
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
