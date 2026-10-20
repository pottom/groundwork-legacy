// @ts-check
// The record store: the core reads, writes, numbers and indexes the case records (ideas; later
// changes and milestones) of every module that declares a type in its manifest's `records` field
// (types.mjs: RecordType). The Markdown under docs/product/ is the source (format.mjs); the store
// keeps only a cache and index under .groundwork/records/, not in git, rebuilt whenever it is
// missing or a file changed.
//
//   const store = openRecords(root, modules, { today? })
//   store.types()                       the declared types
//   store.list(prefix?)                 every record (of one type), in id order: StoredRecord
//   store.get(id)                       one record, or null
//   store.show(id)                      the record with what is computed from all records, never
//                                       stored in a file: links (its link fields' ids, resolved by the
//                                       id's shape: type, name, the declaring module ('core' for the
//                                       core's own), title and file when a declared type has the
//                                       prefix, else a plain id, so a missing module breaks nothing),
//                                       linkedFrom (who refers to it: an idea's changes, a milestone's
//                                       changes), outline (what the type reads from the body, a change's
//                                       proposed items), html (the body, rendered without raw HTML);
//                                       null when there is none
//   store.create(prefix, { fields, body? }, { by?, event?, dry? })   the new record (without a body,
//                                       the type's template's, if it has one; body may be a function
//                                       of the new id); event: the history line's text instead of
//                                       'created'; dry: every check, nothing written
//   store.update(id, { fields?, body? }, { by?, base?, event?, dry? })  the record as written; event:
//                                       a history line's own text, before the lifecycle's ('merged');
//                                       dry: every check, nothing written (the record it would write)
//   store.next(prefix)                  the number a new record of the type would get
//   store.root                          the project folder, absolute
//   store.spec                          the Spec: its documents and parts (spec-store.mjs)
//   store.resolve(id)                   what an id means: a record, a Spec id, an item a pending
//                                       change proposes, or an old id a merged change lists
//                                       (resolve.mjs), or null
//   store.merge(id, { by?, base? })     merges change C-n into the Spec, all or nothing, as the human
//                                       only (merge.mjs); { id, status, documents, items }, or an
//                                       error with code 'merge' and `problems`, one per item at fault
//   store.merged(id)                    whether change C-n is merged, computed from the Spec
//                                       (merge.mjs); null when there is no such change
//   store.waits(id)                     the proposed items of change C-n that wait for another
//                                       pending change to be merged first (d-merge-in-order):
//                                       [{ id, op, target, waitsFor: 'C-3', on }] (merge.mjs)
//   store.targets()                     where a proposed item may move: the Spec's documents and
//                                       sections, then those the pending changes propose (move.mjs)
//   store.move(id, { item, target, by?, base? })   moves a proposed item of change C-n to another
//                                       target, written into the change's file (move.mjs)
//   store.accept(id, { route, by?, base? })   accepts idea I-n: its status and the change it opens,
//                                       written together, all or nothing, as the human only
//                                       (accept.mjs); { route, idea, change }
//   store.forModule(manifest)           the store as a module gets it: reads are global, writes
//                                       only the record types its manifest declares, and the Spec
//                                       only when its `writes` cover docs/product/spec/ (code
//                                       'forbidden' otherwise); merge only for the module that
//                                       declares the changes and may write the Spec, accept only
//                                       for the one that declares the ideas
//
// by is 'human' (the browser) or 'claude' (the command line), and is 'claude' when not given. On
// every write the store enforces the type's lifecycle: Claude moves a record only between the
// states of `lifecycle.claude` (code 'forbidden'); then the type's own rules check the fields. A
// write on an older version than `base` is refused (code 'stale'); an unknown id is code 'missing'.
// A field set to '' or null in `fields` is removed. Every lifecycle or link change appends one
// line to the record's history, `date · by · what`; other edits add none, and the history is kept
// through every rewrite.
//
// Numbers are sequential per prefix and never reused: the next one is above the highest ever seen,
// counting the files, every id the records mention, the cache's high-water mark, and (when the
// cache is gone) record files git saw deleted. The id stands in the front matter, so a renamed
// file keeps it; a file without one takes the number in its name. Only files named like a record
// (I-005-slug.md) are records: other files in the folder are left alone.
//
// Writes go through the core's writer (core/files.mjs), limited to the declared folders and
// .groundwork/records/, so the store writes only under docs/product/ and .groundwork/.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { projectFiles } from '../files.mjs'
import { readRecord, writeRecord, fileName, slugOf } from './format.mjs'
import { renderMarkdown } from './render.mjs'
import { openSpec } from './spec-store.mjs'
import { resolver } from './resolve.mjs'
import { mergeChange, isMerged, waitsOf } from './merge.mjs'
import { moveItem, targetsOf } from './move.mjs'
import { acceptIdea } from './accept.mjs'
import { SPEC_DIR } from './spec-format.mjs'

