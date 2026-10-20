// @ts-check
// What an id means, beyond the records and the Spec the store holds: the ids a pending change
// proposes (they resolve before the merge, so tickets can name them), and the old ids a merged
// change lists with what they became (in its scope: ids that are no Spec ids any more, but
// tickets name them). Nothing here knows a project: the lists are read from the changes.
//
//   const r = resolver(store)      reads the changes once
//   r.resolve(id) -> Resolved | null, in this order:
//     { kind: 'record', id, record }                 a record (I-5, C-2, M-9)
//     { kind: 'spec', id, found }                    a Spec id (store.spec.find)
//     { kind: 'proposed', id, item, change }         an id a pending change (not done, not
//                                                    dropped) adds: { op, id, target, text?, note? },
//                                                    and the change { id, title, status, file }
//     { kind: 'alias', id, to, change, note, target }   an old id a merged (done) change lists in
//                                                    its scope as `- \`c-core\` → \`core\` (part)`;
//                                                    to '' when it became nothing (`→ none`);
//                                                    target: what `to` resolves to, or null
//   r.proposed   Map id -> { item, change }       r.aliases   Map old id -> { to, change, note }
//
// store.resolve(id) is resolver(store).resolve(id); `record check` uses one resolver for the ids
// the store does not hold itself.

import { readChange } from './changes.mjs'

/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {{ id: string, title: string, status: string, file: string }} ChangeRef */
/**
 * @typedef {{ kind: 'record', id: string, record: StoredRecord }
 *   | { kind: 'spec', id: string, found: import('./spec-store.mjs').Found }
 *   | { kind: 'proposed', id: string, item: ProposedItem, change: ChangeRef }
 *   | { kind: 'alias', id: string, to: string, change: string, note: string, target: Resolved | null }} Resolved
 */
/**
 * What the resolver needs of the store.
 * @typedef {{ list: (prefix?: string) => StoredRecord[], spec: { find: (id: string) => import('./spec-store.mjs').Found | null } }} StoreLike
 */

const ALIAS = /^[-*]\s+`([^`\s]+)`\s+(?:→|->)\s+(.*?)\s*$/
const PENDING_NOT = ['done', 'dropped']

/** @param {StoredRecord} c @returns {ChangeRef} */
const refOf = (c) => ({ id: c.id, title: String(c.fields.title ?? ''), status: String(c.fields.status ?? ''), file: c.file })

/**
 * The old ids a change's scope lists: `- \`old\` → \`new\` (note)`, `- \`old\` → M-2 (note)`,
 * `- \`old\` → none (note)` (anything else after the arrow: it became nothing).
 * @param {string | undefined} scope
 * @returns {Array<{ from: string, to: string, note: string }>}
 */
export function aliasLines(scope) {
  const out = []
  for (const line of String(scope ?? '').split('\n')) {
    const m = ALIAS.exec(line.trim())
    if (!m) continue
    let rest = m[2]
    const note = /\(([^()]*)\)$/.exec(rest)
    if (note) rest = rest.slice(0, note.index).trim()
    const to = /^`([^`\s]+)`$/.exec(rest)?.[1] ?? (/^[A-Z]+-\d+$/.test(rest) ? rest : '')
    out.push({ from: m[1], to, note: note?.[1] ?? '' })
  }
  return out
}

/** @param {StoreLike} store */
export function resolver(store) {
  /** @type {Map<string, { item: ProposedItem, change: ChangeRef }>} */
  const proposed = new Map()
  /** @type {Map<string, { to: string, change: string, note: string }>} */
  const aliases = new Map()
  const records = store.list()
  const byId = new Map(records.map((r) => [r.id, r]))
  for (const c of records.filter((r) => r.type === 'C')) {
    const status = String(c.fields.status ?? '')
    const parts = readChange(c.body)
    if (status === 'done') {
      for (const a of aliasLines(parts.scope)) if (!aliases.has(a.from)) aliases.set(a.from, { to: a.to, change: c.id, note: a.note })
    } else if (!PENDING_NOT.includes(status)) {
      // only an `add` brings a new id; a change or a supersede names one the Spec must hold
      for (const item of parts.items) if (item.op === 'add' && !proposed.has(item.id)) proposed.set(item.id, { item, change: refOf(c) })
    }
  }

  /** @param {string} id @param {Set<string>} seen @returns {Resolved | null} */
  function resolve(id, seen = new Set()) {
    const record = byId.get(id)
    if (record) return { kind: 'record', id, record }
    const found = store.spec.find(id)
    if (found) return { kind: 'spec', id, found }
    const p = proposed.get(id)
    if (p) return { kind: 'proposed', id, item: p.item, change: p.change }
    const a = aliases.get(id)
    if (a && !seen.has(id)) {
      seen.add(id)
      return { kind: 'alias', id, to: a.to, change: a.change, note: a.note, target: a.to ? resolve(a.to, seen) : null }
    }
    return null
  }

  return { proposed, aliases, resolve: (/** @type {string} */ id) => resolve(id) }
}
