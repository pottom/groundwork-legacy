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
//                                       stored in a file: linkedFrom (who refers to it), html (the body,
//                                       rendered without raw HTML); null when there is none
//   store.create(prefix, { fields, body? }, { by? })      the new record
//   store.update(id, { fields?, body? }, { by?, base? })  the record as written
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

/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {import('./types.mjs').ShownRecord} ShownRecord */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').FieldValue} FieldValue */
/** @typedef {import('./types.mjs').Actor} Actor */
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
  for (const m of modules) for (const t of m.records ?? []) {
    const folder = String(t.folder ?? '')
    const norm = path.posix.normalize(folder)
    if (path.isAbsolute(folder) || norm !== folder || !norm.startsWith('docs/product/')) {
      throw new Error(`${m.id}: record type ${t.prefix} must live in a folder under docs/product/, not ${folder}`)
    }
    if (!/^[A-Z]+$/.test(t.prefix)) throw new Error(`${m.id}: a record prefix is capital letters, not ${t.prefix}`)
    if (types.some((o) => o.prefix === t.prefix)) throw new Error(`${m.id}: record type ${t.prefix} is declared twice`)
    types.push(t)
  }
  const files = projectFiles(root, [...types.map((t) => t.folder), path.posix.dirname(CACHE)])
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
   * @param {{ fields?: Fields, body?: string }} input
   * @param {{ by?: Actor }} [opts]
   */
  function create(prefix, { fields = {}, body = '' } = {}, { by = 'claude' } = {}) {
    const t = typeOf(prefix)
    if (!t) throw fail(`no record type ${prefix}`, 'missing')
    const next = check(t, { ...fields, [t.lifecycle.field]: fields[t.lifecycle.field] || t.lifecycle.initial }, null, null, by)
    const state = scan()
    let n = nextNumber(t, state)
    const slug = slugOf(String(next[t.slugFrom ?? 'title'] ?? ''))
    while (fs.existsSync(path.join(root, t.folder, fileName(t.prefix, n, slug)))) n++
    const rel = `${t.folder}/${fileName(t.prefix, n, slug)}`
    const rec = save(t, rel, { id: `${t.prefix}-${n}`, fields: next, body: String(body ?? ''), history: [`${today()} · ${by} · created`] })
    const after = scan()
    after.cache.last[t.prefix] = Math.max(after.cache.last[t.prefix] ?? 0, n)
    after.cache.git = { ...after.cache.git, [t.prefix]: true }
    saveCache(after.cache)
    return rec
  }

  /**
   * @param {string} id
   * @param {{ fields?: Fields, body?: string }} input
   * @param {{ by?: Actor, base?: string }} [opts]
   */
  function update(id, { fields = {}, body } = {}, { by = 'claude', base } = {}) {
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
    const what = event(t, old.fields, next)
    const history = what ? [...old.history, `${today()} · ${by} · ${what}`] : old.history
    /** @type {{ id: string, fields: Fields, body: string, history: string[], stray?: string[] }} */
    const rec = { id: old.id, fields: next, body: body !== undefined ? String(body) : old.body, history }
    if (old.stray) rec.stray = old.stray
    return save(t, old.file, rec)
  }

  /** @param {string} id @returns {ShownRecord | null} */
  function show(id) {
    const all = list()
    const rec = all.find((r) => r.id === id)
    if (!rec) return null
    const linkedFrom = all.filter((r) => r.id !== id && (typeOf(r.type)?.links ?? []).some((k) => asList(r.fields[k]).includes(id))).map((r) => r.id)
    return { ...rec, linkedFrom, html: renderMarkdown(rec.body) }
  }

  return { types: () => [...types], list, get, show, create, update }
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
