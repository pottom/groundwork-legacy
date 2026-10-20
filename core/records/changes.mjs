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
//   ## Probléma ... ## Kihagyjuk                  ## Történet
//   ## Gondolatok
//   - ? A question → `d-x`
//     Its note, indented under it.
//     - ~! The recommended option
//   ## Javasolt elemek
//   - add `d-rec-change` → `records/tech#t-rec-data` — Change (C-n) is a record
//     Its note: lines indented two spaces under the item.
//   ## Jegyek
//   A jegyek a `**Change:** C-7` sorukkal hivatkoznak erre a változásra.
//   ## Történet
//
// A change's file reads on its own as a spec, with the structure of the to-spec template: problem,
// solution, scope, out of scope, the thought map, the proposed items (op, item id, → target) and, instead
// of a ticket list, the rule that finds its tickets. Every link is written once, on the later record
// toward its source (a change names its ideas and its milestone); the store computes the other way.
//
//   MILESTONE_TYPE, CORE_RECORDS   the type, and the manifest-like entry declaring it
//   needsTitle(next, what)         a type's rule: tidies the title, refuses a record without one
//   changeBody(parts, id)  -> Markdown           parts: { problem?, solution?, scope?, outOfScope?,
//                                                thoughts?: [ThoughtNode], questions?, items?: [ProposedItem] }
//                                                The old Questions list is written only when it has text
//   readChange(body)       -> parts + { items, tickets }   patient: English headings too, `->` for
//                                                `→`, ids without backticks; a line that is not an
//                                                item stays text and is not an item
//   retargetItem(body, id, target) -> body | null   the body with the proposed item's line written
//                                                anew in the canonical form with the new target
//                                                (its note and every other line as they were); null
//                                                when no proposed item has that id
//   readThoughts(text)     -> { nodes, unknown, at }   the thought map of a Thoughts section's text;
//                                                unknown: [{ line, sign }] (0-based in the text), the
//                                                lines whose first word looks like a sign but is none;
//                                                at: [{ line, node }], the line of every node
//   thoughtsText(nodes)    -> Markdown           the canonical list of a thought map
//   SIGNS                  sign → { kind, recommended? }
//   OPS                    the ops of a proposed item: add, change, supersede
//   PARTS_TARGET           'parts': the target of a proposed part (the list in spec/parts.md); a
//                          proposed document's target is its part, a section's its document, an
//                          item's `<document>#<section or parent item>`
//
// The thought map (d-map-in-md, d-map-signs): the `## Gondolatok` section (`## Thoughts` read too),
// a nested list. Indentation gives the branches; the sign at the start of a line the node's kind,
// whatever the document's language: `?` question, `~` option, `~!` the recommended option,
// `=` decision, `!` constraint, `x` out of scope, none a plain thought. A node may end in
// `→ \`<id>\``, the proposed item it became; its note is the lines indented under it before its
// children (a note line starting with `- ` reads as a child). The root is the change's title, not
// stored (d-map-root). The open questions of a change are its map's `?` nodes (d-map-questions); the
// old `## Kérdések` list is still read, but a new change has none.
//
// States. Milestone: planned → in-progress → done; Claude proposes, the human moves it (Claude only
// creates one). A change's states are its type's (modules/changes/type.mjs).

/** @typedef {import('./types.mjs').RecordType} RecordType */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('./types.mjs').ChangeParts} ChangeParts */
/** @typedef {import('./types.mjs').ThoughtNode} ThoughtNode */

export const CHANGES = 'docs/product/changes'
export const MILESTONES = 'docs/product/milestones'
export const OPS = ['add', 'change', 'supersede']
export const PARTS_TARGET = 'parts'

// The sections of a change, in order: the heading written, and the ones read too.
/** @type {Array<{ key: 'problem' | 'solution' | 'scope' | 'outOfScope' | 'thoughts' | 'questions' | 'items' | 'tickets', heading: string, also: string[] }>} */
export const SECTIONS = [
  { key: 'problem', heading: 'Probléma', also: ['Problem', 'Problem Statement'] },
  { key: 'solution', heading: 'Megoldás', also: ['Solution'] },
  { key: 'scope', heading: 'Keret', also: ['Scope'] },
  { key: 'outOfScope', heading: 'Kihagyjuk', also: ['Out of scope'] },
  { key: 'thoughts', heading: 'Gondolatok', also: ['Thoughts'] },
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
    else if (s.key === 'thoughts') text = thoughtsText(parts.thoughts ?? [])
    else text = String(parts[s.key] ?? '').trim()
    if (s.key === 'questions' && !text) continue   // the old list: nothing new writes it
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
  const thoughts = readThoughts((text.thoughts ?? []).join('\n')).nodes
  if (thoughts.length) out.thoughts = thoughts
  for (const k of /** @type {const} */ (['problem', 'solution', 'scope', 'outOfScope', 'questions'])) {
    const t = (text[k] ?? []).join('\n').trim()
    if (t) out[k] = t
  }
  return out
}

/**
 * @param {string} body
 * @param {string} id
 * @param {string} target
 * @returns {string | null}
 */
