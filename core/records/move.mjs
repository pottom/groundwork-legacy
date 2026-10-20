// @ts-check
// Moving a proposed item to another target before the merge (C-5: d-approve-list-actions,
// d-move-writes-change): the human picks "Elsewhere…" on a row of the approval list, and the new
// target is written into the change's file at once, so Claude sees it and it survives a reload.
// The store gives it as store.targets and store.move:
//
//   targetsOf(store) -> [Target]   where a proposed item or section may go, in this order: the
//       Spec's documents, each followed by its sections ({ target: 'core/tech#t-sec', kind:
//       'section', title, document: 'core/tech' }; a section without an id is no target), then
//       the documents and sections the pending changes (not done, not dropped) propose, in id and
//       file order, each with `change: 'C-3'`, the change that brings it; what the Spec holds
//       already is listed once, as the Spec's. A new part is no target: Claude proposes one in chat.
//   moveItem(store, 'C-5', { item, target, by?, base? }) -> { id, item, from, target, version }
//       writes the item's line in the change file anew with the new target (changes.mjs:
//       retargetItem; its note and the rest of the file stay as they are), with the history line
//       `moved d-a: system#t-goal → core/tech#t-sec`. Only a new item (target a document or a
//       section) or a new section (target a document) moves: a change or supersede is found by its
//       id, a document goes into its part, a part into the parts. The same target writes nothing.
//       Refused, with the code:
//         missing   no change with that id, or no proposed item `item` in it
//         state     a change done or dropped      merged   a merged change: its items are in the Spec
//         stale     the change changed since `base`
//         bad       an item that does not move    target   a target not in targetsOf, or one that
//                                                            does not fit (a section into a section)

import { readChange, retargetItem, PARTS_TARGET, CLOSED, changeOf } from './changes.mjs'
import { itemTextOf, isDocId } from './spec-format.mjs'
import { isMerged } from './merge.mjs'

/** @typedef {import('./types.mjs').ProposedItem} ProposedItem */
/** @typedef {import('./types.mjs').Actor} Actor */
/** @typedef {{ target: string, kind: 'document' | 'section', title: string, document?: string, change?: string }} Target */
/**
 * What moving needs of the store.
 * @typedef {import('./merge.mjs').StoreLike & {
 *   update: (id: string, input: { fields?: Record<string, any>, body?: string }, opts: { by: Actor, base?: string, event?: string }) => import('./types.mjs').StoredRecord,
 * }} StoreLike
 */

/** @param {string} msg @param {string} code */
const fail = (msg, code) => Object.assign(new Error(msg), { code })

/** what a proposed item is, for moving: a new section, a new item, or nothing that moves @param {ProposedItem} it */
export function movableAs(it) {
  if (it.op !== 'add' || it.target === PARTS_TARGET || isDocId(it.id)) return null
  return !it.target.includes('#') && !itemTextOf(String(it.text ?? '')).marked ? 'section' : 'item'
}

/** @param {Pick<StoreLike, 'list' | 'spec'>} store @returns {Target[]} */
export function targetsOf(store) {
  /** @type {Target[]} */
  const out = []
  for (const d of store.spec.docs()) {
    out.push({ target: d.id, kind: 'document', title: d.title })
    for (const s of d.sections) if (s.id) out.push({ target: `${d.id}#${s.id}`, kind: 'section', title: s.title, document: d.id })
  }
  const seen = new Set(out.map((t) => t.target))
  for (const c of store.list('C')) {
    if (CLOSED.includes(String(c.fields.status ?? ''))) continue
    for (const it of readChange(c.body).items) {
      if (it.op !== 'add' || it.target === PARTS_TARGET) continue
      const title = String(it.text ?? '').trim() || it.id
      /** @type {Target | null} */
      const t = isDocId(it.id) ? { target: it.id, kind: 'document', title, change: c.id }
        : movableAs(it) === 'section' ? { target: `${it.target}#${it.id}`, kind: 'section', title, document: it.target, change: c.id }
        : null
      if (t && !seen.has(t.target)) { seen.add(t.target); out.push(t) }
    }
  }
  return out
}

/**
 * @param {StoreLike} store
 * @param {string} id
 * @param {{ item?: string, target?: string, by?: Actor, base?: string }} opts
 */
export function moveItem(store, id, { item = '', target = '', by = 'claude', base } = {}) {
  const rec = changeOf(store, id)
  if (!rec) throw fail(`no change ${id}`, 'missing')
  if (base != null && base !== rec.version) throw fail(`${id} changed since it was read`, 'stale')
  const status = String(rec.fields.status ?? '')
  if (CLOSED.includes(status)) throw fail(`${id} is ${status}: its items do not move any more`, 'state')
  const it = readChange(rec.body).items.find((i) => i.id === item)
  if (!it) throw fail(`${id} proposes no item ${item}`, 'missing')
  if (isMerged(store, id)) throw fail(`${id} is merged: its items are in the Spec`, 'merged')
  const as = movableAs(it)
  if (!as) throw fail(`${item} does not move: ${it.op !== 'add' ? `a ${it.op} is found by its id` : it.target === PARTS_TARGET ? 'a part goes into the parts' : 'a document goes into its part'}`, 'bad')
  const out = { id, item, from: it.target, target, version: rec.version }
  if (target === it.target) return out
  const fits = targetsOf(store).find((t) => t.target === target && (as === 'item' || t.kind === 'document'))
  if (!fits || target === `${it.target}#${it.id}`) throw fail(`${target} is no place for ${item}: ${as === 'section' ? 'a section goes into a document' : 'an item goes into a document or a section'} of the Spec or of a pending change`, 'target')
  const body = retargetItem(rec.body, item, target)
  if (body == null) throw fail(`${id} proposes no item ${item}`, 'missing')
  const saved = store.update(id, { body }, { by, base: rec.version, event: `moved ${item}: ${it.target} → ${target}` })
  return { ...out, version: saved.version }
}
