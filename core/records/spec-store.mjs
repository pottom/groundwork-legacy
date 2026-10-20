// @ts-check
// The Spec in the record store: its documents (docs/product/spec/<part>/<KIND>.md and
// spec/SYSTEM.md) and its parts (spec/parts.md), read and written in their canonical Markdown
// (spec-format.mjs). The store gives it as `store.spec`:
//
//   spec.docs()              every document, the system's first, then by part and kind: StoredDoc
//   spec.doc(id)             one document ('core/tech', 'system'), or null
//   spec.parts()             { lang, parts, human, problems } of spec/parts.md (empty without one)
//   spec.find(id)            where an id of the Spec is: { kind: 'part', part, documents } |
//                            { kind: 'document', doc } | { kind: 'section', section, document } |
//                            { kind: 'item', item, document }; null when no such id
//   spec.check()             { duplicates: [{ id, documents }], problems: [{ file, line, text, why }] }:
//                            ids used twice across the Spec, and every line not in the canonical form
//   spec.writeDoc(doc, { base? })   writes a document in the canonical form; the document as read back
//   spec.writeMany({ docs: [{ doc, base? }], parts?: { lang, parts, human, base? } })
//                            several documents and the list of parts at once, all or nothing: every
//                            one is checked against the others and the rest of the Spec first, and
//                            nothing is written on any error; the documents as read back
//   spec.partsVersion()      the version of spec/parts.md, for writeMany's parts.base
//
// Ids are readable and unique across the whole Spec: a part is its slug (core), a document its part
// and kind (core/tech; the whole system's is system), a section or an item its own id (t-stack,
// d-npm). A write is refused when an id it holds is already used by another document (code
// 'duplicate'), when it drops a superseded item the file holds (code 'superseded': a superseded
// item stays, so an id never means anything else), and when the file changed since version `base`
// was read (code 'stale'). A refusal names where: `id` (the id at fault) and `document` (the
// document's id, or 'parts'). Nothing is cached: the Markdown is read when asked.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { readSpecDoc, writeSpecDoc, readParts, writeParts, docIdOf, docFile, SPEC_DIR, PARTS_FILE } from './spec-format.mjs'

/** @typedef {import('./spec-format.mjs').SpecDoc} SpecDoc */
/** @typedef {import('./spec-format.mjs').SpecItem} SpecItem */
/** @typedef {import('./spec-format.mjs').SpecSection} SpecSection */
/** @typedef {import('./spec-format.mjs').SpecPart} SpecPart */
/** @typedef {import('./spec-format.mjs').Problem} Problem */
/**
 * A document as the store gives it: with the version of its file and the lines that are not canonical.
 * @typedef {SpecDoc & { version: string, problems: Problem[] }} StoredDoc
 */
/**
 * @typedef {{ kind: 'part', part: SpecPart | null, id: string, documents: string[] }
 *   | { kind: 'document', id: string, doc: StoredDoc }
 *   | { kind: 'section', id: string, section: SpecSection, document: string }
 *   | { kind: 'item', id: string, item: SpecItem, document: string }} Found
 */

/** @param {string} msg @param {string} code @param {{ id?: string, document?: string }} [at] */
const fail = (msg, code, at = {}) => Object.assign(new Error(msg), { code, ...at })
/** @param {string} text */
const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)
/** @type {Record<string, number>} */
const KIND_ORDER = { system: 0, prd: 1, tech: 2, service: 3, process: 4, infra: 5, ops: 6, rollout: 7 }

// Every section and item id of a document, in order.
/** @param {SpecDoc} doc @returns {string[]} */
function idsOf(doc) {
  /** @type {string[]} */
  const out = []
  /** @param {SpecItem[]} items */
  const walk = (items) => { for (const it of items) { if (it.id) out.push(it.id); walk(it.items) } }
  walk(doc.items)
  for (const s of doc.sections) { if (s.id) out.push(s.id); walk(s.items) }
  return out
}

/** @param {SpecDoc} doc @returns {string[]} */
function supersededOf(doc) {
  /** @type {string[]} */
  const out = []
  /** @param {SpecItem[]} items */
  const walk = (items) => { for (const it of items) { if (it.id && it.supersededBy) out.push(it.id); walk(it.items) } }
  walk(doc.items)
  for (const s of doc.sections) walk(s.items)
  return out
}