export function retargetItem(body, id, target) {
  const lines = String(body ?? '').split('\n')
  /** @type {string | null} */
  let at = null
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n].replace(/\r$/, '')
    const h = HEADING.exec(line)
    if (h) {
      const name = h[1].toLowerCase()
      at = SECTIONS.find((x) => [x.heading, ...x.also].some((y) => y.toLowerCase() === name))?.key ?? null
      continue
    }
    if (at !== 'items') continue
    const m = ITEM.exec(line.trim())
    if (!m || !OPS.includes(m[1]) || m[2] !== id) continue
    const cr = lines[n].endsWith('\r') ? '\r' : ''
    lines[n] = itemLine({ op: /** @type {ProposedItem['op']} */ (m[1]), id, target, ...(m[4] ? { text: m[4] } : {}) }) + cr
    return lines.join('\n')
  }
  return null
}

// ---- the thought map ----

/** @type {Record<string, { kind: ThoughtNode['kind'], recommended?: true }>} */
export const SIGNS = {
  '?': { kind: 'question' },
  '~': { kind: 'option' },
  '~!': { kind: 'option', recommended: true },
  '=': { kind: 'decision' },
  '!': { kind: 'constraint' },
  'x': { kind: 'excluded' },
}
const BULLET = /^([ \t]*)[-*+]\s+(.*?)\s*$/
const LINK = /\s+(?:→|->)\s+`?([\w./#-]+)`?$/
// a first word of one to three marks that is no sign: a mistyped one (`?!`, `~?`, `>`)
const SIGNISH = /^[?~!=+>%&^|:;.,<@$]{1,3}$/
/** @param {string} s */
const width = (s) => s.replace(/\t/g, '  ').length

/**
 * The thought map of a Thoughts section's text, read patiently: any of `-*+` as bullet, any deeper
 * indent as a child, `->` for `→`, an id without backticks.
 * @param {string} section
 * @returns {{ nodes: ThoughtNode[], unknown: Array<{ line: number, sign: string }>, at: Array<{ line: number, node: ThoughtNode }> }}
 */
export function readThoughts(section) {
  /** @type {ThoughtNode[]} */
  const nodes = []
  /** @type {Array<{ line: number, sign: string }>} */
  const unknown = []
  /** @typedef {{ indent: number, node: ThoughtNode, note: string[], line: number }} Open */
  /** @type {Open[]} */
  const stack = []
  /** @type {Open[]} */
  const all = []
  /** @type {Open | null} */
  let target = null   // the node the next blank line belongs to
  String(section ?? '').replace(/\r\n/g, '\n').split('\n').forEach((line, i) => {
    if (!line.trim()) { target?.note.push(''); return }
    const indent = width(/^[ \t]*/.exec(line)?.[0] ?? '')
    const b = BULLET.exec(line)
    if (!b) {
      // a note line: of the deepest open node it is indented under; prose at the top is no node
      target = [...stack].reverse().find((s) => s.indent < indent) ?? null
      if (target) target.note.push(' '.repeat(Math.max(0, indent - target.indent - 2)) + line.trim())
      return
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const [first, ...words] = b[2].split(/\s+/)
    const sign = words.length ? SIGNS[first === 'X' ? 'x' : first] : undefined
    if (!sign && words.length && SIGNISH.test(first)) unknown.push({ line: i, sign: first })
    /** @type {ThoughtNode} */
    const node = { kind: sign?.kind ?? 'thought', text: sign ? b[2].slice(first.length).trim() : b[2], children: [] }
    if (sign?.recommended) node.recommended = true
    const link = LINK.exec(node.text)
    if (link) { node.text = node.text.slice(0, link.index).trim(); node.item = link[1] }
    ;(stack.length ? stack[stack.length - 1].node.children : nodes).push(node)
    target = { indent, node, note: [], line: i }
    stack.push(target)
    all.push(target)
  })
  for (const { node, note } of all) {
    const text = note.join('\n').replace(/^\n+|\n+$/g, '')
    if (text) node.note = text
  }
  return { nodes, unknown, at: all.map(({ line, node }) => ({ line, node })) }
}

/** @param {ThoughtNode} n */
const signOf = (n) => (n.kind === 'option' && n.recommended ? '~!' : Object.keys(SIGNS).find((k) => SIGNS[k].kind === n.kind && !SIGNS[k].recommended) ?? '')

/**
 * The canonical Markdown of a thought map: two spaces per level, the sign, the text, the link; the
 * note under the node, then its children.
 * @param {ThoughtNode[]} nodes
 * @param {number} [depth]
 * @returns {string}
 */
export function thoughtsText(nodes, depth = 0) {
  const pad = '  '.repeat(depth)
  return nodes.map((n) => {
    const sign = signOf(n)
    const lines = [`${pad}- ${sign ? `${sign} ` : ''}${n.text}${n.item ? ` → \`${n.item}\`` : ''}`]
    if (n.note) for (const l of n.note.split('\n')) lines.push(l ? `${pad}  ${l}` : '')
    if (n.children?.length) lines.push(thoughtsText(n.children, depth + 1))
    return lines.join('\n')
  }).join('\n')
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
