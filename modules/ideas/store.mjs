// The ideas, as records of the core's record store (core/records/store.mjs). IDEA_TYPE is the record
// type the manifest declares (`records`); the store reads, numbers and writes the files, enforces the
// lifecycle and keeps each idea's history. Each idea is one Markdown file under docs/product/ideas/,
// I-012-<slug>.md: its id and fields in the front matter, its description below, its history at the
// end. Other files in that folder are not ideas (Plan's documents live in the Spec, docs/product/spec/).
//
//   const ideas = openIdeas(records)   // records: the core's store (api({ records }), or openRecords)
//   ideas.list()          [{ id: 'I-12', n: 12, file, version, title, body, author, source, kind, status,
//                            created, impact?, effort?, rationale?, reason?, until?, duplicate?,
//                            links: ['I-3', '#42'], history: ['2026-10-20 · human · created'],
//                            changes: [{ id: 'C-7', title, status, stage, merged, items, inSpec }] }]
//                         in number order; [] without the folder. changes: the changes that name the
//                         idea (opened when it was accepted), computed on each read; [] without the
//                         Changes module. stage: the one the Changes page shows (core/records/stage.mjs:
//                         open questions → grilling, none → awaiting-approval, later ones the status);
//                         items: how many items it proposes, inSpec: how many of them are in the Spec,
//                         merged: all of them (the core's store.inSpec, the check of store.merged)
//   ideas.get(id)         one idea as list() gives it, with only its own changes; null when there is none
//   ideas.add({ title, body?, author?, source?, kind?, impact?, effort?, rationale?, links? }, { by? })
//                         the new idea, as list() gives it. impact and effort: low|medium|high, with a
//                         one-line rationale; links: numbers of existing ideas it is similar to.
//   ideas.update(id, { title?, body?, source?, kind?, impact?, effort?, rationale?, status?, reason?,
//                      until?, duplicate?, links? }, { base?, by? })
//                         the changed idea; throws on an unknown value, on a status without the field
//                         it needs (Rejected a reason, Snoozed until a date, Duplicate an existing idea),
//                         on an unknown id (code 'missing'), on a move Claude may not make (code
//                         'forbidden') and, when `base` is not the file's current `version`, without
//                         writing (code 'stale'): someone else saved in between. The board accepts
//                         through accept, below (the endpoint refuses a move to Accepted)
//   ideas.accept(id, { route, base?, by? })
//                         { route, idea, change }: the idea accepted and the change it opens (as in
//                         changes), by the core's record store (store.accept, all or nothing,
//                         the human only; core/records/accept.mjs); route: grilling | ticket (ROUTES)
//
// by: 'human' (the browser) or 'claude' (the command line, and the default). Claude moves an idea
// only between New and Considering (CLI_STATUSES, d-ideas-ai-limits); the store refuses the rest.

import path from 'node:path'
import { STATUSES, AUTHORS, KINDS, LEVELS, CLI_STATUSES, STATE_FIELDS } from './fields.mjs'
import { changeStage } from '../../core/records/stage.mjs'
import { allIn } from '../../core/records/merge.mjs'

export const IDEAS = 'docs/product/ideas'
// What an edit may change: everything but the number, the author and the date.
const EDITABLE = ['title', 'source', 'kind', 'impact', 'effort', 'rationale', 'links', 'status', 'reason', 'until', 'duplicate']
const LINES = ['title', 'source', 'rationale', 'reason', 'impact', 'effort', 'until', 'duplicate']
// A value as one line: whitespace and line breaks collapse to single spaces.
const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()