/**
 * @param {string} root
 * @param {{ read: (rel: string) => string, write: (rel: string, text: string) => void }} files   the core's writer
 */
export function openSpec(root, files) {
  /** @param {string} rel @returns {StoredDoc} */
  function load(rel) {
    const text = files.read(rel)
    const { doc, problems } = readSpecDoc(text, { file: rel })
    return { ...doc, version: hash(text), problems }
  }

  /** @returns {StoredDoc[]} */
  function docs() {
    /** @type {string[]} */
    const rels = []
    const dir = path.join(root, SPEC_DIR)
    /** @type {fs.Dirent[]} */
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return [] }
    for (const e of entries) {
      if (e.isFile()) rels.push(`${SPEC_DIR}/${e.name}`)
      else if (e.isDirectory()) {
        try { for (const f of fs.readdirSync(path.join(dir, e.name))) rels.push(`${SPEC_DIR}/${e.name}/${f}`) } catch { /* gone meanwhile */ }
      }
    }
    return rels
      .map((rel) => ({ rel, where: docIdOf(rel) }))
      .filter((x) => x.where && fs.statSync(path.join(root, x.rel), { throwIfNoEntry: false })?.isFile())
      .sort((a, b) => {
        const pa = a.where?.part ?? '', pb = b.where?.part ?? ''
        if (pa !== pb) return pa < pb ? -1 : 1
        return (KIND_ORDER[a.where?.kind ?? ''] ?? 99) - (KIND_ORDER[b.where?.kind ?? ''] ?? 99) || (a.rel < b.rel ? -1 : 1)
      })
      .map((x) => load(x.rel))
  }

  /** @param {string} id */
  const doc = (id) => docs().find((d) => d.id === id) ?? null

  function parts() {
    if (!fs.existsSync(path.join(root, PARTS_FILE))) return { lang: '', parts: [], human: [], problems: [] }
    return readParts(files.read(PARTS_FILE))
  }

  /** @param {string} id @returns {Found | null} */
  function find(id) {
    const all = docs()
    const listed = parts().parts.find((p) => p.slug === id) ?? null
    const ofPart = all.filter((d) => d.part === id).map((d) => d.id)
    if (listed || ofPart.length) return { kind: 'part', id, part: listed, documents: ofPart }
    for (const d of all) {
      if (d.id === id) return { kind: 'document', id, doc: d }
      /** @param {SpecItem[]} items @returns {SpecItem | null} */
      const walk = (items) => { for (const it of items) { if (it.id === id) return it; const c = walk(it.items); if (c) return c } return null }
      const top = walk(d.items)
      if (top) return { kind: 'item', id, item: top, document: d.id }
      for (const s of d.sections) {
        if (s.id === id) return { kind: 'section', id, section: s, document: d.id }
        const it = walk(s.items)
        if (it) return { kind: 'item', id, item: it, document: d.id }
      }
    }
    return null
  }

  function check() {
    const all = docs()
    /** @type {Map<string, string[]>} */
    const places = new Map()
    /** @param {string} id @param {string} where */
    const add = (id, where) => { const p = places.get(id) ?? []; p.push(where); places.set(id, p) }
    const partIds = new Set([...parts().parts.map((p) => p.slug), ...all.map((d) => d.part).filter((p) => p != null)])
    for (const p of partIds) add(/** @type {string} */ (p), 'parts')
    for (const d of all) { add(d.id, d.id); for (const id of idsOf(d)) add(id, d.id) }
    const duplicates = [...places].filter(([, w]) => w.length > 1).map(([id, documents]) => ({ id, documents }))
    const problems = [
      ...parts().problems.map((p) => ({ file: PARTS_FILE, ...p })),
      ...all.flatMap((d) => d.problems.map((p) => ({ file: d.file, ...p }))),
    ]
    return { duplicates, problems }
  }

  /** @returns {string} the version of spec/parts.md ('' without one) */
  const partsVersion = () => (fs.existsSync(path.join(root, PARTS_FILE)) ? hash(files.read(PARTS_FILE)) : '')

  /**
   * Several documents, and the list of parts, written together or not at all: every one is checked
   * first, against the others and against the rest of the Spec, and nothing is written on any error.
   * @param {{ docs?: Array<{ doc: Omit<SpecDoc, 'file' | 'part' | 'kind'> & Partial<SpecDoc>, base?: string }>,
   *   parts?: { lang: string, parts: SpecPart[], human: import('./spec-format.mjs').HumanText[], base?: string } }} input
   * @returns {StoredDoc[]} the documents as read back, in the order given
   */
  function writeMany({ docs: inputs = [], parts: nextParts } = {}) {
    const all = docs()
    /** @type {SpecDoc[]} */
    const nexts = []
    for (const { doc: input, base } of inputs) {
      const file = input.file ?? docFile(input.id)
      const where = docIdOf(file)
      if (!where || where.id !== input.id) throw fail(`a Spec document ${input.id} lives in ${docFile(input.id)} under ${SPEC_DIR}/, not ${file}`, 'bad', { document: input.id })
      if (nexts.some((n) => n.id === input.id)) throw fail(`${input.id} is written twice`, 'bad', { document: input.id })
      const old = all.find((d) => d.id === input.id) ?? null
      if (base != null && old && base !== old.version) throw fail(`${input.id} changed since it was read`, 'stale', { document: input.id })
      nexts.push({ ...input, file, part: where.part, kind: where.kind })
    }
    if (nextParts?.base != null && nextParts.base !== partsVersion()) throw fail('the list of parts changed since it was read', 'stale', { document: 'parts' })
    const after = [...all.filter((d) => !nexts.some((n) => n.id === d.id)), ...nexts]
    const slugs = nextParts ? nextParts.parts.map((p) => p.slug) : parts().parts.map((p) => p.slug)
    const twicePart = slugs.find((s, i) => slugs.indexOf(s) !== i)
    if (twicePart) throw fail(`the part ${twicePart} is listed twice`, 'duplicate', { id: twicePart, document: 'parts' })
    const partIds = new Set([...slugs, ...after.map((d) => d.part).filter((p) => p != null)])
    for (const next of nexts) {
      const ids = idsOf(next)
      const twice = ids.filter((id, i) => ids.indexOf(id) !== i)
      if (twice.length) throw fail(`${next.id} holds ${twice.join(', ')} twice`, 'duplicate', { id: twice[0], document: next.id })
      for (const id of ids) {
        const other = after.find((d) => d.id !== next.id && (d.id === id || idsOf(d).includes(id)))
        if (other) throw fail(`${id} is already used in ${other.id}: an id is unique across the Spec`, 'duplicate', { id, document: next.id })
        if (partIds.has(id)) throw fail(`${id} is a part of the Spec: an id is unique across the Spec`, 'duplicate', { id, document: next.id })
      }
      const old = all.find((d) => d.id === next.id)
      if (old) {
        const keep = new Set(ids)
        const gone = supersededOf(old).filter((id) => !keep.has(id))
        if (gone.length) throw fail(`${gone.join(', ')} superseded: a superseded item stays in the Spec, marked`, 'superseded', { id: gone[0], document: next.id })
      }
    }
    if (nextParts) {
      const ids = new Set(after.flatMap((d) => [d.id, ...idsOf(d)]))
      const clash = slugs.find((s) => ids.has(s))
      if (clash) throw fail(`${clash} is already used in the Spec: an id is unique across the Spec`, 'duplicate', { id: clash, document: 'parts' })
      files.write(PARTS_FILE, writeParts(nextParts))
    }
    for (const next of nexts) files.write(next.file, writeSpecDoc(next))
    return nexts.map((n) => load(n.file))
  }

  /**
   * @param {Omit<SpecDoc, 'file' | 'part' | 'kind'> & Partial<SpecDoc>} input
   * @param {{ base?: string }} [opts]
   * @returns {StoredDoc}
   */
  const writeDoc = (input, { base } = {}) => writeMany({ docs: [{ doc: input, base }] })[0]

  return { docs, doc, parts, partsVersion, find, check, writeDoc, writeMany }
}
