// @ts-check
// The old single map (docs/product/mindmap.json, Mind Elixir data: root → components → documents →
// sections → items) as the record model's Spec, without touching any file: what `groundwork migrate`
// (migrate.mjs) writes. Nothing here knows a project: the rules come from the map's own concepts.
//
//   mapToSpec(data, { roadmap?, split? }) -> Converted
//
//   component (metadata.component)   a part of the Spec, listed in spec/parts.md: its name, its slug
//                                    (metadata.dir, else the topic: the folder of its old documents
//                                    too), its type, its note as the one-sentence description
//   document (metadata.doc)          a Spec document: spec/<part>/<KIND>.md; the system document (a
//                                    document directly under the root, kind system) spec/SYSTEM.md;
//                                    another document directly under the root goes to a part named
//                                    after the root; a map without documents is one PRD of that part
//   section (a document's child)     a section {#id}: its prose, the human's paragraphs (with their
//                                    ids), progress done → .done; a note or link of its own is
//                                    appended to its prose
//   item                             an item with its id, status, impl, note and link, origin C-1:
//                                    decision, note, excluded, parked and inferred stay what they are
//                                    (inferred: from the code, awaiting confirmation), topic is a
//                                    group, an item without a status is a decision
//   todo                             not in the Spec, which holds nothing undecided: a todo pointing
//                                    to an idea (its link names I-n) is dropped, since the idea lives
//                                    in its own record; any other is an open question (`questions`,
//                                    for a change of their own). Its children stay, in its place.
//   from-ideas section               (the section Plan put the ideas in, id from-ideas) goes away:
//                                    what points to an idea is dropped, the rest are open questions
//   roadmap section                  the system document's section with the kind's starting title
//                                    for the roadmap (Közös ütemterv, Shared roadmap), or the section
//                                    `roadmap` names ('none': no roadmap): its decisions become the
//                                    milestones M-1…M-n, in order; the section goes away, and what
//                                    else it held (its prose, the human's paragraphs, other items,
//                                    the children of the decisions) moves to the start of its
//                                    document, before the first section
//
// `split` (a set of node ids: a component, document, section or item) routes those branches out of
// the Spec: they come back in `split` with where they belong (`target`), for a pending change's
// proposed items (`migrate --split`, #53) instead of C-1. A split item and its subtree are converted
// as usual, with no origin; a split section or document likewise, whole.
//
// `ids` maps every node that is not a Spec id of its own to what it became: the root (''), a
// component (its part), a document (its document id), a roadmap decision (M-n), a dropped node (the
// idea, or '' without one), an open question ('questions'). `warnings` lists what does not fit the
// Spec's form and how it was kept.

import { DOC_STRINGS, DEFAULT_DOC_LANG, KINDS, COMPONENT_TYPES } from '../records/doc-strings.mjs'
import { docFile } from '../records/spec-format.mjs'

/** @typedef {import('../records/spec-format.mjs').SpecDoc} SpecDoc */
/** @typedef {import('../records/spec-format.mjs').SpecSection} SpecSection */
/** @typedef {import('../records/spec-format.mjs').SpecItem} SpecItem */
/** @typedef {import('../records/spec-format.mjs').SpecPart} SpecPart */
/** @typedef {import('../records/spec-format.mjs').HumanText} HumanText */
/**
 * A node of the old map.
 * @typedef {Object} MapNode
 * @property {string} id
 * @property {string} topic
 * @property {string} [note]
 * @property {string} [hyperLink]
 * @property {MapNode[]} [children]
 * @property {Record<string, any>} [metadata]
 */
/**
 * @typedef {{ id: string, topic: string, note?: string, link?: string, document: string, section: string }} Question
 * @typedef {{ n: number, id: string, title: string, note?: string, link?: string, impl?: string }} Milestone
 * @typedef {{ id: string, topic: string, idea: string }} Dropped
 * @typedef {{ id: string, kind: 'part' | 'document' | 'section' | 'item', target: string,
 *   part?: SpecPart, docs?: SpecDoc[], doc?: SpecDoc, section?: SpecSection, item?: SpecItem }} Split
 * @typedef {{ from: string, to: string, kind: string }} IdMap
 * @typedef {{ doc: SpecDoc, node: string, oldFile: string }} ConvertedDoc
 * @typedef {Object} Converted
 * @property {string} lang
 * @property {{ id: string, topic: string }} root
 * @property {SpecPart[]} parts
 * @property {ConvertedDoc[]} docs
 * @property {Question[]} questions
 * @property {Milestone[]} milestones
 * @property {string | null} roadmap    the id of the roadmap section, null without one
 * @property {Dropped[]} dropped
 * @property {Split[]} split
 * @property {IdMap[]} ids
 * @property {string[]} oldFiles     where Plan wrote the documents from the map (split ones too)
 * @property {string[]} warnings
 */

