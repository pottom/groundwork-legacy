// @ts-check
// The Change record type (C-n), which the Changes module declares in its manifest (d-changes-module):
// the core's record store keeps the changes like the ideas. Its file and body format are the core's
// (core/records/changes.mjs: changeBody, readChange), because the core reads them as well.
//
//   docs/product/changes/C-007-<slug>.md: id, title, ideas (I-5, …), milestone (M-9), status; a body
//   that reads on its own as a spec (Probléma … Kérdések, Javasolt elemek, Jegyek), then Történet.
//
// States: grilling → awaiting-approval → implementing → done / dropped; Claude moves a change only
// between grilling and awaiting-approval (the human approves, closes and drops). The list shows a
// stage computed from it (stages.mjs).

import { CHANGES, changeBody, readChange, needsTitle } from '../../core/records/changes.mjs'

/** @type {import('../../core/records/types.mjs').RecordType} */
export const CHANGE_TYPE = {
  prefix: 'C',
  name: 'change',
  folder: CHANGES,
  fields: ['title', 'ideas', 'milestone', 'status'],
  lists: ['ideas'],
  links: ['ideas', 'milestone'],
  lifecycle: { field: 'status', states: ['grilling', 'awaiting-approval', 'implementing', 'done', 'dropped'], initial: 'grilling', claude: ['grilling', 'awaiting-approval'] },
  template: (id) => changeBody({}, id),
  outline: (body) => readChange(body),
  rules(next) {
    needsTitle(next, 'change')
    const ideas = next.ideas == null ? [] : Array.isArray(next.ideas) ? next.ideas : String(next.ideas).split(',')
    next.ideas = ideas.map((s) => String(s).trim()).filter(Boolean)
    for (const i of next.ideas) if (!/^I-\d+$/.test(i)) throw new Error(`ideas: a change names ideas by id (I-5), not ${i}`)
    if (next.milestone != null) {
      next.milestone = String(next.milestone).trim()
      if (next.milestone && !/^M-\d+$/.test(next.milestone)) throw new Error(`milestone: a change belongs to at most one milestone (M-9), not ${next.milestone}`)
    }
    return next
  },
}
