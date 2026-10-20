// @ts-check
// The core's own record types: Change (C-n) and Milestone (M-n). The store (store.mjs) keeps them
// like any module's type; CORE_RECORDS declares them, and the server and `groundwork record` open
// the store with it beside the modules. They are the core's for now because the modules that will
// show them (the Changes and Overview workspaces) come later, and the core's own `migrate` writes
// them; a module can take a declaration over then, as long as one prefix keeps one type.
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
//   ## Jegyek
//   A jegyek a `**Change:** C-7` sorukkal hivatkoznak erre a változásra.
//   ## Történet
//
// A change's file reads on its own as a spec, with the structure of the to-spec template: problem,
// solution, scope, out of scope, questions, the proposed items (op, item id, → target) and, instead
// of a ticket list, the rule that finds its tickets. Every link is written once, on the later record
// toward its source (a change names its ideas and its milestone); the store computes the other way.
//
//   CHANGE_TYPE, MILESTONE_TYPE, CORE_RECORDS   the types, and the manifest-like entry declaring them
//   changeBody(parts, id)  -> Markdown           parts: { problem?, solution?, scope?, outOfScope?,
//                                                questions?, items?: [ProposedItem] }
//   readChange(body)       -> parts + { items, tickets }   patient: English headings too, `->` for
//                                                `→`, ids without backticks; a line that is not an
//                                                item stays text and is not an item
//   OPS                    the ops of a proposed item: add, change, supersede
//
// States. Change: grilling → awaiting-approval → implementing → done / dropped; Claude moves a change
// only between grilling and awaiting-approval (the human approves, closes and drops). Milestone:
// planned → in-progress → done; Claude proposes, the human moves it (Claude only creates one).

/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('./types.mjs').ChangeParts} ChangeParts */

export const CHANGES = 'docs/product/changes'
export const MILESTONES = 'docs/product/milestones'
export const OPS = ['add', 'change', 'supersede']

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
const itemLine = (i) => `- ${i.op} \`${i.id}\` → \`${i.target}\`${i.text ? ` — ${i.text}` : ''}`
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
  for (const line of text.items ?? []) {
    const m = ITEM.exec(line.trim())
    if (!m || !OPS.includes(m[1])) continue
    /** @type {ProposedItem} */
    const item = { op: /** @type {ProposedItem['op']} */ (m[1]), id: m[2], target: m[3] }
    if (m[4]) item.text = m[4]
    items.push(item)
  }
  /** @type {ChangeParts & { items: ProposedItem[], tickets: string | null }} */
  const out = { items, tickets: TICKETS.exec((text.tickets ?? []).join('\n'))?.[1] ?? null }
  for (const k of /** @type {const} */ (['problem', 'solution', 'scope', 'outOfScope', 'questions'])) {
    const t = (text[k] ?? []).join('\n').trim()
    if (t) out[k] = t
  }
  return out
}

/** @param {Fields} next @param {string} what */
function needsTitle(next, what) {
  if (next.title != null) next.title = String(next.title).replace(/\s+/g, ' ').trim()
  if (!next.title) throw new Error(`a ${what} needs a title`)
}

/** @type {RecordType} */
export const CHANGE_TYPE = {
  prefix: 'C',
  name: 'change',
  folder: CHANGES,
  fields: ['title', 'ideas', 'milestone', 'status'],
  lists: ['ideas'],
  links: ['ideas', 'milestone'],
  lifecycle: { field: 'status', states: ['grilling', 'awaiting-approval', 'implementing', 'done', 'dropped'], initial: 'grilling', claude: ['grilling', 'awaiting-approval'] },
  template: (id) => changeBody({}, id),
  outline: (body) => readChange(body),
  rules(next) {
    needsTitle(next, 'change')
    const ideas = next.ideas == null ? [] : Array.isArray(next.ideas) ? next.ideas : String(next.ideas).split(',')
    next.ideas = ideas.map((s) => String(s).trim()).filter(Boolean)
    for (const i of next.ideas) if (!/^I-\d+$/.test(i)) throw new Error(`ideas: a change names ideas by id (I-5), not ${i}`)
    if (next.milestone != null) {
      next.milestone = String(next.milestone).trim()
      if (next.milestone && !/^M-\d+$/.test(next.milestone)) throw new Error(`milestone: a change belongs to at most one milestone (M-9), not ${next.milestone}`)
    }
    return next
  },
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

// What the store is opened with beside the modules: the core's own types.
export const CORE_RECORDS = { id: 'core', records: [CHANGE_TYPE, MILESTONE_TYPE] }
