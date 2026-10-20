// @ts-check
// Merging a change into the Spec (C-5: d-merge-in-core, d-merge-atomic, d-approve-implements,
// d-merge-implementing, d-idea-dissolves, d-merged-computed). The store gives it as store.merge
// and store.merged:
//
//   mergeChange(store, 'C-5', { by, base? }) -> { id, status, documents, items }
//       writes the change's proposed items into the Spec, in the file's order:
//         add        a new part (target `parts`: `Name · type · description`), a document (target
//                    its part: the text its title, the note its prose), a section (target a
//                    document, a text without marks: the title, the note its prose), or an item
//                    (target `<document>#<section or parent item>`, or a document for one before
//                    its first section): the text's marks (`· döntés · hiányzik`) are its status
//                    and implementation, the note its note, its origin this change
//        change      the new wording of an item (topic, marks, and the note when it has one; it
//                    stays where it is), with this change appended to its origin (`· C-1, C-7`);
//                    of a section or a document, its title and prose; of a part, its line
//        supersede   the item's `felváltotta: C-n` mark; it stays in the Spec
//       All or nothing: every write is put together on a copy of the Spec and checked first (a
//       target not there, an id already in the Spec, an id to change that is not there, an item
//       already superseded; then the Spec writer's own refusals: an id used elsewhere, a document
//       changed meanwhile, a superseded item dropped), and nothing is written on any error. Then
//       the change moves to implementing (one already implementing stays), with the history line
//       `merged` for the human. Refused, with the code:
//         forbidden   by is not 'human': Claude (the command line) never merges
//         missing     no change with that id          stale    the change changed since `base`
//         state       a change done or dropped        merged   already merged
//         empty       no proposed items               merge    the items at fault: `problems`,
//                     [{ id, op, target, code, message }], one per proposed item, in the file's
//                     order (code: target, duplicate, missing, superseded, bad, stale)
//   isMerged(store, 'C-5') -> boolean | null
//       computed, never stored: every proposed item is in the Spec with this change in its origin
//       (a superseded one marked by it; a part, document or section is there); false for a change
//       without items, null for no change

import { readChange, PARTS_TARGET } from './changes.mjs'
import { itemTextOf, docIdOf, docFile } from './spec-format.mjs'
import { DEFAULT_DOC_LANG } from './doc-strings.mjs'

/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('./spec-format.mjs').SpecDoc} SpecDoc */
/** @typedef {import('./spec-format.mjs').SpecItem} SpecItem */
/** @typedef {import('./spec-format.mjs').SpecSection} SpecSection */
/** @typedef {import('./spec-format.mjs').SpecPart} SpecPart */
/** @typedef {import('./spec-store.mjs').StoredDoc} StoredDoc */
/** @typedef {import('./types.mjs').Actor} Actor */
/**
 * What is wrong with one proposed item: the page shows it next to the item's row.
 * @typedef {{ id: string, op: string, target: string, code: string, message: string }} MergeProblem
 */
/**
 * What merge needs of the store.
 * @typedef {{
 *   get: (id: string) => import('./types.mjs').StoredRecord | null,
 *   update: (id: string, input: { fields?: Record<string, any> }, opts: { by: Actor, event?: string }) => import('./types.mjs').StoredRecord,
 *   spec: {
 *     docs: () => StoredDoc[],
 *     parts: () => { lang: string, parts: SpecPart[], human: import('./spec-format.mjs').HumanText[] },
 *     partsVersion: () => string,
 *     writeMany: (input: { docs?: Array<{ doc: SpecDoc, base?: string }>, parts?: { lang: string, parts: SpecPart[], human: import('./spec-format.mjs').HumanText[], base?: string } }) => StoredDoc[],
 *   },
 * }} StoreLike
 */
/**
 * Where an id is in a working copy of the Spec.
 * @typedef {{ kind: 'part', part: SpecPart | null }
 *   | { kind: 'document', doc: SpecDoc }
 *   | { kind: 'section', section: SpecSection, doc: SpecDoc }
 *   | { kind: 'item', item: SpecItem, doc: SpecDoc }} Place
 */

const CLOSED = ['done', 'dropped']

/** @param {string} msg @param {string} code @param {object} [more] */
const fail = (msg, code, more = {}) => Object.assign(new Error(msg), { code, ...more })

// A working copy of the Spec: its documents by id and its parts, and where an id is in them.
/** @param {StoreLike['spec']} spec */
function workingSpec(spec) {
  const stored = spec.docs()
  /** @type {Map<string, SpecDoc>} */
  const docs = new Map(stored.map((d) => {
    const { version, problems, ...doc } = structuredClone(d)
    return [d.id, doc]
  }))
  const versions = new Map(stored.map((d) => [d.id, d.version]))
  const list = spec.parts()
  const parts = { lang: list.lang, parts: structuredClone(list.parts), human: structuredClone(list.human) }

  /** @param {string} id @returns {Place | null} */
  function locate(id) {
    const listed = parts.parts.find((p) => p.slug === id) ?? null
    if (listed || [...docs.values()].some((d) => d.part === id)) return { kind: 'part', part: listed }
    for (const doc of docs.values()) {
      const at = locateIn(doc, id)
      if (at) return at
    }
    return null
  }
  return { docs, versions, parts, locate }
}

