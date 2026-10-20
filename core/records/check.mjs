// @ts-check
// The quality check of the records and the Spec: what `groundwork record check` reports. It needs
// no server and no Groundwork habit, only the Markdown, so it runs as a pre-commit hook or a CI
// step on anyone's machine (d-rec-check).
//
//   const report = checkRecords(store, { known? })
//   report.findings     [{ file, line, rule, text, message }] in file and line order; every one is
//                       an error. rule is 'duplicate' | 'orphan' | 'not-canonical'
//   report.counts       { records, documents }: what was read
//   duplicateNumbers(store)   [{ id, records }]: the record ids more than one file holds (two
//                             branches made the same C-n); `record renumber` fixes them
//   formatFinding(f)    'docs/product/changes/C-002-x.md:2: duplicate: C-2 is also ...'
//
// The rules (RULES, each `(ctx) => Finding[]`):
//   duplicate      one record number in two files; one Spec id in two places (two documents, a
//                  document twice, or a document and a part)
//   orphan         a reference to an id that is not there: a record's link fields (an idea's
//                  links and duplicate, a change's ideas and milestone) naming a record of a
//                  declared type that does not exist; a change's proposed items (their target, and
//                  for `change`/`supersede` the item); a Spec item's origin and superseded-by
//                  naming a change that does not exist. Record ids are checked only for the types
//                  some module declares (without the Ideas module an I-n is not checked); Spec ids
//                  only once the project has a Spec document
//   not-canonical  a line the canonical writer would not write as it is: the Spec reader's problems
//                  (stray, conflict, unclosed, no-mark, no-status, unknown-mark, form), and a
//                  record's lines that differ from writeRecord(readRecord(file)) ('missing' marks
//                  a canonical line the file lacks, at the place it would go)
//   thought map    a change's Thoughts section (changes.mjs, d-map-skill): a first word that looks
//                  like a sign but is none (not-canonical), a `→` to an id the change does not
//                  propose (orphan), and a line thoughtsText would not write (not-canonical: form).
//                  It needs no Spec: the map is the change's own
//
// To add a rule, write a function of the context { store, records, docs, known, lines(file) } that
// returns findings, and append it to RULES. `known(id)` says whether an id is a record or a Spec
// id (a document, a part, a section, an item), an item a pending change proposes, or an old id a
// merged change lists with what it became (resolve.mjs); the `known` option of checkRecords adds
// ids beyond those, and is asked only for ids nothing else knows.

import fs from 'node:fs'
import path from 'node:path'
import { readRecord, writeRecord } from './format.mjs'
import { readChange, readThoughts, thoughtsText, SECTIONS, SIGNS, PARTS_TARGET } from './changes.mjs'
import { resolver } from './resolve.mjs'
import { PARTS_FILE } from './spec-format.mjs'

/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./spec-store.mjs').StoredDoc} StoredDoc */
/** @typedef {import('./spec-format.mjs').SpecItem} SpecItem */
/** @typedef {ReturnType<typeof import('./store.mjs').openRecords>} Store */
/**
 * One error the check reports.
 * @typedef {Object} Finding
 * @property {string} file      relative to the project, '/'-separated
 * @property {number} line      1-based
 * @property {'duplicate' | 'orphan' | 'not-canonical'} rule
 * @property {string} text      the line as it stands in the file ('' when it is missing)
 * @property {string} message   what is wrong
 */
/**
 * What a rule gets.
 * @typedef {Object} CheckContext
 * @property {Store} store
 * @property {StoredRecord[]} records
 * @property {StoredDoc[]} docs
 * @property {(id: string) => boolean} known   a record or Spec id the project has
 * @property {(file: string) => string[]} lines  a file's lines (LF), read once
 */
/** @typedef {(ctx: CheckContext) => Finding[]} Rule */

const RECORD_ID = /^([A-Z]+)-(\d+)$/

