// The map store: the one place that reads, writes and merges a project's mind map.
// The CLI, the hook and the Plan API of the core server all go through it.
//
//   const store = openMap(projectDir, files, { spec? })
//                                    files: the writer the core grants Plan (core/files.mjs);
//                                    spec: the record store's Spec (store.spec); by default one
//                                    opened on `files` (core/records/spec-store.mjs)
//   store.read()                     -> { v, data, readOnly? }   v: version id of the map
//   store.version()                  -> v                 the same v
//   store.source()                   -> 'spec' | 'mindmap' | null   where the map comes from
//   store.apply(ops, by?)            -> { errors, renamed, v, data } Claude's ops (see applyOps);
//                                       renamed: [[id, specId]] nodes whose id is the Spec's now
//   store.saveFromBrowser(base, data) -> { v, data, changed, errors } merge a browser save made on version `base`
//                                       or { stale, v, data } when `base` is unknown: nothing written
//                                       or { readOnly, v, data, error } on an old map: nothing written
//   store.takeHumanEdits()           -> ops               pending browser edits, collapsed, taken once
//   store.init(title)
//
// The map is the Spec: the documents under <dir>/docs/product/spec/, read and written through the
// record store's Spec in their canonical Markdown (spec-map.mjs says how nodes stand for parts,
// documents, sections and items). The Markdown is the source: a hand edit of a file is on the map
// the next time it is read, and a write rewrites only the documents that changed, in the canonical
// form. Edits made in the browser are diffed against the version the browser loaded, merged onto
// the current Spec, and logged to <dir>/.groundwork/plan/edits.jsonl until Claude reads them
// (state from before the move, in .prd-maker/, is moved there by the core: see module.mjs).
//
// A project that has only the old <dir>/docs/product/mindmap.json (no Spec yet) is shown from it,
// read-only: every write is refused with "run groundwork migrate", which turns it into the Spec.
//
// All file access goes through `io` (paths relative to the project): the writer the core
// hands the module, which writes only under the folders Plan's manifest names.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { setStatus } from './node-types.mjs'
import { BASE_DIR } from './documents.mjs'
import { specToMap, mapToSpec, isMapOnly } from './spec-map.mjs'
import { DOC_STRINGS, DEFAULT_DOC_LANG } from '../../core/records/doc-strings.mjs'
import { openSpec } from '../../core/records/spec-store.mjs'
import { writeSpecDoc, writeParts, SPEC_DIR, PARTS_FILE } from '../../core/records/spec-format.mjs'

const MAP = `${BASE_DIR}/mindmap.json` // the old map: read-only until `groundwork migrate`
const GLOSSARY = 'GLOSSARY.md' // owned by domain-modeling: read and link only
const STATE = '.groundwork/plan'
const EDITS = `${STATE}/edits.jsonl`
const HISTORY = `${STATE}/edits-history.jsonl`

export const MIGRATE_HINT = 'this project\'s map is the old docs/product/mindmap.json: run `groundwork migrate` to turn it into the Spec (docs/product/spec/); until then the map is read-only'