function check(name, v, allowed) {
  if (!allowed.includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')}, not ${v}`)
}

// The checks and tidying of every write of an idea (the record store calls it).
function rules(next, { before, id, today, exists }) {
  for (const k of LINES) if (next[k] != null) next[k] = line(next[k])
  if (!next.title) throw new Error('an idea needs a title')
  if (!before) {
    next.author ||= 'human'
    next.kind ||= 'product'
    next.created ||= today
    check('author', next.author, AUTHORS)
  }
  if (next.kind) check('kind', next.kind, KINDS)
  for (const k of ['impact', 'effort']) if (next[k]) check(k, next[k], LEVELS)
  if (next.links != null) {
    if (!Array.isArray(next.links)) throw new Error('links must be a list')
    next.links = next.links.map((l) => String(l).replace(/,/g, ' ').trim()).filter(Boolean)
    if (!before) for (const l of next.links) if (!exists(l)) throw new Error(`no idea ${l} to link to`)
  }
  for (const [status, field] of Object.entries(STATE_FIELDS)) if (next.status !== status) delete next[field]
  if (next.status === 'rejected' && !next.reason) throw new Error('rejecting an idea needs a reason')
  if (next.status === 'snoozed' && !/^\d{4}-\d\d-\d\d$/.test(next.until ?? '')) throw new Error('snoozing an idea needs until: a date (YYYY-MM-DD)')
  if (next.status === 'duplicate') {
    const of = next.duplicate ?? ''
    if (!/^I-\d+$/.test(of)) throw new Error('a duplicate idea needs duplicate: the idea it repeats (I-n)')
    if (of === id) throw new Error(`${id} cannot be a duplicate of itself`)
    if (!exists(of)) throw new Error(`no idea ${of} to be a duplicate of`)
  }
  return next
}

// The record type the Ideas manifest declares.
export const IDEA_TYPE = {
  prefix: 'I',
  name: 'idea',
  folder: IDEAS,
  fields: ['title', 'author', 'source', 'kind', 'impact', 'effort', 'rationale', 'links', 'status', 'reason', 'until', 'duplicate', 'created'],
  lists: ['links'],
  links: ['links', 'duplicate'],
  lifecycle: { field: 'status', states: STATUSES, initial: 'new', claude: CLI_STATUSES },
  rules,
}

export function openIdeas(records) {
  const toIdea = (r) => ({
    ...r.fields, id: r.id, n: r.n, file: r.file, version: r.version,
    title: r.fields.title || path.posix.basename(r.file), status: STATUSES.includes(r.fields.status) ? r.fields.status : 'new',
    links: r.fields.links ?? [], body: r.body, history: r.history,
  })

  // A change as an idea's card shows it, computed by the core on each read: its stage (the one the
  // Changes page shows), whether it is merged, and how many of its proposed items are in the Spec.
  const changeRow = (c) => {
    const { items = 0, inSpec = 0 } = records.inSpec?.(c.id) ?? {}
    return {
      id: c.id, title: c.fields.title ?? '', status: c.fields.status ?? '', stage: changeStage(c).stage,
      merged: allIn({ items, inSpec }), items, inSpec,
    }
  }

  // The changes that name each idea, from the change records (none without the Changes module).
  const changesById = () => {
    const by = new Map()
    for (const c of records.list('C')) for (const i of [c.fields.ideas ?? []].flat()) {
      by.set(i, [...(by.get(i) ?? []), changeRow(c)])
    }
    return by
  }
  // One idea's changes only: no pass over every idea's (each change counts its items in the Spec).
  const changesOfIdea = (id) => records.list('C').filter((c) => [c.fields.ideas ?? []].flat().includes(id)).map(changeRow)
  const get = (id) => {
    const r = /^I-\d+$/.test(String(id)) ? records.get(id) : null
    return r && r.type === 'I' ? { ...toIdea(r), changes: changesOfIdea(id) } : null
  }
  const list = () => {
    const changes = changesById()
    return records.list('I').map((r) => ({ ...toIdea(r), changes: changes.get(r.id) ?? [] }))
  }

  function update(id, changes = {}, { base, by } = {}) {
    if (!/^I-\d+$/.test(String(id))) throw Object.assign(new Error(`no idea ${id}`), { code: 'missing' })
    const fields = {}
    for (const k of EDITABLE) if (changes[k] !== undefined) fields[k] = changes[k] ?? ''
    const body = changes.body !== undefined ? String(changes.body ?? '') : undefined
    try {
      const saved = toIdea(records.update(id, { fields, body }, { base, by }))
      return { ...saved, changes: changesOfIdea(id) }
    } catch (e) {
      if (e.code === 'missing') e.message = `no idea ${id}`
      throw e
    }
  }

  function add({ title, body = '', author, source, kind, impact, effort, rationale, links = [] } = {}, { by } = {}) {
    if (impact != null) check('impact', impact, LEVELS)
    if (effort != null) check('effort', effort, LEVELS)
    const fields = { title: line(title), author, source, kind, impact, effort, rationale, links: links.length ? [...links] : undefined }
    for (const k of Object.keys(fields)) if (fields[k] == null) delete fields[k]
    return toIdea(records.create('I', { fields, body: String(body ?? '') }, { by }))
  }

  function accept(id, { route, base, by } = {}) {
    const out = records.accept(id, { route, base, by })
    return { route: out.route, idea: { ...toIdea(out.idea), changes: changesOfIdea(id) }, change: changeRow(out.change) }
  }

  return { list, get, add, update, accept }
}
