// The Spec as a mind map, and back: how Plan's map (Mind Elixir data) stands for the Spec
// documents of the record store (core/records/spec-store.mjs, spec-format.mjs), until the Spec
// workspace (C-4) takes the map over.
//
//   specToMap({ docs, parts, name })  -> data        docs: store.spec.docs(), parts: store.spec.parts()
//   mapToSpec(data)                   -> { docs, parts, errors, renamed }   the SpecDocs and the parts list the map
//                                        holds; renamed: [[node id, Spec id]] for parts and documents whose node id differs
//
// The tree:
//   root                 id 'root'; topic: the system document's title (else `name`, the folder's);
//                        metadata { spec: true, lang, partsHuman? }
//   ├─ system document   id 'system' (spec/SYSTEM.md), metadata.doc 'system'
//   └─ part              id = its slug (spec/<slug>/), topic = its name, note = its one sentence,
//      │                 metadata { component: type, dir: slug, retired?, unlisted? (not in parts.md) }
//      └─ document       id = '<slug>/<kind>' (spec/<slug>/<KIND>.md), topic = its title,
//         │              metadata { doc: kind, file: 'KIND.md', lead? (text and items before the
//         │              first section: kept as they are, not on the map) }
//         └─ section     id = its {#id}, topic = its title, metadata { prose, humanProse, progress: 'done' }
//            └─ item     id = its `id`, topic, note, hyperLink = link, metadata { status, impl, origin,
//                        supersededBy, extra }; children are its child items
//
// A section or an item without a mark gets an id of the map only, starting with '~', and is written
// back without one (metadata.specId: ''); an id used twice gets one too, and keeps its own in
// specId (the store then refuses the write: the human sees the duplicate). A human paragraph without
// an id likewise. A node without a status is written as a decision (the reader's own reading).
// Nodes the Spec has no place for (anything else under the root or a part; a document under the
// root other than the system's; two documents of a kind in one part) are left out, with an error.

import { SPEC_DIR } from '../../core/records/spec-format.mjs'
import { DEFAULT_DOC_LANG, KINDS } from '../../core/records/doc-strings.mjs'
import { slug } from './documents.mjs'

const MAP_ONLY = '~'
export const isMapOnly = (id) => String(id).startsWith(MAP_ONLY)

// ---------- Spec -> map ----------

export function specToMap({ docs, parts, name }) {
  const lang = docs.find((d) => d.id === 'system')?.lang || docs[0]?.lang || parts.lang || DEFAULT_DOC_LANG
  const used = new Set()
  const idFor = (specId, fallback) => {
    if (specId && !used.has(specId) && !isMapOnly(specId)) { used.add(specId); return { id: specId } }
    return { id: fallback, specId }
  }

  const docNode = (d) => {
    let n = 0
    const local = () => `${MAP_ONLY}${d.id}:${++n}`
    const item = (it) => {
      const { id, specId } = idFor(it.id, local())
      const m = {}
      if (it.status) m.status = it.status
      if (it.impl) m.impl = it.impl
      if (it.origin?.length) m.origin = it.origin
      if (it.supersededBy) m.supersededBy = it.supersededBy
      if (it.extra?.length) m.extra = it.extra
      if (specId !== undefined) m.specId = specId
      const node = { id, topic: it.topic, metadata: m, children: it.items.map(item) }
      if (it.note) node.note = it.note
      if (it.link) node.hyperLink = it.link
      return node
    }
    const human = (list) => list.map((h) => ({ id: h.id || local(), text: h.text }))
    const section = (s) => {
      const { id, specId } = idFor(s.id, local())
      const m = {}
      if (s.prose) m.prose = s.prose
      if (s.human.length) m.humanProse = human(s.human)
      if (s.done) m.progress = 'done'
      if (specId !== undefined) m.specId = specId
      return { id, topic: s.title, metadata: m, children: s.items.map(item) }
    }
    used.add(d.id)
    const meta = { doc: d.kind, file: d.file.split('/').pop() }
    if (d.prose || d.human.length || d.items.length) meta.lead = { prose: d.prose, human: d.human, items: d.items }
    return { id: d.id, topic: d.title, metadata: meta, children: d.sections.map(section) }
  }

  const children = []
  const system = docs.find((d) => d.id === 'system')
  if (system) children.push(docNode(system))
  const listed = parts.parts.map((p) => p.slug)
  const slugs = [...listed, ...new Set(docs.map((d) => d.part).filter((p) => p && !listed.includes(p)))]
  for (const s of slugs) {
    const p = parts.parts.find((x) => x.slug === s)
    const meta = { component: p?.type || 'software', dir: s }
    if (p && !p.active) meta.retired = true
    if (!p) meta.unlisted = true
    used.add(s)
    const node = { id: s, topic: p?.name || s, metadata: meta, children: docs.filter((d) => d.part === s).map(docNode) }
    if (p?.description) node.note = p.description
    children.push(node)
  }
  const rootMeta = { spec: true, lang }
  if (parts.human?.length) rootMeta.partsHuman = parts.human
  return { nodeData: { id: 'root', topic: system?.title || name, metadata: rootMeta, children }, direction: 1 }
}