/** @param {Store} store @returns {{ id: string, records: StoredRecord[] }[]} */
export function duplicateNumbers(store) {
  /** @type {Map<string, StoredRecord[]>} */
  const by = new Map()
  for (const r of store.list()) by.set(r.id, [...(by.get(r.id) ?? []), r])
  return [...by].filter(([, rs]) => rs.length > 1).map(([id, records]) => ({ id, records }))
}

// The line of a record's front-matter field (`id`, `ideas`), or 1.
/** @param {string[]} lines @param {string} field */
function fieldLine(lines, field) {
  const end = lines.indexOf('---', 1)
  for (let i = 1; i < (end < 0 ? lines.length : end); i++) if (lines[i].startsWith(`${field}:`)) return i + 1
  return 1
}

/** @type {Rule} */
function duplicateRecords({ store, lines }) {
  return duplicateNumbers(store).flatMap(({ id, records }) => records.map((r) => {
    const others = records.filter((o) => o !== r).map((o) => o.file).join(', ')
    const at = fieldLine(lines(r.file), 'id')
    return finding(r.file, at, 'duplicate', lines(r.file)[at - 1] ?? '', `${id} is also ${others}`)
  }))
}

// An id that reads as one of the Spec's: a document (core/tech), a section or an item (t-stack, d-npm).
const SPEC_ID = /^[a-z][\w.-]*(?:\/[a-z][\w.-]*)?$/
/** @param {string} id */
const specShaped = (id) => SPEC_ID.test(id) && /[-/]/.test(id)
/** @param {import('./types.mjs').FieldValue | undefined} v @returns {string[]} */
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : String(v).split(',').map((s) => s.trim()).filter(Boolean))
/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The first line (1-based) that matches, else 1.
/** @param {string[]} lines @param {RegExp} re */
const lineOf = (lines, re) => Math.max(1, lines.findIndex((l) => re.test(l)) + 1)

/** @type {Rule} */
function orphans({ store, records, docs, known, lines }) {
  /** @type {Finding[]} */
  const out = []
  const types = store.types()
  const hasSpec = docs.length > 0
  /** @param {string} id */
  const checkable = (id) => {
    const m = RECORD_ID.exec(id)
    if (m) return types.some((t) => t.prefix === m[1])
    return hasSpec && specShaped(id)
  }
  /** @param {string} file @param {number} at @param {string} message */
  const add = (file, at, message) => out.push(finding(file, at, 'orphan', lines(file)[at - 1] ?? '', message))

  for (const r of records) {
    const t = types.find((x) => x.prefix === r.type)
    for (const field of t?.links ?? []) for (const ref of asList(r.fields[field])) {
      if (checkable(ref) && !known(ref)) add(r.file, fieldLine(lines(r.file), field), `${field} names ${ref}, which is not there`)
    }
    if (r.type !== 'C' || !hasSpec) continue
    const items = /** @type {import('./types.mjs').ProposedItem[]} */ (readChange(r.body).items ?? [])
    for (const it of items) {
      const at = lineOf(lines(r.file), new RegExp(`^\\s*[-*]\\s+${escape(it.op)}\\s+\`?${escape(it.id)}\`?(\\s|$)`))
      if (it.op !== 'add' && !known(it.id)) add(r.file, at, `${it.op} ${it.id}: ${it.id} is not in the Spec`)
      const missing = missingTarget(store, known, it.target)
      if (missing) add(r.file, at, `${it.op} ${it.id} → ${it.target}: ${missing}`)
    }
  }

  // A Spec item names the changes it came from and the one that superseded it.
  for (const d of docs) {
    /** @param {SpecItem[]} items */
    const walk = (items) => {
      for (const it of items) {
        for (const ref of [...it.origin, ...(it.supersededBy ? [it.supersededBy] : [])]) {
          if (checkable(ref) && !known(ref)) add(d.file, lineOf(lines(d.file), new RegExp(`\`${escape(it.id)}\``)), `${it.id || it.topic} names ${ref}, which is not there`)
        }
        walk(it.items)
      }
    }
    walk(d.items)
    for (const s of d.sections) walk(s.items)
  }
  return out
}

