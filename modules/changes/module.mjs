// The Changes module as the core server loads it: manifest, view and endpoint (d-changes-module).
//
//   GET /changes/              the list of changes (index.html), grouped by stage
//   GET /changes/?change=C-3   one change's page, with its approval list (the shell's deep link /?module=changes&change=C-3)
//   GET /api/changes/list      { stages: STAGES, changes: [{ id: 'C-3', n, title, status, stage, questions, items, merged,
//                                            ideas: [Chip], milestone: Chip | null }] }, in id order;
//                              Chip: { id, name?, module?, title? } (stages.mjs: changeRow)
//   GET /api/changes/show?id=C-3   one change's page (page.mjs: changePage): every part of its file,
//                              rendered, the marks of what changed since the last commit (the
//                              file at HEAD, since.mjs; null without git or for an uncommitted file),
//                              and `waits`: the items waiting for another change to be merged first
//                              ([{ id, waitsFor: 'C-1', on, title }], store.waits; d-merge-in-order),
//                              and for Elsewhere…: `movable`, `moved` (the old targets since the
//                              commit) and `targets` (store.targets; none once merged);
//                              404 for an id that is no change
//   POST /api/changes/approve?id=C-3   { base? } (the change's version the page shows) ->
//                              { id, status, documents, items }: the human approves the change, and
//                              the core's record store merges it into the Spec (store.merge, as
//                              'human'; core/records/merge.mjs), all or nothing; a change awaiting
//                              approval moves to implementing. JSON only (415 otherwise). Refused:
//                              404 no change; 409 { error, code, problems? }: still grilling (open
//                              questions, code 'state'), done or dropped, already merged, no items,
//                              changed since `base` (code 'stale'), or items at fault (code 'merge',
//                              problems: [{ id, op, target, code, message, waitsFor? }], one per item;
//                              code 'waiting' with waitsFor: 'C-1' for an item that waits for C-1)
//   POST /api/changes/target?id=C-3   { item, target, base? } -> { id, item, from, target, version }:
//                              the human moves a proposed item elsewhere (Elsewhere… on the
//                              approval list; d-move-writes-change): the store writes the new
//                              target into the change's file at once (store.move, as 'human';
//                              core/records/move.mjs), so Claude sees it and it survives a reload.
//                              JSON only (415). Refused: 404 no change or no such item; 400 an
//                              item that does not move (code 'bad') or a target not in the list
//                              or not fitting (code 'target'); 409 done or dropped (code 'state'),
//                              merged, or changed since `base` (code 'stale')
//
// Changes are records of the core's record store: the manifest declares the type C (`records`,
// type.mjs), with its folder docs/product/changes/, and the store writes the files. Approving is the
// module's one write: the store merges the change into the Spec, so `writes` names the Spec's folder
// (store.forModule lets a module merge only then). The Milestone type (M) stays in the core.
// The stage is computed (stages.mjs): open questions → Grilling, none → Awaiting approval; the
// later stages come from the status field until C-5 and C-8.
//
// Live updates (core/events.mjs): a change file changing is the topic "changes.items" (and the
// core's "records", which also covers the ideas and milestones a row names); a commit is the topic
// "changes.commit" (since.mjs: isCommitPath), as it moves the base of the marks. The page then asks
// again for what it shows.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson, isJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { CHANGES } from '../../core/records/changes.mjs'
import { CHANGE_TYPE } from './type.mjs'
import { STAGES, changeRow, stageOf } from './stages.mjs'
import { changePage, baseOf } from './page.mjs'
import { committed, isCommitPath } from './since.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default {
  id: 'changes',
  name: 'Changes',
  tagline: { en: 'What is taking shape', hu: 'Ami most alakul' },
  icon: '<path d="M6 3v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',   // a branch merging
  version: VERSION,   // the package's: one version for Groundwork and its modules
  // The page: a thin index.html and Lit components under view/ (view/main.mjs is the entry).
  view: { dir: HERE, files: ['index.html', 'view/changes.css', 'view/main.mjs', 'view/changes-list.mjs', 'view/change-page.mjs', 'view/target-picker.mjs', 'view/strings.mjs', 'ui-strings.mjs', 'compare.mjs', 'thoughts.mjs'] },
  // The Spec, which approving a change merges into (POST /api/changes/approve): the core's record
  // store writes it, and the change files, for the module (store.forModule: merge).
  writes: ['docs/product/spec'],
  // The record type it brings: the core's record store keeps the changes (core/records/store.mjs).
  records: [CHANGE_TYPE],
  // Nothing another module may read yet (modules/README.md).
  public: [],
  watch: (p) => (p.startsWith(CHANGES + '/') && /^C-\d+[^/]*\.md$/.test(p.slice(CHANGES.length + 1)) ? 'changes.items'
    : isCommitPath(p) ? 'changes.commit' : null),
  api({ root, records }) {
    return async (req, res, sub, url) => {
      if (sub === '/approve') return approve(records, req, res, url), true
      if (sub === '/target') return target(records, req, res, url), true
      if (sub !== '/list' && sub !== '/show') return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
      if (sub === '/show') {
        const id = url.searchParams.get('id') ?? ''
        const shown = /^C-\d+$/.test(id) ? records.show(id) : null
        if (!shown || shown.type !== 'C') return send(res, 404, { error: `no change ${id}` }), true
        const merged = records.merged(id) ?? false
        const waits = records.waits(id).map((/** @type {{ id: string, waitsFor: string, on: string }} */ w) => ({ id: w.id, waitsFor: w.waitsFor, on: w.on, title: String(records.get(w.waitsFor)?.fields.title ?? '') }))
        return send(res, 200, changePage(shown, { base: baseOf(committed(root, shown.file)), merged, waits, targets: merged ? [] : records.targets() })), true
      }
      const changes = records.list('C').flatMap((r) => {
        const shown = records.show(r.id)
        return shown ? [changeRow(shown, { merged: records.merged(r.id) ?? false })] : []
      })
      return send(res, 200, { stages: STAGES, changes }), true
    }
  },
}