export function openMap(dir, io, { spec } = {}) {
  if (!io) throw new Error('openMap needs the writer the core grants the module (moduleFiles in core/files.mjs)')
  spec ??= openSpec(dir, io)
  const seen = new Map() // version -> map text, so a browser save can be diffed against what it loaded
  const remember = (v, text) => {
    seen.set(v, text)
    if (seen.size > 200) seen.delete(seen.keys().next().value)
  }

  const hasSpec = () => {
    try { return fs.readdirSync(path.join(dir, SPEC_DIR)).length > 0 } catch { return false }
  }
  const source = () => (hasSpec() ? 'spec' : io.exists(MAP) ? 'mindmap' : null)

  // The map's text and version, read now; the version is the map's hash, so it changes with any file.
  let last = { text: null, v: null }
  function current() {
    const from = source()
    let text
    if (from === 'spec') {
      const docs = spec.docs()
      text = JSON.stringify(specToMap({ docs, parts: spec.parts(), name: path.basename(path.resolve(dir)) }))
    } else text = io.read(MAP)
    if (text !== last.text) {
      last = { text, v: hash(text) }
      remember(last.v, text)
    }
    return { ...last, readOnly: from === 'mindmap' }
  }

  function read() {
    const { text, v, readOnly } = current()
    return readOnly ? { v, data: JSON.parse(text), readOnly } : { v, data: JSON.parse(text) }
  }

  // Writes the documents and the parts list the map holds that differ from what is on disk now;
  // removes the documents gone from the map. Returns the errors (nodes the Spec has no place for,
  // writes the store refused).
  function write(data) {
    const target = mapToSpec(data)
    const errors = [...target.errors]
    const before = spec.docs()
    const canonical = (d) => writeSpecDoc(pickDoc(d))
    const changed = target.docs.filter((d) => {
      const old = before.find((b) => b.id === d.id)
      return !old || canonical(old) !== canonical(d)
    })
    const gone = before.filter((b) => !target.docs.some((d) => d.id === b.id))

    // The parts list, when it changed (or when the map names parts and there is no list yet).
    const oldParts = spec.parts()
    const hadParts = io.exists(PARTS_FILE)
    if (hadParts || target.parts.parts.length || target.parts.human.length) {
      const was = hadParts ? writeParts({ ...oldParts, lang: oldParts.lang || target.parts.lang }) : ''
      const now = writeParts(target.parts)
      if (now !== was) io.write(PARTS_FILE, now)
    }

    // An id may move from one document to another: the store refuses an id another file still
    // holds, so a document is first written without the ids other files hold, then in full.
    const held = new Map()
    for (const d of before) for (const id of idsOf(d)) held.set(id, d.id)
    const settle = (doc, ids) => {
      for (const [id, owner] of held) if (owner === doc.id) held.delete(id)
      for (const id of ids) held.set(id, doc.id)
    }
    const again = []
    for (const d of changed) {
      const pruned = prune(d, (id) => held.has(id) && held.get(id) !== d.id)
      try {
        spec.writeDoc(pruned)
        settle(d, idsOf(pruned))
        if (pruned !== d) again.push(d)
      } catch (e) {
        if (pruned !== d) again.push(d); else errors.push(`${d.id}: ${e.message}`)
      }
    }
    for (const d of gone) {
      io.remove(d.file)
      settle(d, [])
    }
    for (const d of again) {
      try { spec.writeDoc(d); settle(d, idsOf(d)) } catch (e) { errors.push(`${d.id}: ${e.message}`) }
    }
    return { errors, renamed: target.renamed }
  }

  const refuse = () => {
    const { v, data } = read()
    return { errors: [MIGRATE_HINT], renamed: [], v, data }
  }

  function logHumanEdits(ops) {
    if (!ops.length) return
    const ts = new Date().toISOString()
    io.append(EDITS, ops.map((o) => JSON.stringify({ ts, ...o })).join('\n') + '\n')
  }

  return {
    file: path.join(dir, SPEC_DIR),
    exists: () => source() !== null,
    source,
    read,
    version: () => current().v,
    glossary: () => (io.exists(GLOSSARY) ? io.read(GLOSSARY) : ''),

    // A new Spec: the system document, named `title`; the first grilling round decides what
    // parts and documents the project needs. A Spec is never overwritten.
    init(title) {
      if (hasSpec()) throw new Error(`${path.join(dir, SPEC_DIR)} already exists: a Spec is never started again`)
      if (io.exists(MAP)) throw new Error(MIGRATE_HINT)
      spec.writeDoc({ id: 'system', lang: DEFAULT_DOC_LANG, title: title || 'Grilling', prose: '', human: [], items: [], sections: [] })
      return current().v
    },

    apply(ops, by) {
      if (source() === 'mindmap') return refuse()
      if (!source()) return { errors: ['no Spec yet: run `groundwork plan init "<title>"` first'], renamed: [], v: null, data: null }
      const { data } = read()
      const errors = applyOps(data, ops, by)
      const written = write(data)
      const now = read()
      return { errors: [...errors, ...written.errors], renamed: written.renamed, v: now.v, data: now.data }
    },

    saveFromBrowser(base, data) {
      delete data.theme // presentation lives in the page (view/), not in the map
      const cur = read()
      if (cur.readOnly) return { readOnly: true, v: cur.v, data: cur.data, error: MIGRATE_HINT }
      const sent = JSON.stringify(data) // `data` may be mutated below
      // A version this store never saw (e.g. the server restarted meanwhile) cannot be diffed:
      // what the human changed is unknown, and diffing against the current map would undo
      // Claude's newer edits. Nothing is written; the browser shows the current map instead.
      if (base !== cur.v && !seen.has(base)) return { stale: true, v: cur.v, data: cur.data }
      const ops = diff(JSON.parse(seen.get(base)), data)
      // Nodes the human adds without a status become "ask about this".
      for (const o of ops) if (o.op === 'add' && !o.status) o.status = 'todo'
      let next
      if (base === cur.v) {
        next = data // nobody else wrote meanwhile: the browser's map is the new one
        const m = index(next)
        for (const o of ops) if (o.op === 'add') {
          const n = m.get(o.id).node
          if (!n.metadata?.status) setStatus(n, o.status)
        }
      } else {
        next = cur.data // Claude wrote meanwhile: replay the human's changes onto it
        applyOps(next, ops, 'human')
      }
      const { errors } = write(next)
      logHumanEdits(ops)
      const now = read()
      return { v: now.v, data: now.data, changed: !sameTree(now.data, JSON.parse(sent)), errors }
    },

    // Reads pending human edits, collapses them per node, and moves them to history.
    takeHumanEdits() {
      if (!io.exists(EDITS)) return []
      const text = io.read(EDITS)
      if (!text) return []
      io.append(HISTORY, text)
      io.write(EDITS, '')
      return collapse(text.split('\n').filter(Boolean).map((l) => JSON.parse(l)))
    },
  }
}

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)