// ---------- map -> Spec ----------

const specIdOf = (node) => (node.metadata && 'specId' in node.metadata ? node.metadata.specId : isMapOnly(node.id) ? '' : String(node.id))

function toItem(node) {
  const m = node.metadata || {}
  const it = { id: specIdOf(node), topic: String(node.topic ?? '').replace(/\s*\n\s*/g, ' '), status: m.status || 'decision', origin: m.origin || [] }
  if (m.impl) it.impl = m.impl
  if (m.supersededBy) it.supersededBy = m.supersededBy
  if (node.note) it.note = node.note
  if (node.hyperLink) it.link = node.hyperLink
  if (m.extra?.length) it.extra = m.extra
  it.items = (node.children || []).map(toItem)
  return it
}

function toSection(node) {
  const m = node.metadata || {}
  return {
    id: specIdOf(node), title: String(node.topic ?? '').replace(/\s*\n\s*/g, ' '), done: m.progress === 'done', prose: m.prose || '',
    human: (m.humanProse || []).map((h) => (h.id && !isMapOnly(h.id) ? { id: h.id, text: h.text } : { text: h.text })),
    items: (node.children || []).map(toItem),
  }
}

// The file name of a document node: its own (an UPPERCASE.md name), else its kind's.
const fileName = (node) => {
  const own = node.metadata.file
  if (own && /^[A-Z][A-Z0-9_-]*\.md$/.test(own)) return own
  return KINDS[node.metadata.doc]?.file || `${String(node.metadata.doc).toUpperCase()}.md`
}

export function mapToSpec(data) {
  const root = data.nodeData
  const lang = root.metadata?.lang || DEFAULT_DOC_LANG
  const errors = []
  const docs = []
  const parts = []
  const renamed = []
  const toDoc = (node, part) => {
    const file = part ? `${SPEC_DIR}/${part}/${fileName(node)}` : `${SPEC_DIR}/${KINDS.system.file}`
    const kindOfFile = Object.entries(KINDS).find(([, v]) => v.file === fileName(node))?.[0] ?? fileName(node).slice(0, -3).toLowerCase()
    const id = part ? `${part}/${kindOfFile}` : 'system'
    if (docs.some((d) => d.id === id)) { errors.push(`${node.id}: ${part ? `part ${part}` : 'the Spec'} already has a ${kindOfFile} document (${file})`); return }
    const lead = node.metadata.lead || { prose: '', human: [], items: [] }
    if (String(node.id) !== id) renamed.push([String(node.id), id])
    docs.push({
      id, part, kind: part ? kindOfFile : 'system', file, lang, title: String(node.topic ?? '').replace(/\s*\n\s*/g, ' '),
      prose: lead.prose || '', human: lead.human || [], items: lead.items || [],
      sections: (node.children || []).map(toSection),
    })
  }
  for (const n of root.children || []) {
    const m = n.metadata || {}
    if (m.doc) {
      if (m.doc === 'system') toDoc(n, null)
      else errors.push(`${n.id} "${n.topic}": a ${m.doc} document goes under a part (a component); only the system document sits under the root`)
    } else if (m.component) {
      const s = slug(m.dir || n.topic)
      if (parts.some((p) => p.slug === s)) { errors.push(`${n.id} "${n.topic}": there is a part ${s} already`); continue }
      const listed = !m.unlisted || n.topic !== s || n.note || m.component !== 'software' || m.retired
      if (String(n.id) !== s) renamed.push([String(n.id), s])
      parts.push({ slug: s, listed, part: { name: String(n.topic ?? '').replace(/\s*\n\s*/g, ' '), slug: s, type: m.component, description: n.note || '', active: !m.retired } })
      for (const d of n.children || []) {
        if (d.metadata?.doc) toDoc(d, s)
        else errors.push(`${d.id} "${d.topic}": only documents go under a part; put it in a section of one`)
      }
    } else {
      errors.push(`${n.id} "${n.topic}": only the parts (components) and the system document go under the root; put it in a section of a document`)
    }
  }
  return {
    docs,
    parts: { lang, parts: parts.filter((p) => p.listed).map((p) => p.part), human: root.metadata?.partsHuman || [] },
    errors,
    renamed,
  }
}