export const ORIGIN = 'C-1'
export const IDEAS_SECTION = 'from-ideas'
const BASE = 'docs/product'
const STATUSES = ['decision', 'note', 'excluded', 'parked', 'inferred', 'todo', 'topic']
const IMPL = ['done', 'partial', 'missing']
const IDEA_LINK = /(?:[?&]idea=|ideas\/(?:items\/)?)(I-?\d+)/

/** @type {Record<string, any>} */
const STRINGS = DOC_STRINGS
/** @type {Record<string, { file: string }>} */
const KIND_FILES = KINDS

// The slug of a folder, as Plan named the folders of the old documents.
/** @param {string} text */
export function slug(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'doc'
}

/** @param {string | undefined} link @returns {string} 'I-3', or '' */
export function ideaOf(link) {
  const m = IDEA_LINK.exec(String(link ?? ''))
  return m ? m[1].replace(/^I-?/, 'I-') : ''
}

// The titles the system document's roadmap section starts with, in every language.
const ROADMAP_TITLES = Object.values(STRINGS).map((t) => t.kinds.system.sections[2])

// Text as the Spec's form holds it: no blanks at line ends or around it.
/** @param {string | undefined} s */
const tidy = (s) => String(s ?? '').replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim()
/** @param {string} s */
const oneLine = (s) => s.replace(/\s+/g, ' ').trim()

/**
 * @param {{ nodeData: MapNode }} data
 * @param {{ roadmap?: string, split?: Iterable<string> }} [options]
 * @returns {Converted}
 */
