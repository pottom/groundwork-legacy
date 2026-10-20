// The Changes module as the core server loads it: manifest, view and endpoint (d-changes-module).
//
//   GET /changes/              the list of changes (index.html), grouped by stage
//   GET /changes/?change=C-3   one change's page, read-only (the shell's deep link /?module=changes&change=C-3)
//   GET /api/changes/list      { stages: STAGES, changes: [{ id: 'C-3', n, title, status, stage, questions, items,
//                                            ideas: [Chip], milestone: Chip | null }] }, in id order;
//                              Chip: { id, name?, module?, title? } (stages.mjs: changeRow)
//   GET /api/changes/show?id=C-3   one change's page (page.mjs: changePage): every part of its file,
//                              rendered, and the marks of what changed since the last commit (the
//                              file at HEAD, since.mjs; null without git or for an uncommitted file);
//                              404 for an id that is no change
//
// Changes are records of the core's record store: the manifest declares the type C (`records`,
// type.mjs), with its folder docs/product/changes/, and the store writes the files; the Changes
// module writes nothing itself (`writes` is empty). The Milestone type (M) stays in the core.
// The stage is computed (stages.mjs): open questions → Grilling, none → Awaiting approval; the
// later stages come from the status field until C-5 and C-8.
//
// Live updates (core/events.mjs): a change file changing is the topic "changes.items" (and the
// core's "records", which also covers the ideas and milestones a row names); a commit is the topic
// "changes.commit" (since.mjs: isCommitPath), as it moves the base of the marks. The page then asks
// again for what it shows.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { CHANGES } from '../../core/records/changes.mjs'
import { CHANGE_TYPE } from './type.mjs'
import { STAGES, changeRow } from './stages.mjs'
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
  view: { dir: HERE, files: ['index.html', 'view/changes.css', 'view/main.mjs', 'view/changes-list.mjs', 'view/change-page.mjs', 'view/strings.mjs', 'ui-strings.mjs', 'compare.mjs'] },
  // The Changes module writes nothing itself: the core's record store writes the change files.
  writes: [],
  // The record type it brings: the core's record store keeps the changes (core/records/store.mjs).
  records: [CHANGE_TYPE],
  // Nothing another module may read yet (modules/README.md).
  public: [],
  watch: (p) => (p.startsWith(CHANGES + '/') && /^C-\d+[^/]*\.md$/.test(p.slice(CHANGES.length + 1)) ? 'changes.items'
    : isCommitPath(p) ? 'changes.commit' : null),
  api({ root, records }) {
    return async (req, res, sub, url) => {
      if (sub !== '/list' && sub !== '/show') return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
      if (sub === '/show') {
        const id = url.searchParams.get('id') ?? ''
        const shown = /^C-\d+$/.test(id) ? records.show(id) : null
        if (!shown || shown.type !== 'C') return send(res, 404, { error: `no change ${id}` }), true
        return send(res, 200, changePage(shown, { base: baseOf(committed(root, shown.file)) })), true
      }
      const changes = records.list('C').flatMap((r) => {
        const shown = records.show(r.id)
        return shown ? [changeRow(shown)] : []
      })
      return send(res, 200, { stages: STAGES, changes }), true
    }
  },
}
