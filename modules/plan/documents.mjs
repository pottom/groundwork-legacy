// The documents as the map holds them, shared by the server (the CLI's outline, the map store)
// and the browser (the live document panel). The files are the Spec's own Markdown, which the
// record store reads and writes (core/records/spec-format.mjs; spec-map.mjs says how the map
// stands for them): nothing is generated from the map. The panel computes here what is not in
// the files: section progress, the cross-cutting lists, the counts.
//
// Structure:
//   root                         the system or product
//   ├─ component (metadata.component = type)   optional grouping, e.g. a service or an app;
//   │                                           its documents go in the folder metadata.dir
//   │  └─ document (metadata.doc = kind)       one .md file
//   │     └─ section                            a chapter of that file
//   │        └─ items                           decisions, facts, groups...
//   └─ document                                 a document that belongs to the whole system
//
// A map with no document nodes is a single PRD whose sections are the main topics.
//
// A section holds:
//   metadata.prose       Claude's text for the section (Markdown)
//   metadata.humanProse  [{id, text}] paragraphs the human wrote; Claude never edits these
//   metadata.progress    'done' once Claude considers the section settled
//   children             the map items (decisions, facts, sub-topics)
// Excluded, parked and todo items, plus untouched sections, are collected into
// the cross-cutting sections at the end of each document.
//
// The fixed texts (states, closing section titles) are in the map's document language: see
// core/records/doc-strings.mjs (the record store's).
//
// A map of the Spec (root metadata.spec) has its documents under spec/; an old map (mindmap.json,
// read-only until `groundwork migrate`) keeps the paths and titles its generated files had.

import { docStrings, langOf, KINDS, COMPONENT_TYPES } from '../../core/records/doc-strings.mjs'

// Where everything lives, relative to the project root. The folder is ours alone:
// GLOSSARY*.md, docs/adr/, docs/agents/, .scratch/ and .out-of-scope/ belong to other skills.
export const BASE_DIR = 'docs/product'

// Document kinds and their default file names, and the component types (the label on the map is
// UI text: ui-strings.mjs, component.<key>): the record store's, like the documents' fixed texts.
export { KINDS, COMPONENT_TYPES }

const kindOf = (kind) => KINDS[kind] || { file: null }
// The titles of a kind in a language: subtitle and the closing sections.
const kindText = (text, kind) => ({ subtitle: kind, ...text.kinds[kind], cross: text.kinds[kind]?.cross || text.otherCross })

export function slug(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'doc'
}

// All documents in the map, in map order.
//   {id, kind, label, component: {id, topic, type} | null, file, node}
// file is relative to BASE_DIR.
export function listDocs(data) {
  const root = data.nodeData
  const base = root.metadata?.spec ? 'spec/' : ''
  const docs = []
  const add = (node, component) => {
    const kind = node.metadata.doc
    const k = kindOf(kind)
    const name = node.metadata.file || k.file || `${slug(node.topic)}.md`
    docs.push({ id: node.id, kind, label: node.topic, component, file: base + (component ? `${slug(component.dir || component.topic)}/${name}` : name), node })
  }
  for (const n of root.children || []) {
    if (n.metadata?.doc) add(n, null)
    else if (n.metadata?.component) {
      const component = { id: n.id, topic: n.topic, type: n.metadata.component, dir: n.metadata.dir }
      for (const d of n.children || []) if (d.metadata?.doc) add(d, component)
    }
  }
  if (!docs.length) docs.push({ id: root.id, kind: 'prd', label: 'PRD', component: null, file: 'PRD.md', node: root, legacy: true })
  // two documents must never share a file
  const seen = new Map()
  for (const d of docs) {
    const n = (seen.get(d.file) || 0) + 1
    seen.set(d.file, n)
    if (n > 1) d.file = d.file.replace(/\.md$/, `-${n}.md`)
  }
  return docs
}

// Which document a node belongs to (null for the root, components and stray nodes).
export function docOf(data, id) {
  const contains = (n) => n.id === id || (n.children || []).some(contains)
  for (const d of listDocs(data)) {
    if (d.legacy) return id === data.nodeData.id ? null : d.id
    if (contains(d.node)) return d.id
  }
  return null
}

// True for a node that is a section (holds prose/progress).
export function isSection(data, id) {
  return listDocs(data).some((d) => (d.node.children || []).some((s) => s.id === id))
}

export function docTitle(data, doc) {
  if (data.nodeData.metadata?.spec && !doc.legacy) return doc.label // a Spec document has its own title
  const root = data.nodeData.topic
  if (doc.legacy || (doc.kind === 'prd' && !doc.component && listDocs(data).filter((d) => d.kind === 'prd').length === 1)) return root
  return doc.component ? `${root} — ${doc.component.topic}: ${doc.label}` : `${root} — ${doc.label}`
}

export function buildPrd(data, docId) {
  const docs = listDocs(data)
  const doc = docs.find((d) => d.id === docId) || docs[0]
  const t = docStrings(langOf(data))
  const { subtitle, cross } = kindText(t, doc.kind)
  const prd = {
    doc, kind: doc.kind, title: docTitle(data, doc), subtitle, cross, text: t,
    sections: [], nonGoals: [], later: [], open: [],
  }

  for (const topic of doc.node.children || []) {
    const items = []
    const visit = (node, depth) => {
      for (const c of node.children || []) {
        const st = c.metadata?.status
        const ref = { id: c.id, topic: c.topic, status: st, impl: c.metadata?.impl, note: c.note, link: c.hyperLink, section: topic.topic, depth }
        if (st === 'excluded') prd.nonGoals.push(ref)
        else if (st === 'parked') prd.later.push(ref)
        else if (st === 'todo') prd.open.push(ref)
        else items.push(ref)
        visit(c, depth + 1)
      }
    }
    visit(topic, 0)

    const m = topic.metadata || {}
    const human = m.humanProse || []
    const touched = items.length || m.prose || human.length ||
      prd.nonGoals.concat(prd.later, prd.open).some((r) => r.section === topic.topic)
    const progress = m.progress === 'done' ? 'done' : touched ? 'active' : 'untouched'
    if (progress === 'untouched') prd.open.push({ id: topic.id, topic: topic.topic, status: 'topic', section: topic.topic, untouched: true, depth: 0 })

    prd.sections.push({ id: topic.id, title: topic.topic, progress, prose: m.prose || '', human, items })
  }
  return prd
}

export function progressSummary(prd) {
  const count = { done: 0, active: 0, untouched: 0, inferred: 0, impl: { done: 0, partial: 0, missing: 0 } }
  for (const s of prd.sections) {
    count[s.progress]++
    for (const it of s.items) {
      if (it.status === 'inferred') count.inferred++
      if (it.impl) count.impl[it.impl]++
    }
  }
  return count
}