// What is wrong with a proposed item's target (`core/tech`, `core/tech#t-stack`, `d-npm`), or ''.
/** @param {Store} store @param {(id: string) => boolean} known @param {string} target */
function missingTarget(store, known, target) {
  if (target === PARTS_TARGET) return ''   // a proposed part: the list in spec/parts.md
  const [doc, anchor] = target.split('#')
  if (!doc || !known(doc)) return `${doc || target} is not in the Spec`
  if (anchor == null) return ''
  const found = store.spec.find(anchor)
  if (found && 'document' in found && typeof found.document === 'string' && found.document === doc) return ''
  if (!found && known(anchor)) return ''   // known elsewhere (a pending change's item)
  return `${anchor} is not in ${doc}`
}

// A Spec id in two places: every line that holds it, in every document (and parts.md for a part).
/** @type {Rule} */
function duplicateSpecIds({ store, lines }) {
  const docs = new Map(store.spec.docs().map((d) => [d.id, d.file]))
  return store.spec.check().duplicates.flatMap(({ id, documents }) => {
    const where = [...new Set(documents)]
    const message = `${id} is used ${where.length > 1 ? `in ${where.join(', ')}` : `${documents.length} times in ${where[0]}`}`
    const mark = new RegExp(`\`${escape(id)}\`|\\{#${escape(id)}[ }]`)
    return where.flatMap((w) => {
      const file = w === 'parts' ? PARTS_FILE : docs.get(w)
      if (!file) return []
      const ls = lines(file)
      return ls.flatMap((l, i) => (mark.test(l) ? [finding(file, i + 1, 'duplicate', l, message)] : []))
    })
  })
}

// The Spec reader's report, and each record's lines that its canonical form would not write.
/** @type {Rule} */
function notCanonical({ store, records, lines }) {
  const problems = store.spec.check().problems.filter((p) => p.why !== 'duplicate')
    .map((p) => finding(p.file, p.line, 'not-canonical', p.text, `${p.why}: ${p.text}`))
  for (const r of records) {
    const t = store.types().find((x) => x.prefix === r.type)
    if (!t) continue
    const input = lines(r.file)
    const text = input.join('\n')
    const rec = readRecord(text, t)
    const canonical = writeRecord({ ...rec, id: rec.id ?? r.id }, t)
    if (canonical === text) continue
    const stray = new Set(rec.stray ?? [])
    const out = canonical.replace(/\n$/, '').split('\n')
    const { inA, inB, at } = alignLines(input, out)
    const end = input.indexOf('---', 1)
    for (let i = 0; i < input.length; i++) {
      if (inA[i] || !input[i].trim()) continue
      const why = i < end && stray.has(input[i]) ? 'stray' : 'form'
      problems.push(finding(r.file, i + 1, 'not-canonical', input[i], `${why}: ${input[i]}`))
    }
    for (let j = 0; j < out.length; j++) {
      if (inB[j] || !out[j].trim()) continue
      problems.push(finding(r.file, at[j] + 1, 'not-canonical', '', `missing: ${out[j]}`))
    }
  }
  return problems
}

