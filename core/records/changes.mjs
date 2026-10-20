// @ts-check
// The Markdown of a change (C-n), and the core's own record type, Milestone (M-n). The Changes
// module declares the Change type (modules/changes/type.mjs) with the body format here, which the
// core reads too: resolve.mjs (the ids a pending change proposes) and check.mjs (its proposed
// items). Without the Changes module there is no C type, and a change id is a plain id. The store
// (store.mjs) keeps the milestones like any module's type; CORE_RECORDS declares them, and the
// server and `groundwork record` open the store with it beside the modules. They are the core's
// until the Overview workspace takes the declaration over (one prefix keeps one type).
//
//   docs/product/changes/C-007-<slug>.md          docs/product/milestones/M-009-<slug>.md
//   ---                                           ---
//   id: C-7                                       id: M-9
//   title: Record store                           title: Redesign
//   ideas: I-5          the ideas it carries      status: in-progress
//   milestone: M-9      at most one milestone     ---
//   status: grilling
//   ---                                           What the milestone is about.
//
//   ## Probléma ... ## Kérdések                   ## Történet
//   ## Javasolt elemek
//   - add `d-rec-change` → `records/tech#t-rec-data` — Change (C-n) is a record
//     Its note: lines indented two spaces under the item.
//   ## Jegyek
//   A jegyek a `**Change:** C-7` sorukkal hivatkoznak erre a változásra.
//   ## Történet
//
// A change's file reads on its own as a spec, with the structure of the to-spec template: problem,
// solution, scope, out of scope, questions, the proposed items (op, item id, → target) and, instead
// of a ticket list, the rule that finds its tickets. Every link is written once, on the later record
// toward its source (a change names its ideas and its milestone); the store computes the other way.
//
//   MILESTONE_TYPE, CORE_RECORDS   the type, and the manifest-like entry declaring it
//   needsTitle(next, what)         a type's rule: tidies the title, refuses a record without one
//   changeBody(parts, id)  -> Markdown           parts: { problem?, solution?, scope?, outOfScope?,
//                                                questions?, items?: [ProposedItem] }
//   readChange(body)       -> parts + { items, tickets }   patient: English headings too, `->` for
//                                                `→`, ids without backticks; a line that is not an
//                                                item stays text and is not an item
//   OPS                    the ops of a proposed item: add, change, supersede
//   PARTS_TARGET           'parts': the target of a proposed part (the list in spec/parts.md); a
//                          proposed document's target is its part, a section's its document, an
//                          item's `<document>#<section or parent item>`
//
// States. Milestone: planned → in-progress → done; Claude proposes, the human moves it (Claude only
// creates one). A change's states are its type's (modules/changes/type.mjs).

/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('./types.mjs').ChangeParts} ChangeParts */

export const CHANGES = 'docs/product/changes'
export const MILESTONES = 'docs/product/milestones'
export const OPS = ['add', 'change', 'supersede']
export const PARTS_TARGET = 'parts'