// The SpecDoc fields that are written (a stored document also has its version and problems).
const pickDoc = (d) => ({ id: d.id, part: d.part, kind: d.kind, file: d.file, lang: d.lang, title: d.title, prose: d.prose, human: d.human, items: d.items, sections: d.sections })

function idsOf(doc) {
  const out = []
  const rec = (items) => { for (const it of items) { if (it.id) out.push(it.id); rec(it.items) } }
  rec(doc.items)
  for (const s of doc.sections) { if (s.id) out.push(s.id); rec(s.items) }
  return out
}

// The document without the sections and items `drop(id)` says another file still holds
// (the same object when there are none).
function prune(doc, drop) {
  let any = false
  const items = (list) => list.filter((it) => { if (it.id && drop(it.id)) { any = true; return false } return true }).map((it) => ({ ...it, items: items(it.items) }))
  const sections = doc.sections.filter((s) => { if (s.id && drop(s.id)) { any = true; return false } return true }).map((s) => ({ ...s, items: items(s.items) }))
  const out = { ...doc, items: items(doc.items), sections }
  return any ? out : doc
}

// The same nodes with the same content, whatever the map-only details (folded, layout).
function sameTree(a, b) {
  const strip = (n) => ({ id: n.id, topic: n.topic, note: n.note, link: n.hyperLink, m: n.metadata || {}, c: (n.children || []).map(strip) })
  return JSON.stringify(strip(a.nodeData)) === JSON.stringify(strip(b.nodeData))
}

// ---------- tree helpers ----------

export function walk(node, fn, parent = null) {
  fn(node, parent)
  for (const c of node.children || []) walk(c, fn, node)
}

// The ids of the map's nodes, the root first, each before its children ([] without a map); ids
// of the map only (unmarked Spec lines) are left out, and the items before a document's first
// section are in.
export function nodeIds(data) {
  const ids = []
  const lead = (items) => { for (const it of items) { if (it.id) ids.push(it.id); lead(it.items || []) } }
  if (data?.nodeData) walk(data.nodeData, (node) => {
    if (node.id != null && !isMapOnly(node.id)) ids.push(String(node.id))
    if (node.metadata?.lead?.items) lead(node.metadata.lead.items)
  })
  return ids
}

export function index(data) {
  const m = new Map()
  walk(data.nodeData, (node, parent) => m.set(node.id, { node, parent }))
  return m
}

