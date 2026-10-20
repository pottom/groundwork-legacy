// @ts-check
// The record store's endpoints, which the core server answers itself (the store is the core's):
//
//   GET /api/records[?type=I]   { records: [StoredRecord] }, in id order
//   GET /api/records/I-5        { record: ShownRecord }: with linkedFrom and the body as safe html;
//                               404 when there is none
//
// Read only: a module writes its records through its own endpoints, which call the store with
// by: 'human' (the browser is the human). Live updates: a record file changing is the topic
// "records" (recordTopic, which core/events.mjs asks).

import { send } from '../http.mjs'

/** @typedef {ReturnType<typeof import('./store.mjs').openRecords>} Store */

/**
 * The handler for /api/records and below: true when it answered.
 * @param {Store} store
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, url: URL) => boolean}
 */
export function recordsApi(store) {
  return (req, res, url) => {
    const m = /^\/api\/records(?:\/([^/]+))?\/?$/.exec(url.pathname)
    if (!m) return false
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
    if (!m[1]) {
      const type = url.searchParams.get('type')
      return send(res, 200, { records: store.list(type ?? undefined).filter((r) => !type || r.type === type) }), true
    }
    const record = store.show(decodeURIComponent(m[1]))
    if (!record) return send(res, 404, { error: `no record ${m[1]}` }), true
    return send(res, 200, { record }), true
  }
}

/**
 * The live topic of a changed file: "records" for a record file of a declared type, else null.
 * @param {Store} store
 * @param {string} rel   relative to the root, '/'-separated
 */
export function recordTopic(store, rel) {
  for (const t of store.types()) {
    if (!rel.startsWith(t.folder + '/')) continue
    const name = rel.slice(t.folder.length + 1)
    if (new RegExp(`^${t.prefix}-\\d+(?:-[^/]*)?\\.md$`).test(name)) return 'records'
  }
  return null
}