// The human approves a change from its page: the record store merges it into the Spec.
/** @param {any} records @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {URL} url */
async function approve(records, req, res, url) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
  // Only a JSON request: another web site cannot send one here without the browser asking first.
  if (!isJson(req)) return send(res, 415, { error: 'send JSON' })
  const id = url.searchParams.get('id') ?? ''
  /** @type {{ base?: unknown }} */
  let body
  try { body = (await readJson(req)) ?? {} } catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : String(e) }) }
  const shown = /^C-\d+$/.test(id) ? records.show(id) : null
  if (!shown || shown.type !== 'C') return send(res, 404, { error: `no change ${id}` })
  const row = changeRow(shown)
  if (stageOf(row.status, row.questions) === 'grilling') return send(res, 409, { error: `${id} still has open questions: it is approved once they are answered`, code: 'state' })
  try {
    const base = typeof body.base === 'string' ? body.base : undefined
    send(res, 200, records.merge(id, { by: 'human', base }))
  } catch (e) {
    const err = /** @type {Error & { code?: string, problems?: unknown[] }} */ (e)
    const code = err.code === 'missing' ? 404 : err.code === 'forbidden' ? 403 : ['merge', 'stale', 'state', 'merged', 'empty'].includes(err.code ?? '') ? 409 : 500
    send(res, code, { error: err.message, code: err.code, ...(err.problems ? { problems: err.problems } : {}) })
  }
}

// The human moves a proposed item to another target from the approval list (Elsewhere…).
/** @param {any} records @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {URL} url */
async function target(records, req, res, url) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' })
  if (!isJson(req)) return send(res, 415, { error: 'send JSON' })
  const id = url.searchParams.get('id') ?? ''
  /** @type {{ item?: unknown, target?: unknown, base?: unknown }} */
  let body
  try { body = (await readJson(req)) ?? {} } catch (e) { return send(res, 400, { error: e instanceof Error ? e.message : String(e) }) }
  const str = (/** @type {unknown} */ v) => (typeof v === 'string' ? v : undefined)
  try {
    send(res, 200, records.move(id, { item: str(body.item) ?? '', target: str(body.target) ?? '', by: 'human', base: str(body.base) }))
  } catch (e) {
    const err = /** @type {Error & { code?: string }} */ (e)
    const code = err.code === 'missing' ? 404 : err.code === 'forbidden' ? 403 : ['bad', 'target'].includes(err.code ?? '') ? 400 : ['stale', 'state', 'merged'].includes(err.code ?? '') ? 409 : 500
    send(res, code, { error: err.message, code: err.code })
  }
}