function isAncestor(m, maybeAncestorId, id) {
  for (let cur = m.get(id)?.parent; cur; cur = m.get(cur.id)?.parent) {
    if (cur.id === maybeAncestorId) return true
  }
  return false
}

const newId = () => crypto.randomBytes(6).toString('hex')

// Text the Spec's Markdown could not read back as it was meant: a list or heading line in a
// section's prose would become items or sections, a list line in a note a child item.
const LIST_OR_HEADING = /^(?:[-*+] |#{1,2} )/m
const NOTE_LIST = /^[-*+] /m

// Ops:
//   {op:'add', id?, parent, topic, status?, note?, link?, impl?, doc?, component?, dir?, file?}
//     component: a type ('software', 'service', 'infra', 'shared', ...) makes a main topic a part
//                of the Spec; its id becomes its slug (dir, or one made from its topic)
//     dir:       optional folder name (the part's slug) instead of one made from its topic
//     doc:       a kind ('system', 'prd', 'tech', 'service', 'process', 'infra', 'ops', 'rollout', ...)
//                makes the node a document (under a part; 'system' under the root); its children
//                are the sections; its id becomes '<part>/<kind>' ('system')
//     file:      optional file name for a document (UPPERCASE.md), instead of the kind's default
//   {op:'set', id, topic?, status?, note?, link?, impl?, prose?, progress?, human?}
//     impl:     'done' | 'partial' | 'missing' | '' how far the implementation is
//     prose:    Claude's Markdown text for a section (no list or heading lines: those are items)
//     progress: 'done' | '' for a section
//     human:    [{id, text}] the human's own paragraphs (only replayed from browser edits)
//     lang:     the document language, on the root only: a key of DOC_STRINGS ('hu', 'en', ...);
//               '' clears it (Hungarian)
//   {op:'move', id, parent}
//   {op:'remove', id}
function applyOps(data, ops, by) {
  const errors = []
  for (const op of ops) {
    const m = index(data)
    const entry = m.get(op.id)
    if (op.prose && LIST_OR_HEADING.test(op.prose)) { errors.push(`${op.op}: ${op.id}: a section's prose has no list or heading lines (the Spec reads them as items and sections): add the items as nodes`); continue }
    if (op.note && NOTE_LIST.test(op.note)) { errors.push(`${op.op}: ${op.id}: a note has no list lines (the Spec reads them as child items): add them as child nodes`); continue }
    switch (op.op) {
      case 'add': {
        if (op.id && entry) { errors.push(`add: id ${op.id} already exists`); break }
        const parent = m.get(op.parent)?.node ?? data.nodeData
        const node = { id: op.id || newId(), topic: op.topic ?? '' }
        if (op.note) node.note = op.note
        if (op.link) node.hyperLink = op.link
        if (op.status) setStatus(node, op.status)
        if (op.impl) node.metadata = { ...(node.metadata || {}), impl: op.impl }
        for (const k of ['doc', 'component', 'dir', 'file']) if (op[k]) node.metadata = { ...(node.metadata || {}), [k]: op[k] }
        if (by) node.metadata = { ...(node.metadata || {}), by }
        ;(parent.children ||= []).push(node)
        break
      }
      case 'set': {
        if (!entry) { errors.push(`set: no node ${op.id}`); break }
        const n = entry.node
        if (op.lang !== undefined) {
          if (entry.parent) { errors.push(`set: lang goes on the root, not on ${op.id}`); break }
          if (op.lang && !DOC_STRINGS[op.lang]) { errors.push(`set: no document strings for language "${op.lang}" (there are: ${Object.keys(DOC_STRINGS).join(', ')})`); break }
        }
        if (op.topic !== undefined && !entry.parent && data.nodeData.metadata?.spec && op.topic !== n.topic) {
          errors.push('set: the root\'s name is the system document\'s title: rename that document (id system)')
        }
        if (op.topic !== undefined) n.topic = op.topic
        if (op.status !== undefined) setStatus(n, op.status)
        if (op.note !== undefined) { if (op.note) n.note = op.note; else delete n.note }
        if (op.link !== undefined) { if (op.link) n.hyperLink = op.link; else delete n.hyperLink }
        for (const [k, field] of [['doc', 'doc'], ['component', 'component'], ['dir', 'dir'], ['file', 'file'], ['impl', 'impl'], ['prose', 'prose'], ['progress', 'progress'], ['human', 'humanProse'], ['lang', 'lang']]) {
          if (op[k] === undefined) continue
          n.metadata = { ...(n.metadata || {}) }
          const empty = op[k] === '' || (Array.isArray(op[k]) && !op[k].length)
          if (empty) delete n.metadata[field]; else n.metadata[field] = op[k]
        }
        if (op.lang === '' && n.metadata?.spec) n.metadata.lang = DEFAULT_DOC_LANG
        break
      }
      case 'move': {
        const target = m.get(op.parent)?.node
        if (!entry || !entry.parent) { errors.push(`move: no movable node ${op.id}`); break }
        if (!target) { errors.push(`move: no parent ${op.parent}`); break }
        if (op.parent === op.id || isAncestor(m, op.id, op.parent)) { errors.push(`move: ${op.id} into its own subtree`); break }
        entry.parent.children = entry.parent.children.filter((c) => c.id !== op.id)
        ;(target.children ||= []).push(entry.node)
        break
      }
      case 'remove': {
        if (!entry) break // already gone, e.g. an ancestor was removed first
        if (!entry.parent) { errors.push('remove: cannot remove the root'); break }
        entry.parent.children = entry.parent.children.filter((c) => c.id !== op.id)
        break
      }
      default:
        errors.push(`unknown op ${JSON.stringify(op)}`)
    }
  }
  return errors
}

function flat(data) {
  const m = new Map()
  walk(data.nodeData, (n, p) => m.set(n.id, {
    topic: n.topic, parent: p?.id ?? null, status: n.metadata?.status, note: n.note, link: n.hyperLink,
    impl: n.metadata?.impl, prose: n.metadata?.prose, progress: n.metadata?.progress,
    human: n.metadata?.humanProse?.length ? JSON.stringify(n.metadata.humanProse) : undefined,
  }))
  return m
}

// Ops that turn `a` into `b` (by node id). Sibling order is not tracked.
function diff(a, b) {
  const A = flat(a), B = flat(b), ops = []
  walk(b.nodeData, (n, p) => {
    if (!A.has(n.id)) ops.push(clean({ op: 'add', id: n.id, parent: p?.id, topic: n.topic, status: n.metadata?.status, note: n.note, link: n.hyperLink }))
  })
  for (const [id, x] of B) {
    const y = A.get(id)
    if (!y) continue
    const set = {}
    for (const k of ['topic', 'status', 'note', 'link', 'impl', 'prose', 'progress']) if (x[k] !== y[k]) set[k] = x[k] ?? ''
    if (x.human !== y.human) set.human = x.human ? JSON.parse(x.human) : []
    if (Object.keys(set).length) ops.push({ op: 'set', id, ...set, was: y.topic })
    if (x.parent !== y.parent && x.parent) ops.push({ op: 'move', id, parent: x.parent, topic: x.topic })
  }
  for (const [id, y] of A) if (!B.has(id)) ops.push({ op: 'remove', id, topic: y.topic })
  return ops
}

function clean(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

// add+set -> add, add+remove -> nothing, set+set -> set
function collapse(ops) {
  const out = []
  const byId = new Map()
  for (const op of ops) {
    const prev = byId.get(op.id)
    if (prev && prev.op === 'add' && op.op === 'set') { Object.assign(prev, pick(op, EDIT_KEYS)); continue }
    if (prev && prev.op === 'add' && op.op === 'remove') { out.splice(out.indexOf(prev), 1); byId.delete(op.id); continue }
    if (prev && prev.op === 'set' && op.op === 'set') { Object.assign(prev, pick(op, EDIT_KEYS)); continue }
    out.push(op)
    if (op.op !== 'move') byId.set(op.id, op)
  }
  return out
}

const EDIT_KEYS = ['topic', 'status', 'note', 'link', 'impl', 'prose', 'progress', 'human']
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))
