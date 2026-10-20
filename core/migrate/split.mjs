// @ts-check
// `groundwork migrate --split`: selected branches of the old map go to changes of their own,
// awaiting approval, instead of C-1. Claude proposes the split before the run, the human approves it.
//
//   readSplitPlan(text) -> SplitEntry[]     the split plan file (JSON, below); refused (code
//                                           'split') when it is not of that shape
//   proposedItems(splits, lang) -> ProposedItem[]   the converted branches (convert.mjs `split`) as
//                                           a change's proposed items, each with its place as target
//
// The split plan file: a JSON list, one entry per change, in the order of the changes (C-2, C-3, ...,
// after C-1; the open questions from the migration come after them). `{ "changes": [...] }` reads too.
//
//   [
//     { "title": "Record store and Markdown source",       the change's title (or "as")
//       "split": ["t-records", "c-records"],              the map ids of the branches: a component,
//                                                         a document, a section or an item (or "a,b")
//       "ideas": ["I-5"],                                 optional: the ideas it carries (or "idea")
//       "milestone": "M-9",                               optional: by number or by the roadmap
//                                                         decision's map id (r-9)
//       "problem": "...", "solution": "...",              optional: the change's own text; without
//       "scope": "...", "outOfScope": "..."               them migrate writes a general one
//     }
//   ]
//
// The single form on the command line is one entry: --split a,b --as "…" [--idea I-5] [--milestone M-9].
//
// Proposed items (every node of a branch is one, depth first, all `add`, implementation missing):
//   a part        `<slug>` → `parts`            text: name · type[ · description]
//   a document    `<doc id>` → `<part>`         text: its title; its prose and the human's words
//                                               as the item's note
//   a section     `<id>` → `<doc id>`           text: its title; its prose and the human's words
//   an item       `<id>` → `<doc>#<section or parent item>`   text: topic · status · missing (the
//                                               marks in the document's language, a group's topic
//                                               bold); its note and <link> as the item's note

import { DOC_STRINGS, DEFAULT_DOC_LANG } from '../records/doc-strings.mjs'
import { PARTS_TARGET } from '../records/changes.mjs'

/** @typedef {import('./convert.mjs').Split} Split */
/** @typedef {import('../records/types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('../records/spec-format.mjs').SpecItem} SpecItem */
/** @typedef {import('../records/spec-format.mjs').HumanText} HumanText */
/**
 * One change of a split plan.
 * @typedef {Object} SplitEntry
 * @property {string} title
 * @property {string[]} split
 * @property {string[]} [ideas]
 * @property {string} [milestone]
 * @property {string} [problem]
 * @property {string} [solution]
 * @property {string} [scope]
 * @property {string} [outOfScope]
 */

/** @param {string} msg */
const fail = (msg) => Object.assign(new Error(msg), { code: 'split' })
/** @param {unknown} v @returns {string[]} */
const list = (v) => (v == null ? [] : (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean))

/**
 * @param {string} text   the split plan file's content
 * @returns {SplitEntry[]}
 */
export function readSplitPlan(text) {
  /** @type {any} */
  let data
  try { data = JSON.parse(text) } catch (e) { throw fail(`the split plan is no JSON: ${/** @type {Error} */ (e).message}`) }
  const entries = Array.isArray(data) ? data : data?.changes
  if (!Array.isArray(entries)) throw fail('the split plan is a JSON list of changes: [{ "title": "…", "split": ["t-x"], "ideas": ["I-5"], "milestone": "M-9" }]')
  return entries.map((e, i) => {
    if (!e || typeof e !== 'object') throw fail(`entry ${i + 1} of the split plan is no object`)
    /** @type {SplitEntry} */
    const out = { title: String(e.title ?? e.as ?? '').trim(), split: list(e.split) }
    const ideas = list(e.ideas ?? e.idea)
    if (ideas.length) out.ideas = ideas
    if (e.milestone) out.milestone = String(e.milestone).trim()
    for (const k of /** @type {const} */ (['problem', 'solution', 'scope', 'outOfScope'])) if (e[k]) out[k] = String(e[k])
    return out
  })
}

/**
 * @param {Split[]} splits
 * @param {string} lang
 * @returns {ProposedItem[]}
 */
export function proposedItems(splits, lang) {
  /** @type {any} */
  const t = /** @type {Record<string, any>} */ (DOC_STRINGS)[lang] ?? DOC_STRINGS[DEFAULT_DOC_LANG]
  /** @type {ProposedItem[]} */
  const out = []
  /** @param {string} id @param {string} target @param {string} text @param {string} [note] */
  const add = (id, target, text, note) => {
    /** @type {ProposedItem} */
    const it = { op: 'add', id, target, text }
    if (note) it.note = note
    out.push(it)
  }
  /** @param {{ prose: string, human: HumanText[] }} body */
  const bodyNote = (body) => [body.prose, ...body.human.map((h) => [`<!-- human${h.id ? `: ${h.id}` : ''} -->`, h.text, '<!-- /human -->'].join('\n'))]
    .filter(Boolean).join('\n\n')
  /** @param {SpecItem} it @param {string} target */
  const item = (it, target) => {
    const marks = [...(it.status !== 'topic' ? [t.marks.status[it.status] ?? it.status] : []), t.impl.missing]
    const topic = it.status === 'topic' ? `**${it.topic}**` : it.topic
    const note = [it.note ?? '', it.link ? `<${it.link}>` : ''].filter(Boolean).join('\n')
    add(it.id, target, [topic, ...marks].join(' · '), note)
    for (const c of it.items) item(c, `${target.split('#')[0]}#${it.id}`)
  }
  /** @param {import('../records/spec-format.mjs').SpecSection} s @param {string} doc */
  const section = (s, doc) => {
    add(s.id, doc, s.title, bodyNote(s))
    for (const it of s.items) item(it, `${doc}#${s.id}`)
  }
  /** @param {import('../records/spec-format.mjs').SpecDoc} d */
  const document = (d) => {
    add(d.id, d.part ?? PARTS_TARGET, d.title, bodyNote(d))
    for (const it of d.items) item(it, d.id)
    for (const s of d.sections) section(s, d.id)
  }
  for (const s of splits) {
    if (s.kind === 'item' && s.item) item(s.item, s.target)
    else if (s.kind === 'section' && s.section) section(s.section, s.target)
    else if (s.kind === 'document' && s.doc) document(s.doc)
    else if (s.kind === 'part' && s.part) {
      const p = s.part
      add(p.slug, PARTS_TARGET, [p.name, p.type, p.description].filter(Boolean).join(' · '))
      for (const d of s.docs ?? []) document(d)
    }
  }
  return out
}