// A change's thought map: its signs, its links to the change's proposed items, its form.
const THOUGHTS = SECTIONS.find((s) => s.key === 'thoughts')
const THOUGHTS_HEADINGS = new Set([THOUGHTS?.heading, ...(THOUGHTS?.also ?? [])].map((h) => String(h).toLowerCase()))
/** @type {Rule} */
function thoughtMaps({ records, lines }) {
  /** @type {Finding[]} */
  const out = []
  for (const r of records) {
    if (r.type !== 'C') continue
    const ls = lines(r.file)
    const start = ls.findIndex((l) => THOUGHTS_HEADINGS.has(/^##\s+(.+?)\s*$/.exec(l)?.[1]?.toLowerCase() ?? ''))
    if (start < 0) continue
    let end = ls.findIndex((l, i) => i > start && /^##\s/.test(l))
    if (end < 0) end = ls.length
    const section = ls.slice(start + 1, end)
    const at = (/** @type {number} */ i) => start + 2 + i   // a section line's 1-based line in the file
    const { nodes, unknown } = readThoughts(section.join('\n'))
    for (const u of unknown) out.push(finding(r.file, at(u.line), 'not-canonical', section[u.line], `unknown sign ${u.sign} (the signs: ${Object.keys(SIGNS).join(' ')})`))
    const proposed = new Set(readChange(r.body).items.map((i) => i.id))
    section.forEach((l, i) => {
      const link = /(?:→|->)\s+`?([\w./#-]+)`?\s*$/.exec(l)
      if (link && /^\s*[-*+]\s/.test(l) && !proposed.has(link[1])) out.push(finding(r.file, at(i), 'orphan', l, `→ ${link[1]}: the change proposes no ${link[1]}`))
    })
    const canonical = thoughtsText(nodes).split('\n')
    const { inA } = alignLines(section, canonical)
    const flagged = new Set(unknown.map((u) => u.line))
    section.forEach((l, i) => {
      if (!inA[i] && l.trim() && !flagged.has(i)) out.push(finding(r.file, at(i), 'not-canonical', l, `form: ${l}`))
    })
  }
  return out
}

// Which lines of a and of b a longest common subsequence keeps; at[j]: the index in a where
// b's line j stands or would go (after the a line matched to the last kept b line before it).
/** @param {string[]} a @param {string[]} b */
function alignLines(a, b) {
  const n = a.length, m = b.length, w = m + 1
  const dp = new Int32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
  }
  const inA = new Array(n).fill(false), inB = new Array(m).fill(false), at = new Array(m).fill(0)
  let i = 0, j = 0
  while (j < m) {
    if (i < n && a[i] === b[j]) { inA[i] = inB[j] = true; at[j] = i; i++; j++ }
    else if (i < n && dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++
    else { at[j] = Math.min(i, n); j++ }
  }
  return { inA, inB, at }
}

/** @type {Rule[]} */
export const RULES = [duplicateRecords, duplicateSpecIds, orphans, notCanonical, thoughtMaps]

/**
 * @param {string} file @param {number} line @param {Finding['rule']} rule @param {string} text @param {string} message
 * @returns {Finding}
 */
const finding = (file, line, rule, text, message) => ({ file, line, rule, text, message })

/**
 * @param {Store} store
 * @param {{ known?: (id: string) => boolean }} [options]
 */
export function checkRecords(store, { known: extra } = {}) {
  const records = store.list()
  const docs = store.spec.docs()
  const ids = new Set(records.map((r) => r.id))
  const pending = resolver(store)
  /** @param {string} id */
  const known = (id) => ids.has(id) || store.spec.find(id) != null || pending.proposed.has(id) || pending.aliases.has(id) || (extra ? extra(id) : false)
  /** @type {Map<string, string[]>} */
  const read = new Map()
  /** @param {string} file */
  const lines = (file) => {
    let l = read.get(file)
    if (!l) { l = readText(store, file).split('\n'); read.set(file, l) }
    return l
  }
  const findings = RULES.flatMap((rule) => rule({ store, records, docs, known, lines }))
    .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
  return { findings, counts: { records: records.length, documents: docs.length } }
}

/** @param {Store} store @param {string} file */
function readText(store, file) {
  try { return fs.readFileSync(path.join(store.root, file), 'utf8').replace(/\r\n/g, '\n') } catch { return '' }
}

/** @param {Finding} f */
export const formatFinding = (f) => `${f.file}:${f.line}: ${f.rule}: ${f.message}`