/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {import('./types.mjs').ShownRecord} ShownRecord */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').FieldValue} FieldValue */
/** @typedef {import('./types.mjs').Actor} Actor */
/** @typedef {import('./types.mjs').ResolvedLink} ResolvedLink */
/**
 * @typedef {Object} Cache
 * @property {number} v
 * @property {Record<string, number>} last     the highest number seen per prefix
 * @property {Record<string, { mtimeMs: number, size: number, record: StoredRecord }>} files
 * @property {Record<string, boolean>} [git]  the prefixes whose numbers git's deleted files were counted for
 */

export const CACHE = '.groundwork/records/index.json'
const CACHE_VERSION = 1
const ID = /^([A-Z]+)-(\d+)$/

/** @param {string} msg @param {string} code */
const fail = (msg, code) => Object.assign(new Error(msg), { code })
/** @param {FieldValue | undefined} v */
const empty = (v) => v == null || (Array.isArray(v) ? v.length === 0 : String(v) === '')
/** @param {FieldValue | undefined} v @returns {string[]} */
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean))

/**
 * @param {string} root
 * @param {Array<{ id: string, records?: RecordType[] }>} modules
 * @param {{ today?: () => string }} [options]
 */
export function openRecords(root, modules, { today = () => new Date().toISOString().slice(0, 10) } = {}) {
  root = path.resolve(root)
  /** @type {RecordType[]} */
  const types = []
  /** @type {Map<string, string>} the module that declares each prefix */
  const owners = new Map()
  for (const m of modules) for (const t of m.records ?? []) {
    const folder = String(t.folder ?? '')
    const norm = path.posix.normalize(folder)
    if (path.isAbsolute(folder) || norm !== folder || !norm.startsWith('docs/product/')) {
      throw new Error(`${m.id}: record type ${t.prefix} must live in a folder under docs/product/, not ${folder}`)
    }
    if (!/^[A-Z]+$/.test(t.prefix)) throw new Error(`${m.id}: a record prefix is capital letters, not ${t.prefix}`)
    if (types.some((o) => o.prefix === t.prefix)) throw new Error(`${m.id}: record type ${t.prefix} is declared twice`)
    types.push(t)
    owners.set(t.prefix, m.id)
  }
  const files = projectFiles(root, [...types.map((t) => t.folder), SPEC_DIR, path.posix.dirname(CACHE)])
  const spec = openSpec(root, files)
  /** @param {string} prefix */
  const typeOf = (prefix) => types.find((t) => t.prefix === prefix)
  /** @param {RecordType} t */
  const named = (t) => new RegExp(`^${t.prefix}-(\\d+)(?:-[^/\\\\]*)?\\.md$`)

  /** @returns {Cache} */
  function loadCache() {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(root, CACHE), 'utf8'))
      if (c?.v === CACHE_VERSION && c.files && c.last) return c
    } catch { /* missing or broken: rebuilt */ }
    return { v: CACHE_VERSION, last: {}, files: {} }
  }
  /** @param {Cache} c */
  function saveCache(c) {
    try { files.write(CACHE, JSON.stringify(c)) } catch { /* a cache that cannot be written is only slower */ }
  }

  /** @param {RecordType} t @param {string} rel @param {string} text @returns {StoredRecord} */
  function parse(t, rel, text) {
    const r = readRecord(text, t)
    const fromName = Number(named(t).exec(path.posix.basename(rel))?.[1])
    const m = r.id ? ID.exec(r.id) : null
    const n = m && m[1] === t.prefix ? Number(m[2]) : fromName
    /** @type {StoredRecord} */
    const rec = { id: `${t.prefix}-${n}`, type: t.prefix, n, file: rel, version: hash(text), fields: r.fields, body: r.body, history: r.history }
    if (r.stray) rec.stray = r.stray
    return rec
  }

  // Every record, read through the cache: a file whose size and time are unchanged is not parsed again.
  function scan() {
    const cache = loadCache()
    let dirty = false
    /** @type {Cache['files']} */
    const seen = {}
    /** @type {StoredRecord[]} */
    const all = []
    for (const t of types) {
      /** @type {string[]} */
      let names = []
      try { names = fs.readdirSync(path.join(root, t.folder)).filter((f) => named(t).test(f)) } catch { /* no folder yet */ }
      for (const name of names) {
        const rel = `${t.folder}/${name}`
        let st
        try { st = fs.statSync(path.join(root, rel)) } catch { continue }
        const hit = cache.files[rel]
        let rec
        if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) rec = hit.record
        else { rec = parse(t, rel, files.read(rel)); dirty = true }
        seen[rel] = { mtimeMs: st.mtimeMs, size: st.size, record: rec }
        all.push(rec)
      }
    }
    if (Object.keys(cache.files).some((f) => !seen[f])) dirty = true
    for (const t of types) {
      const high = Math.max(cache.last[t.prefix] ?? 0, ...all.filter((r) => r.type === t.prefix).map((r) => r.n))
      if (high !== (cache.last[t.prefix] ?? 0) || cache.last[t.prefix] == null) { cache.last[t.prefix] = high; dirty = true }
    }
    cache.files = seen
    if (dirty) saveCache(cache)
    all.sort((a, b) => (a.type === b.type ? a.n - b.n : types.findIndex((t) => t.prefix === a.type) - types.findIndex((t) => t.prefix === b.type)))
    return { all, cache }
  }

  /** @param {string} [prefix] */
  const list = (prefix) => scan().all.filter((r) => !prefix || r.type === prefix)
  /** @param {string} id */
  const get = (id) => list().find((r) => r.id === id) ?? null

  // The next number of a type: above every number the files, the records' text, the cache and git know.
  /** @param {RecordType} t @param {{ all: StoredRecord[], cache: Cache }} state */
  function nextNumber(t, { all, cache }) {
    const mention = new RegExp(`\\b${t.prefix}-(\\d+)\\b`, 'g')
    let high = cache.last[t.prefix] ?? 0
    for (const r of all) {
      if (r.type === t.prefix) high = Math.max(high, r.n)
      const text = [JSON.stringify(r.fields), r.body, ...r.history].join('\n')
      for (const m of text.matchAll(mention)) high = Math.max(high, Number(m[1]))
    }
    if (!cache.git?.[t.prefix]) {
      for (const n of deletedInGit(root, t.folder, named(t))) high = Math.max(high, n)
    }
    return high + 1
  }

  /** @param {RecordType} t @param {Fields} next @param {Fields | null} before @param {string | null} id @param {Actor} by */
  function check(t, next, before, id, by) {
    const { field, states, claude } = t.lifecycle
    const from = before ? String(before[field] ?? t.lifecycle.initial) : null
    const to = String(next[field])
    if (!states.includes(to)) throw new Error(`${field} must be one of ${states.join(', ')}, not ${to}`)
    if (by !== 'human' && from !== to) {
      const who = id ?? `a new ${t.name}`
      if (!claude.includes(to)) throw fail(`only a human moves ${who} to ${to} (in the browser); claude moves a ${t.name} only between ${claude.join(' and ')}`, 'forbidden')
      if (from != null && !claude.includes(from)) throw fail(`${who} is ${from}: only a human takes it out (in the browser)`, 'forbidden')
    }
    const ctx = { before, id, by, today: today(), exists: (/** @type {string} */ ref) => get(ref) != null }
    const out = t.rules ? t.rules(next, ctx) : next
    for (const k of Object.keys(out)) if (empty(out[k])) delete out[k]
    return out
  }

  // What a write changed in the lifecycle and the links, as one history line's text, or ''.
  /** @param {RecordType} t @param {Fields} before @param {Fields} after */
  function event(t, before, after) {
    const parts = []
    const f = t.lifecycle.field
    if (String(before[f] ?? '') !== String(after[f] ?? '')) parts.push(`${f}: ${before[f] ?? t.lifecycle.initial} → ${after[f]}`)
    for (const k of t.links ?? []) {
      const was = asList(before[k]), now = asList(after[k])
      const added = now.filter((x) => !was.includes(x)), gone = was.filter((x) => !now.includes(x))
      const change = [added.length ? `+ ${added.join(', ')}` : '', gone.length ? `− ${gone.join(', ')}` : ''].filter(Boolean).join(' ')
      if (change) parts.push(`${k}: ${change}`)
    }
    return parts.join('; ')
  }

  /** @param {RecordType} t @param {string} rel @param {{ id: string, fields: Fields, body: string, history: string[], stray?: string[] }} rec */
  function save(t, rel, rec) {
    const text = writeRecord(rec, t)
    files.write(rel, text)
    return parse(t, rel, text)
  }

  /**
   * @param {string} prefix
   * @param {{ fields?: Fields, body?: string | ((id: string) => string) }} input  body: or made from the new id
   * @param {{ by?: Actor, event?: string, dry?: boolean }} [opts]
   */
  function create(prefix, { fields = {}, body = '' } = {}, { by = 'claude', event: eventText, dry = false } = {}) {
    const t = typeOf(prefix)
    if (!t) throw fail(`no record type ${prefix}`, 'missing')
    const next = check(t, { ...fields, [t.lifecycle.field]: fields[t.lifecycle.field] || t.lifecycle.initial }, null, null, by)
    const state = scan()
    let n = nextNumber(t, state)
    const slug = slugOf(String(next[t.slugFrom ?? 'title'] ?? ''))
    while (fs.existsSync(path.join(root, t.folder, fileName(t.prefix, n, slug)))) n++
    const rel = `${t.folder}/${fileName(t.prefix, n, slug)}`
    const id = `${t.prefix}-${n}`
    const text = String((typeof body === 'function' ? body(id) : body) ?? '').trim() || (t.template ? t.template(id) : '')
    const history = [`${today()} · ${by} · ${eventText || 'created'}`]
    if (dry) return { id, type: t.prefix, n, file: rel, version: '', fields: next, body: text, history }
    const rec = save(t, rel, { id, fields: next, body: text, history })
    const after = scan()
    after.cache.last[t.prefix] = Math.max(after.cache.last[t.prefix] ?? 0, n)
    after.cache.git = { ...after.cache.git, [t.prefix]: true }
    saveCache(after.cache)
    return rec
  }

  /**
   * @param {string} id
   * @param {{ fields?: Fields, body?: string }} input
   * @param {{ by?: Actor, base?: string, event?: string, dry?: boolean }} [opts]
   */
  function update(id, { fields = {}, body } = {}, { by = 'claude', base, event: eventText, dry = false } = {}) {
    const old = get(id)
    const t = old && typeOf(old.type)
    if (!old || !t) throw fail(`no record ${id}`, 'missing')
    if (base != null && base !== old.version) throw fail(`${id} changed since it was read`, 'stale')
    /** @type {Fields} */
    const merged = { ...old.fields }
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue
      if (empty(v)) delete merged[k]
      else merged[k] = v
    }
    if (empty(merged[t.lifecycle.field])) merged[t.lifecycle.field] = t.lifecycle.initial
    const next = check(t, merged, old.fields, id, by)
    const what = [eventText, event(t, old.fields, next)].filter(Boolean).join('; ')
    const history = what ? [...old.history, `${today()} · ${by} · ${what}`] : old.history
    /** @type {{ id: string, fields: Fields, body: string, history: string[], stray?: string[] }} */
    const rec = { id: old.id, fields: next, body: body !== undefined ? String(body) : old.body, history }
    if (old.stray) rec.stray = old.stray
    if (dry) return { ...old, fields: next, body: rec.body, history }
    return save(t, old.file, rec)
  }

  /** @param {string} id @returns {ShownRecord | null} */
  function show(id) {
    const all = list()
    const rec = all.find((r) => r.id === id)
    if (!rec) return null
    const t = typeOf(rec.type)
    const linkedFrom = all.filter((r) => r.id !== id && (typeOf(r.type)?.links ?? []).some((k) => asList(r.fields[k]).includes(id))).map((r) => r.id)
    /** @type {ShownRecord} */
    const shown = { ...rec, links: resolveLinks(rec, t, all), linkedFrom, html: renderMarkdown(rec.body) }
    if (t?.outline) shown.outline = t.outline(rec.body)
    return shown
  }

  // The links a record writes, each resolved by its id's shape: a plain id unless a declared type
  // has its prefix (a missing module's records, or no record id at all, stay plain).
  /** @param {StoredRecord} rec @param {RecordType | undefined} t @param {StoredRecord[]} all */
  function resolveLinks(rec, t, all) {
    /** @type {ResolvedLink[]} */
    const out = []
    for (const field of t?.links ?? []) for (const ref of asList(rec.fields[field])) {
      /** @type {ResolvedLink} */
      const link = { field, id: ref }
      const of = typeOf(ID.exec(ref)?.[1] ?? '')
      if (of) {
        Object.assign(link, { type: of.prefix, name: of.name, module: owners.get(of.prefix) })
        const target = all.find((r) => r.id === ref)
        if (target) Object.assign(link, { title: String(target.fields.title ?? ''), file: target.file })
      }
      out.push(link)
    }
    return out
  }

  // The number a new record of the type would get (`record renumber` gives it to the newer of two).
  /** @param {string} prefix */
  function next(prefix) {
    const t = typeOf(prefix)
    if (!t) throw fail(`no record type ${prefix}`, 'missing')
    return nextNumber(t, scan())
  }

  const self = {
    root, types: () => [...types], list, get, show, create, update, next, spec, forModule,
    resolve: (/** @type {string} */ id) => resolver(self).resolve(id),
    /** @param {string} id @param {{ by?: Actor, base?: string }} [opts] */
    merge: (id, opts) => mergeChange(self, id, opts),
    /** @param {string} id */
    merged: (id) => isMerged(self, id),
    /** @param {string} id */
    waits: (id) => waitsOf(self, id),
    targets: () => targetsOf(self),
    /** @param {string} id @param {{ item?: string, target?: string, by?: Actor, base?: string }} opts */
    move: (id, opts) => moveItem(self, id, opts),
    /** @param {string} id @param {{ route?: string, by?: Actor, base?: string }} [opts] */
    accept: (id, opts) => acceptIdea({ ...self, discard: (rec) => files.remove(rec.file) }, id, opts),
  }

  // What one module gets: every read, and writes of the record types it declares only; the Spec
  // only when its manifest's `writes` cover the Spec's folder (Plan's). Refused: code 'forbidden'.
  /** @param {{ id: string, records?: RecordType[], writes?: string[] }} m */
  function forModule(m) {
    const own = new Set((m.records ?? []).map((t) => t.prefix))
    /** @param {string} what @returns {never} */
    const deny = (what) => { throw fail(`${m.id} may not write ${what}: a module writes only its own record types (${[...own].join(', ') || 'none'})`, 'forbidden') }
    const writesSpec = (m.writes ?? []).some((w) => { const f = path.posix.normalize(w).replace(/\/$/, ''); return SPEC_DIR === f || SPEC_DIR.startsWith(f + '/') })
    return {
      ...self,
      /** @type {typeof create} */
      create: (prefix, input, opts) => (own.has(prefix) ? create(prefix, input, opts) : deny(`a ${prefix} record`)),
      /** @type {typeof update} */
      update: (id, input, opts) => (own.has(ID.exec(String(id))?.[1] ?? '') ? update(id, input, opts) : deny(String(id))),
      spec: writesSpec ? spec : { ...spec, writeDoc: () => deny('the Spec'), writeMany: () => deny('the Spec') },
      /** @type {typeof self.merge} */
      merge: (id, opts) => (writesSpec && own.has('C') ? self.merge(id, opts) : deny(`the Spec from change ${id}`)),
      /** @type {typeof self.move} */
      move: (id, opts) => (own.has('C') ? self.move(id, opts) : deny(String(id))),
      /** @type {typeof self.accept} */
      accept: (id, opts) => (own.has('I') ? self.accept(id, opts) : deny(`idea ${id} as accepted`)),
    }
  }
  return self
}

/** @param {string} text */
const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)

// The numbers of record files git saw deleted in `folder`, on any branch; none without git.
/** @param {string} root @param {string} folder @param {RegExp} named @returns {number[]} */
function deletedInGit(root, folder, named) {
  let out = ''
  try {
    out = execFileSync('git', ['log', '--all', '--diff-filter=D', '--name-only', '--format=', '--', folder], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 })
  } catch { return [] }
  return out.split(/\r?\n/).map((f) => Number(named.exec(path.posix.basename(f.trim()))?.[1])).filter((n) => n > 0)
}