/** @param {SpecDoc} doc @param {string} id @returns {Place | null} */
function locateIn(doc, id) {
  if (doc.id === id) return { kind: 'document', doc }
  /** @param {SpecItem[]} items @returns {SpecItem | null} */
  const walk = (items) => { for (const it of items) { if (it.id === id) return it; const c = walk(it.items); if (c) return c } return null }
  const top = walk(doc.items)
  if (top) return { kind: 'item', item: top, doc }
  for (const s of doc.sections) {
    if (s.id === id) return { kind: 'section', section: s, doc }
    const it = walk(s.items)
    if (it) return { kind: 'item', item: it, doc }
  }
  return null
}

/** @param {Place} p */
const whereOf = (p) => (p.kind === 'part' ? 'the parts' : p.kind === 'document' ? 'the Spec' : p.doc.id)
/** @param {string} id */
const isDocId = (id) => id === 'system' || id.includes('/')

/**
 * @param {StoreLike} store
 * @param {string} id
 * @param {{ by?: Actor, base?: string }} [opts]
 */
export function mergeChange(store, id, { by = 'claude', base } = {}) {
  if (by !== 'human') throw fail(`only a human merges ${id} into the Spec (approving it on its page, in the browser)`, 'forbidden')
  const rec = /^C-\d+$/.test(String(id)) ? store.get(id) : null
  if (!rec || rec.type !== 'C') throw fail(`no change ${id}`, 'missing')
  if (base != null && base !== rec.version) throw fail(`${id} changed since it was read`, 'stale')
  const status = String(rec.fields.status ?? '')
  if (CLOSED.includes(status)) throw fail(`${id} is ${status}: it is not merged any more`, 'state')
  const items = readChange(rec.body).items
  if (!items.length) throw fail(`${id} proposes no items`, 'empty')
  if (mergedIn(store.spec, id, items)) throw fail(`${id} is already merged`, 'merged')

  const work = workingSpec(store.spec)
  /** @type {Set<string>} */
  const touched = new Set()
  let partsTouched = false
  /** @type {Map<ProposedItem, string>} the document each item writes ('parts' for a part) */
  const docOf = new Map()
  /** @type {MergeProblem[]} */
  const problems = []
  const lang = work.parts.lang || work.docs.get('system')?.lang || DEFAULT_DOC_LANG

  for (const it of items) {
    /** @param {string} code @param {string} message */
    const refuse = (code, message) => { problems.push({ id: it.id, op: it.op, target: it.target, code, message }) }
    const text = String(it.text ?? '').trim()
    const at = work.locate(it.id)

    if (it.target === PARTS_TARGET) {
      docOf.set(it, 'parts')
      const [name, type, ...description] = text.split(' · ')
      if (it.op === 'add') {
        if (at) { refuse('duplicate', `${it.id} is already in ${whereOf(at)}`); continue }
        if (!/^[a-z0-9][a-z0-9-]*$/.test(it.id)) { refuse('bad', `a part's id is a folder name (core), not ${it.id}`); continue }
        work.parts.parts.push({ name: name || it.id, slug: it.id, type: type ?? '', description: description.join(' · '), active: true })
      } else if (it.op === 'change') {
        const part = at?.kind === 'part' ? at.part : null
        if (!part) { refuse('missing', `${it.id} is not a part of the Spec`); continue }
        if (text) Object.assign(part, { name: name || part.name, type: type ?? part.type, description: description.join(' · ') })
      } else { refuse('bad', `a part is not superseded: ${it.id} stays in the parts, retired by changing it`); continue }
      partsTouched = true
      continue
    }

    const [docId, anchor] = it.target.split('#')
    if (it.op === 'add') {
      if (at) { refuse('duplicate', `${it.id} is already in ${whereOf(at)}`); continue }
      if (isDocId(it.id)) {
        const where = docIdOf(docFile(it.id))
        if (!where || where.id !== it.id) { refuse('bad', `${it.id} is no document id (part/kind)`); continue }
        if (anchor != null || where.part !== docId) { refuse('target', `a document goes into its part, ${where.part ?? 'none'}, not ${it.target}`); continue }
        if (work.locate(docId)?.kind !== 'part') { refuse('target', `${docId} is not a part of the Spec`); continue }
        /** @type {SpecDoc} */
        const doc = { id: it.id, part: where.part, kind: where.kind, file: docFile(it.id), lang, title: text || it.id, prose: it.note ?? '', human: [], items: [], sections: [] }
        work.docs.set(it.id, doc)
        touched.add(it.id)
        docOf.set(it, it.id)
        continue
      }
      const doc = work.docs.get(docId)
      if (!doc) { refuse('target', `${docId} is not in the Spec`); continue }
      docOf.set(it, doc.id)
      const words = itemTextOf(text)
      if (anchor == null && !words.marked) {
        doc.sections.push({ id: it.id, title: text || it.id, done: false, prose: it.note ?? '', human: [], items: [] })
      } else {
        const parent = anchor == null ? null : locateIn(doc, anchor)
        if (anchor != null && parent?.kind !== 'section' && parent?.kind !== 'item') { refuse('target', `${anchor} is not in ${docId}`); continue }
        /** @type {SpecItem} */
        const item = { id: it.id, topic: words.topic || it.id, status: words.status, origin: [rec.id], items: [] }
        if (words.impl) item.impl = words.impl
        if (it.note) item.note = it.note
        const into = !parent ? doc.items : parent.kind === 'section' ? parent.section.items : parent.kind === 'item' ? parent.item.items : doc.items
        into.push(item)
      }
      touched.add(doc.id)
      continue
    }

    if (!at || at.kind === 'part') { refuse('missing', at ? `${it.id} is a part: its target is ${PARTS_TARGET}` : `${it.id} is not in the Spec`); continue }
    docOf.set(it, at.doc.id)
    if (it.op === 'supersede') {
      if (at.kind !== 'item') { refuse('bad', `only an item is superseded; ${it.id} is a ${at.kind}`); continue }
      if (at.item.supersededBy) { refuse('superseded', `${it.id} is already superseded by ${at.item.supersededBy}`); continue }
      at.item.supersededBy = rec.id
    } else if (at.kind === 'item') {
      if (text) {
        const words = itemTextOf(text)
        Object.assign(at.item, { topic: words.topic || at.item.topic, status: words.status })
        if (words.impl) at.item.impl = words.impl
        else delete at.item.impl
      }
      if (it.note) at.item.note = it.note
      if (!at.item.origin.includes(rec.id)) at.item.origin = [...at.item.origin, rec.id]
    } else {
      const node = at.kind === 'section' ? at.section : at.doc
      if (text) node.title = text
      if (it.note) node.prose = it.note
    }
    touched.add(at.doc.id)
  }

  if (!problems.length) {
    try {
      store.spec.writeMany({
        docs: [...touched].map((d) => ({ doc: /** @type {SpecDoc} */ (work.docs.get(d)), base: work.versions.get(d) })),
        parts: partsTouched ? { lang: work.parts.lang || lang, parts: work.parts.parts, human: work.parts.human, base: store.spec.partsVersion() } : undefined,
      })
    } catch (e) {
      const err = /** @type {Error & { code?: string, id?: string, document?: string }} */ (e)
      const byId = items.filter((it) => err.id && it.id === err.id)
      const byDoc = items.filter((it) => err.document && docOf.get(it) === err.document)
      for (const it of byId.length ? byId : byDoc.length ? byDoc : items) problems.push({ id: it.id, op: it.op, target: it.target, code: err.code ?? 'bad', message: err.message })
    }
  }
  if (problems.length) {
    throw fail(`${id} is not merged: ${problems.length === 1 ? '1 proposed item' : `${problems.length} proposed items`} cannot go into the Spec; nothing was written`, 'merge', { problems })
  }

  const next = status === 'implementing' ? undefined : 'implementing'
  const saved = store.update(id, { fields: next ? { status: next } : {} }, { by: 'human', event: 'merged' })
  return {
    id,
    status: String(saved.fields.status ?? ''),
    documents: [...(partsTouched ? ['parts'] : []), ...touched],
    items: items.map((it) => ({ id: it.id, op: it.op, document: docOf.get(it) ?? '' })),
  }
}

// Whether every item is in the Spec with this change in its origin (a superseded one marked by it).
/** @param {StoreLike['spec']} spec @param {string} id @param {ProposedItem[]} items */
function mergedIn(spec, id, items) {
  if (!items.length) return false
  const { locate } = workingSpec(spec)
  return items.every((it) => {
    const at = locate(it.id)
    if (!at) return false
    if (it.target === PARTS_TARGET) return at.kind === 'part' && at.part != null
    if (at.kind !== 'item') return at.kind !== 'part'
    return it.op === 'supersede' ? at.item.supersededBy === id : at.item.origin.includes(id)
  })
}

/** @param {StoreLike} store @param {string} id @returns {boolean | null} */
export function isMerged(store, id) {
  const rec = /^C-\d+$/.test(String(id)) ? store.get(id) : null
  if (!rec || rec.type !== 'C') return null
  return mergedIn(store.spec, id, readChange(rec.body).items)
}
