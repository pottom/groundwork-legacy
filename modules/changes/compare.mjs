// @ts-check
// What changed between two versions of a change, part by part: shared by the server (the marks of
// what changed since the last commit, d-changes-since-commit) and the page (what the last write
// changed, highlighted for a moment, d-changes-flash). No imports, so the browser loads it as is.
//
//   compareChanges(before, after) -> Diff      before null: nothing to compare with, NO_CHANGES
//   NO_CHANGES                                 the Diff of two equal versions (frozen)
//
// A version is the content of a change page (stages.mjs: contentOf):
//   { title, sections: { problem?, solution?, scope?, outOfScope?, questionsText? },
//     questions: [{ key, text, done }], items: [{ op, id, target, text?, note? }] }
// A Diff:
//   { title: 'modified' | null,
//     sections:  { [key]: 'new' | 'modified' | 'removed' },
//     questions: { [key]: 'new' | 'modified' },       a question is known by its text (key); checking it modifies it
//     items:     { [id]:  'new' | 'modified' },       a proposed item by its id: op, target, text or note
//     removed:   { sections: { [key]: text }, questions: [Question], items: [Item] } }   to show struck through
// Whitespace alone and the order of the items or questions are no change.

/** @typedef {{ key: string, text: string, done: boolean }} Question */
/** @typedef {{ op: string, id: string, target: string, text?: string, note?: string }} Item */
/** @typedef {{ title?: string, sections: Record<string, string | undefined>, questions: Question[], items: Item[] }} Content */
/** @typedef {'new' | 'modified' | 'removed'} Mark */
/**
 * @typedef {Object} Diff
 * @property {'modified' | null} title
 * @property {Record<string, Mark>} sections
 * @property {Record<string, 'new' | 'modified'>} questions
 * @property {Record<string, 'new' | 'modified'>} items
 * @property {{ sections: Record<string, string>, questions: Question[], items: Item[] }} removed
 */

export const NO_CHANGES = /** @type {Diff} */ (/** @type {unknown} */ (Object.freeze({ title: null, sections: Object.freeze({}), questions: Object.freeze({}), items: Object.freeze({}),
  removed: Object.freeze({ sections: Object.freeze({}), questions: Object.freeze([]), items: Object.freeze([]) }) })))

/** @param {unknown} s */
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
/** @param {Item} i */
const itemSig = (i) => [i.op, i.target, norm(i.text), norm(i.note)].join('\u0000')

/**
 * @param {Content | null | undefined} before
 * @param {Content} after
 * @returns {Diff}
 */
export function compareChanges(before, after) {
  if (!before) return NO_CHANGES
  /** @type {Diff} */
  const d = { title: norm(before.title) === norm(after.title) ? null : 'modified', sections: {}, questions: {}, items: {}, removed: { sections: {}, questions: [], items: [] } }

  for (const key of new Set([...Object.keys(before.sections), ...Object.keys(after.sections)])) {
    const was = norm(before.sections[key])
    const now = norm(after.sections[key])
    if (was === now) continue
    if (!was) d.sections[key] = 'new'
    else if (!now) { d.sections[key] = 'removed'; d.removed.sections[key] = String(before.sections[key]) }
    else d.sections[key] = 'modified'
  }

  const oldQ = new Map(before.questions.map((q) => [q.key, q]))
  const newQ = new Set(after.questions.map((q) => q.key))
  for (const q of after.questions) {
    const was = oldQ.get(q.key)
    if (!was) d.questions[q.key] = 'new'
    else if (was.done !== q.done) d.questions[q.key] = 'modified'
  }
  d.removed.questions = before.questions.filter((q) => !newQ.has(q.key))

  const oldI = new Map(before.items.map((i) => [i.id, i]))
  const newI = new Set(after.items.map((i) => i.id))
  for (const i of after.items) {
    const was = oldI.get(i.id)
    if (!was) d.items[i.id] = 'new'
    else if (itemSig(was) !== itemSig(i)) d.items[i.id] = 'modified'
  }
  d.removed.items = before.items.filter((i) => !newI.has(i.id))
  return d
}

/** Whether a Diff marks anything. @param {Diff} d */
export const anyChange = (d) => Boolean(d.title || Object.keys(d.sections).length || Object.keys(d.questions).length || Object.keys(d.items).length
  || d.removed.questions.length || d.removed.items.length)