export function mapToSpec(data, { roadmap, split = [] } = {}) {
  const root = data.nodeData
  const lang = root.metadata?.lang && STRINGS[root.metadata.lang] ? root.metadata.lang : DEFAULT_DOC_LANG
  const splitIds = new Set(split)
  /** @type {Converted} */
  const out = { lang, root: { id: root.id, topic: root.topic }, parts: [], docs: [], questions: [], milestones: [], roadmap: null, dropped: [], split: [], ids: [], oldFiles: [], warnings: [] }
  out.ids.push({ from: root.id, to: '', kind: 'root' })

  // ---------- the documents, and where they go ----------
  /** @type {Array<{ node: MapNode, kind: string, part: SpecPart | null, component: MapNode | null, oldFile: string, label: string }>} */
  const found = []
  /** @type {Map<string, SpecPart>} */
  const partOf = new Map()   // component id (or the root's) -> part
  const slugs = new Set()
  /** @param {string} wanted */
  const freeSlug = (wanted) => { let s = wanted, n = 1; while (slugs.has(s)) s = `${wanted}-${++n}`; slugs.add(s); return s }
  /** @param {MapNode} c @returns {SpecPart} */
  const makePart = (c) => {
    const m = c.metadata ?? {}
    const type = COMPONENT_TYPES.includes(m.component) ? m.component : 'software'
    const description = oneLine([c.note ?? '', c.hyperLink ?? ''].filter(Boolean).join(' '))
    return { name: oneLine(c.topic), slug: freeSlug(slug(m.dir || c.topic)), type, description, active: true }
  }
  const rootPart = () => {
    let p = partOf.get(root.id)
    if (!p) { p = { name: oneLine(root.topic), slug: freeSlug(slug(root.topic)), type: 'software', description: '', active: true }; partOf.set(root.id, p) }
    return p
  }
  for (const n of root.children ?? []) {
    if (n.metadata?.doc) {
      const kind = String(n.metadata.doc)
      found.push({ node: n, kind, part: kind === 'system' ? null : rootPart(), component: null, oldFile: oldName(n, null), label: n.topic })
    } else if (n.metadata?.component) {
      const p = makePart(n)
      partOf.set(n.id, p)
      out.ids.push({ from: n.id, to: p.slug, kind: 'part' })
      for (const d of n.children ?? []) {
        if (d.metadata?.doc) found.push({ node: d, kind: String(d.metadata.doc), part: p, component: n, oldFile: oldName(d, n), label: d.topic })
        else out.warnings.push(`${d.id}: a node under component ${n.id} outside any document is not carried over`)
      }
    } else if (n.id !== IDEAS_SECTION) out.warnings.push(`${n.id}: a node directly under the root that is no document or component is not carried over`)
  }
  if (!found.length) found.push({ node: root, kind: 'prd', part: rootPart(), component: null, oldFile: `${BASE}/PRD.md`, label: 'PRD' })
  const rp = partOf.get(root.id)
  if (rp) out.ids[0].to = rp.slug
  // the order of the parts: the components', in map order; the root's where its first document was
  out.parts = [...new Set([...partOf.values()])].sort((a, b) => order(a) - order(b))
  function order(/** @type {SpecPart} */ p) { return found.findIndex((f) => f.part === p) }

  // two old documents never shared a file: the later one had -2
  const seen = new Map()
  for (const f of found) {
    const k = (seen.get(f.oldFile) ?? 0) + 1
    seen.set(f.oldFile, k)
    if (k > 1) f.oldFile = f.oldFile.replace(/\.md$/, `-${k}.md`)
  }

  // ---------- the roadmap ----------
  /** @type {MapNode | null} */
  let roadmapNode = null
  /** @type {typeof found[number] | null} */
  let roadmapDoc = null
  if (roadmap !== 'none') {
    for (const f of found) {
      if (f.node === root) continue
      for (const s of f.node.children ?? []) {
        const hit = roadmap ? s.id === roadmap : f.kind === 'system' && ROADMAP_TITLES.includes(oneLine(s.topic))
        if (hit && !roadmapNode) { roadmapNode = s; roadmapDoc = f }
      }
    }
    if (roadmap && !roadmapNode) throw Object.assign(new Error(`--roadmap ${roadmap}: no section of a document has that id`), { code: 'bad' })
  }
  out.roadmap = roadmapNode?.id ?? null

  // ---------- documents ----------
  const kindsTaken = new Map()
  const title = (/** @type {typeof found[number]} */ f) => (f.node === root ? oneLine(root.topic) : f.component ? `${oneLine(root.topic)} — ${oneLine(f.component.topic)}: ${oneLine(f.label)}` : `${oneLine(root.topic)} — ${oneLine(f.label)}`)
  for (const f of found) {
    // the kind names the file; a second document of one kind in a part gets kind-2
    const fileKind = kindOfFile(f.node, f.kind)
    const key = `${f.part?.slug ?? ''}/${fileKind}`
    const k = (kindsTaken.get(key) ?? 0) + 1
    kindsTaken.set(key, k)
    const kind = k > 1 ? `${fileKind}-${k}` : fileKind
    const id = f.part ? `${f.part.slug}/${kind}` : kind === 'system' ? 'system' : `${rootPart().slug}/${kind}`
    /** @type {SpecDoc} */
    const doc = { id, part: f.part?.slug ?? (id === 'system' ? null : rootPart().slug), kind, file: docFile(id), lang, title: title(f), prose: '', human: [], items: [], sections: [] }
    if (f.node !== root) {
      out.ids.push({ from: f.node.id, to: id, kind: 'document' })
      const own = ownText(f.node)
      if (own) doc.prose = own
    }
    const where = { doc: id }
    for (const s of f.node.children ?? []) {
      if (s === roadmapNode) { roadmapInto(doc, s); continue }
      if (s.id === IDEAS_SECTION) { ideasSection(s, doc); continue }
      const section = makeSection(s, { ...where, section: s.topic })
      if (splitIds.has(s.id)) { out.split.push({ id: s.id, kind: 'section', target: id, section }); continue }
      doc.sections.push(section)
    }
    out.oldFiles.push(f.oldFile)
    if (splitIds.has(f.node.id)) { out.split.push({ id: f.node.id, kind: 'document', target: id, doc }); continue }
    out.docs.push({ doc, node: f.node.id, oldFile: f.oldFile })
  }
  // a split component takes its documents with it
  for (const [cid, p] of partOf) {
    if (!splitIds.has(cid) || cid === root.id) continue
    const docs = out.docs.filter((d) => d.doc.part === p.slug)
    out.docs = out.docs.filter((d) => d.doc.part !== p.slug)
    out.parts = out.parts.filter((x) => x !== p)
    out.split.push({ id: cid, kind: 'part', target: p.slug, part: p, docs: docs.map((d) => d.doc) })
  }
  return out

  // ---------- helpers that add to `out` ----------

  /** @param {MapNode} s @param {{ doc: string, section: string }} where @returns {SpecSection} */
  function makeSection(s, where) {
    const m = s.metadata ?? {}
    if (m.status && m.status !== 'topic') out.warnings.push(`${s.id}: a section's status ${m.status} is not carried over (a section has none)`)
    if (m.impl) out.warnings.push(`${s.id}: a section's impl ${m.impl} is not carried over (a section has none)`)
    /** @type {SpecSection} */
    const section = { id: s.id, title: oneLine(s.topic), done: m.progress === 'done', prose: '', human: [], items: [] }
    const prose = [tidy(m.prose), ownText(s)].filter(Boolean).join('\n\n')
    placeProse(section, prose, s.id)
    for (const h of m.humanProse ?? []) section.human.push(human(h, s.id))
    section.items = items(s.children ?? [], { ...where, target: `${where.doc}#${s.id}` })
    return section
  }

  // A section's (or document's) prose, unless the Spec's form would not read it back as prose:
  // then it is kept, as written, in a human paragraph.
  /** @param {{ prose: string, human: HumanText[] }} body @param {string} prose @param {string} id */
  function placeProse(body, prose, id) {
    if (!prose) return
    if (/^([-*+] |## |# |<!-- |<{7}|>{7})/m.test(prose)) {
      out.warnings.push(`${id}: its prose holds lists or headings, which the Spec's prose cannot: kept as a human paragraph`)
      body.human.push(human({ text: prose }, id))
    } else body.prose = body.prose ? `${body.prose}\n\n${prose}` : prose
  }

  /** @param {{ id?: string, text?: string }} h @param {string} at @returns {HumanText} */
  function human(h, at) {
    let text = tidy(h.text)
    if (/^## |^<!-- \/human -->$/m.test(text)) {
      out.warnings.push(`${at}: a human paragraph's \`## \` headings are written as \`### \``)
      text = text.replace(/^## /gm, '### ').replace(/^<!-- \/human -->$/gm, '<!-- / human -->')
    }
    /** @type {HumanText} */
    const out1 = { text }
    if (h.id) out1.id = String(h.id)
    return out1
  }

  /**
   * @param {MapNode[]} nodes
   * @param {{ doc: string, section: string, target: string }} where
   * @returns {SpecItem[]}
   */
  function items(nodes, where) {
    /** @type {SpecItem[]} */
    const list = []
    for (const c of nodes) {
      const m = c.metadata ?? {}
      if (m.status === 'todo') {
        const idea = ideaOf(c.hyperLink)
        if (idea) drop(c, idea)
        else question(c, where)
        list.push(...items(c.children ?? [], where))
        continue
      }
      const it = item(c, where)
      if (splitIds.has(c.id)) { out.split.push({ id: c.id, kind: 'item', target: where.target, item: { ...it, origin: [] } }); continue }
      list.push(it)
    }
    return list
  }

  /** @param {MapNode} c @param {{ doc: string, section: string, target: string }} where @returns {SpecItem} */
  function item(c, where) {
    const m = c.metadata ?? {}
    const status = STATUSES.includes(m.status) ? m.status : 'decision'
    if (m.status && !STATUSES.includes(m.status)) out.warnings.push(`${c.id}: unknown status ${m.status}, carried over as a decision`)
    let topic = oneLine(c.topic)
    if (topic !== c.topic.trim()) out.warnings.push(`${c.id}: its topic spans lines, written on one`)
    if (/ · `[^`\s]+`/.test(topic)) { topic = topic.replace(/ · `/g, ' · ​`'); out.warnings.push(`${c.id}: its topic looks like an item's marks`) }
    /** @type {SpecItem} */
    const it = { id: c.id, topic, status, origin: [ORIGIN], items: [] }
    if (IMPL.includes(m.impl)) it.impl = m.impl
    const notes = [tidy(c.note), ...(m.humanProse ?? []).map((/** @type {any} */ h) => tidy(h.text))].filter(Boolean)
    if (m.humanProse?.length) out.warnings.push(`${c.id}: the human's paragraphs of an item are appended to its note`)
    if (m.prose) { notes.push(tidy(m.prose)); out.warnings.push(`${c.id}: the prose of an item is appended to its note`) }
    if (notes.length) it.note = noteText(notes.join('\n\n'), c.id)
    if (c.hyperLink) it.link = String(c.hyperLink).trim()
    it.items = items(c.children ?? [], { ...where, target: `${where.doc}#${c.id}` })
    return it
  }

  // A note as the item's continuation lines hold it: a line that would read as a list item is escaped.
  /** @param {string} note @param {string} id */
  function noteText(note, id) {
    if (!/^\s*[-*+] /m.test(note)) return note
    out.warnings.push(`${id}: list lines in its note are escaped (\\-), so they do not read as items`)
    return note.replace(/^(\s*)([-*+]) /gm, '$1\\$2 ')
  }

  /** @param {MapNode} c @param {string} idea */
  function drop(c, idea) {
    out.dropped.push({ id: c.id, topic: oneLine(c.topic), idea })
    out.ids.push({ from: c.id, to: idea, kind: 'dropped' })
  }

  /** @param {MapNode} c @param {{ doc: string, section: string }} where */
  function question(c, where) {
    /** @type {Question} */
    const q = { id: c.id, topic: oneLine(c.topic), document: where.doc, section: oneLine(where.section) }
    if (c.note) q.note = tidy(c.note)
    if (c.hyperLink) q.link = String(c.hyperLink).trim()
    out.questions.push(q)
    out.ids.push({ from: c.id, to: 'questions', kind: 'question' })
  }

  // The section Plan put the ideas in: what points to an idea is dropped, the rest are questions.
  /** @param {MapNode} s @param {SpecDoc} doc */
  function ideasSection(s, doc) {
    out.ids.push({ from: s.id, to: '', kind: 'dropped' })
    const walk = (/** @type {MapNode[]} */ nodes) => {
      for (const c of nodes) {
        const idea = ideaOf(c.hyperLink)
        if (idea) drop(c, idea)
        else question(c, { doc: doc.id, section: s.topic })
        walk(c.children ?? [])
      }
    }
    walk(s.children ?? [])
  }

  // The roadmap: its decisions are the milestones; the rest moves to the start of the document.
  /** @param {SpecDoc} doc @param {MapNode} s */
  function roadmapInto(doc, s) {
    const m = s.metadata ?? {}
    out.ids.push({ from: s.id, to: doc.id, kind: 'roadmap' })
    placeProse(doc, [tidy(m.prose), ownText(s)].filter(Boolean).join('\n\n'), s.id)
    for (const h of m.humanProse ?? []) doc.human.push(human(h, s.id))
    const where = { doc: doc.id, section: s.topic, target: doc.id }
    for (const c of s.children ?? []) {
      const cm = c.metadata ?? {}
      if (cm.status === 'decision') {
        const n = out.milestones.length + 1
        /** @type {Milestone} */
        const ms = { n, id: c.id, title: oneLine(c.topic).replace(/^\d+[.)]\s+/, '') || oneLine(c.topic) }
        if (c.note) ms.note = tidy(c.note)
        if (c.hyperLink) ms.link = String(c.hyperLink).trim()
        if (IMPL.includes(cm.impl)) ms.impl = cm.impl
        out.milestones.push(ms)
        out.ids.push({ from: c.id, to: `M-${n}`, kind: 'milestone' })
        doc.items.push(...items(c.children ?? [], where))
      } else doc.items.push(...items([c], where))
    }
  }
}

// A node's own note and link as a paragraph (a section or document has no place for them).
/** @param {MapNode} n */
function ownText(n) {
  return [tidy(n.note), n.hyperLink ? `[${n.hyperLink}](${n.hyperLink})` : ''].filter(Boolean).join('\n\n')
}

// The kind a document's file names: its own file name (metadata.file) when that is a Spec name
// (API.md -> api), else its kind.
/** @param {MapNode} n @param {string} kind */
function kindOfFile(n, kind) {
  const file = n.metadata?.file
  if (file && /^[A-Z][A-Z0-9_-]*\.md$/.test(file)) {
    const known = Object.entries(KIND_FILES).find(([, v]) => v.file === file)
    return known ? known[0] : file.slice(0, -3).toLowerCase()
  }
  return /^[a-z][a-z0-9-]*$/.test(kind) ? kind : slug(kind)
}

// Where Plan wrote a document from the map (modules/plan/documents.mjs listDocs).
/** @param {MapNode} n @param {MapNode | null} component */
function oldName(n, component) {
  const name = n.metadata?.file || KIND_FILES[n.metadata?.doc]?.file || `${slug(n.topic)}.md`
  return `${BASE}/${component ? `${slug(component.metadata?.dir || component.topic)}/` : ''}${name}`
}
