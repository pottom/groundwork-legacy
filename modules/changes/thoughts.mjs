// @ts-check
// A change's thought map on its page (C-4): shared by the server (page.mjs: the content it compares)
// and the page (the map and the open questions it draws). No imports, so the browser loads it as is.
//
//   flatThoughts(nodes)  -> [Thought]   the map's nodes (core/records/changes.mjs: ThoughtNode) in the
//                                       file's order: { key, id, parent, kind, recommended?, text,
//                                       note?, item? }. key: the text, lower case, blanks folded, with
//                                       ` #2`… for a repeated text (compare.mjs knows a node by it);
//                                       parent: its parent's key, null at the top; id: from the key,
//                                       made of [\w-] (the map finds a node by it)
//   idOf(key)            -> id
//   mapTree(title, thoughts, removed?)  -> the tree <gw-mind-map> draws (core/shell/mind-map-tree.mjs):
//                                       the root is the title; removed nodes (struck through until the
//                                       next commit) stand under their old parent, or at the top
//   mapMarks(diff)       -> { [id]: 'new' | 'modified' | 'removed' }   a Diff's marks of the map
//                                       (compare.mjs), by the ids <gw-mind-map> knows; {} for none
//   openQuestions(thoughts, marks?)  -> [{ id, key, text, note?, options: [{ id, text, recommended? }] }]
//                                       the ? nodes with their ~ children, the latest on top: the ones
//                                       new or modified since the last commit first, then the later in
//                                       the file before the earlier

// the core's ThoughtNode (core/records/types.mjs), written out: the page loads only this module's files
/** @typedef {{ kind: 'thought' | 'question' | 'option' | 'decision' | 'constraint' | 'excluded', text: string, recommended?: boolean, note?: string, item?: string, children?: ThoughtNode[] }} ThoughtNode */
/** @typedef {{ key: string, id: string, parent: string | null, kind: string, recommended?: boolean, text: string, note?: string, item?: string }} Thought */

/** @param {string} text */
const keyOf = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase()

/** @param {string} key */
export function idOf(key) {
  let h = 5381
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0
  return `t-${h.toString(36)}`
}

/** @param {ThoughtNode[] | undefined} nodes @returns {Thought[]} */
export function flatThoughts(nodes) {
  /** @type {Thought[]} */
  const out = []
  /** @type {Map<string, number>} */
  const seen = new Map()
  /** @param {ThoughtNode[]} list @param {string | null} parent */
  const walk = (list, parent) => {
    for (const n of list) {
      const base = keyOf(n.text)
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      const key = count > 1 ? `${base} #${count}` : base
      /** @type {Thought} */
      const t = { key, id: idOf(key), parent, kind: n.kind, text: n.text }
      if (n.recommended) t.recommended = true
      if (n.note) t.note = n.note
      if (n.item) t.item = n.item
      out.push(t)
      walk(n.children ?? [], key)
    }
  }
  walk(nodes ?? [], null)
  return out
}

/** @param {string} title @param {Thought[]} thoughts @param {Thought[]} [removed] */
export function mapTree(title, thoughts, removed = []) {
  /** @type {Map<string, any>} */
  const byKey = new Map()
  const root = { topic: title, children: /** @type {any[]} */ ([]) }
  for (const t of [...thoughts, ...removed.filter((r) => !thoughts.some((t) => t.key === r.key))]) {
    const node = { id: t.id, kind: t.kind, text: t.text, children: [],
      ...(t.recommended ? { recommended: true } : {}), ...(t.note ? { note: t.note } : {}), ...(t.item ? { link: t.item } : {}) }
    byKey.set(t.key, node)
    ;(t.parent != null && byKey.get(t.parent) ? byKey.get(t.parent).children : root.children).push(node)
  }
  return root
}

/** @param {{ thoughts?: Record<string, string>, removed?: { thoughts?: Thought[] } } | null | undefined} diff */
export function mapMarks(diff) {
  /** @type {Record<string, string>} */
  const out = {}
  for (const [key, mark] of Object.entries(diff?.thoughts ?? {})) out[idOf(key)] = mark
  for (const t of diff?.removed?.thoughts ?? []) out[t.id] = 'removed'
  return out
}

/** @param {Thought[]} thoughts @param {{ thoughts?: Record<string, string> } | null} [marks] */
export function openQuestions(thoughts, marks = null) {
  const fresh = (/** @type {Thought} */ q) => (marks?.thoughts?.[q.key] ? 1 : 0)
  return thoughts
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.kind === 'question')
    .sort((a, b) => fresh(b.t) - fresh(a.t) || b.i - a.i)
    .map(({ t }) => ({
      id: t.id, key: t.key, text: t.text, ...(t.note ? { note: t.note } : {}),
      options: thoughts.filter((o) => o.parent === t.key && o.kind === 'option')
        .map((o) => ({ id: o.id, text: o.text, ...(o.recommended ? { recommended: true } : {}) })),
    }))
}