// The sections of a change, in order: the heading written, and the ones read too.
/** @type {Array<{ key: 'problem' | 'solution' | 'scope' | 'outOfScope' | 'questions' | 'items' | 'tickets', heading: string, also: string[] }>} */
const SECTIONS = [
  { key: 'problem', heading: 'Probléma', also: ['Problem', 'Problem Statement'] },
  { key: 'solution', heading: 'Megoldás', also: ['Solution'] },
  { key: 'scope', heading: 'Keret', also: ['Scope'] },
  { key: 'outOfScope', heading: 'Kihagyjuk', also: ['Out of scope'] },
  { key: 'questions', heading: 'Kérdések', also: ['Questions', 'Open questions'] },
  { key: 'items', heading: 'Javasolt elemek', also: ['Proposed items'] },
  { key: 'tickets', heading: 'Jegyek', also: ['Tickets'] },
]
const HEADING = /^##\s+(.+?)\s*$/
const ITEM = /^[-*]\s+(\S+)\s+`?([^`\s]+)`?\s+(?:→|->)\s+`?([^`\s]+)`?(?:\s+[—–-]\s+(.*\S))?\s*$/
const TICKETS = /\*\*Change:\*\*\s*`?\s*(C-\d+)/

/** @param {ProposedItem} i */
const itemLine = (i) => [`- ${i.op} \`${i.id}\` → \`${i.target}\`${i.text ? ` — ${i.text}` : ''}`,
  ...(i.note ? i.note.split('\n').map((l) => (l ? `  ${l}` : '')) : [])].join('\n')
/** @param {string} id */
const ticketsRule = (id) => `A jegyek a \`**Change:** ${id}\` sorukkal hivatkoznak erre a változásra.`

/**
 * The body of a change: every section, in order, then the tickets rule.
 * @param {ChangeParts} parts
 * @param {string} id
 */
export function changeBody(parts, id) {
  const out = []
  for (const s of SECTIONS) {
    let text = ''
    if (s.key === 'items') text = (parts.items ?? []).map(itemLine).join('\n')
    else if (s.key === 'tickets') text = ticketsRule(id)
    else text = String(parts[s.key] ?? '').trim()
    out.push(`## ${s.heading}`, '')
    if (text) out.push(text, '')
  }
  return out.join('\n').trim()
}

/**
 * The parts of a change's body: the text of each section, the proposed items, and the change its
 * tickets rule names (null without one).
 * @param {string} body
 * @returns {ChangeParts & { items: ProposedItem[], tickets: string | null }}
 */
export function readChange(body) {
  /** @type {Record<string, string[]>} */
  const text = {}
  /** @type {string | null} */
  let at = null
  for (const line of String(body ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const h = HEADING.exec(line)
    if (h) {
      const name = h[1].toLowerCase()
      at = SECTIONS.find((s) => [s.heading, ...s.also].some((x) => x.toLowerCase() === name))?.key ?? null
      if (at) text[at] ??= []
      continue
    }
    if (at) text[at].push(line)
  }
  /** @type {ProposedItem[]} */
  const items = []
  /** @type {{ item: ProposedItem, lines: string[] } | null} */
  let last = null
  const close = () => {
    if (!last) return
    const note = last.lines.join('\n').replace(/^\n+|\n+$/g, '')
    if (note) last.item.note = note
    last = null
  }
  for (const line of text.items ?? []) {
    const m = ITEM.exec(line.trim())
    if (m && OPS.includes(m[1])) {
      close()
      /** @type {ProposedItem} */
      const item = { op: /** @type {ProposedItem['op']} */ (m[1]), id: m[2], target: m[3] }
      if (m[4]) item.text = m[4]
      items.push(item)
      last = { item, lines: [] }
    } else if (last && (/^ {2}/.test(line) || !line.trim())) last.lines.push(line.trim() ? line.slice(2).trimEnd() : '')
    else close()
  }
  close()
  /** @type {ChangeParts & { items: ProposedItem[], tickets: string | null }} */
  const out = { items, tickets: TICKETS.exec((text.tickets ?? []).join('\n'))?.[1] ?? null }
  for (const k of /** @type {const} */ (['problem', 'solution', 'scope', 'outOfScope', 'questions'])) {
    const t = (text[k] ?? []).join('\n').trim()
    if (t) out[k] = t
  }
  return out
}

/** @param {Fields} next @param {string} what */
export function needsTitle(next, what) {
  if (next.title != null) next.title = String(next.title).replace(/\s+/g, ' ').trim()
  if (!next.title) throw new Error(`a ${what} needs a title`)
}

/** @type {RecordType} */
export const MILESTONE_TYPE = {
  prefix: 'M',
  name: 'milestone',
  folder: MILESTONES,
  fields: ['title', 'status'],
  lifecycle: { field: 'status', states: ['planned', 'in-progress', 'done'], initial: 'planned', claude: ['planned'] },
  rules(next) {
    needsTitle(next, 'milestone')
    return next
  },
}

// What the store is opened with beside the modules: the core's own type.
export const CORE_RECORDS = { id: 'core', records: [MILESTONE_TYPE] }
