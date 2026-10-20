// @ts-check
// Accepting an idea (C-6: d-accept-in-core, d-route-choice, d-idea-one-decision): the idea moves to
// accepted and a new change opens from it, in one step. Like the merge (merge.mjs), it is a rule of
// two record types, so it lives in the core's record store, which gives it as store.accept:
//
//   acceptIdea(store, 'I-5', { route, by, base? }) -> { route, idea, change }
//       the idea (I-n) and the change it opened (C-n), as written. The route is the way the change
//       goes on (ROUTES, d-route-choice): the human chooses it; the idea's kind only gives the
//       board's default.
//         grilling   the change starts in grilling: the idea's title, its text as the Probléma, the
//                    idea in its `ideas`, no milestone (the interview gives that)
//         ticket     straight to a ticket (d-direct-ticket): a minimal change, implementing at once
//                    (the acceptance is its approval), with the same title, problem and idea and no
//                    proposed items, so there is nothing to merge; Claude writes its ticket, with
//                    the `**Change:** C-n` line, from the prompt the card copies
//       A history line on both: `accepted → C-n` on the idea (before its status line), `created
//       from I-n` on the change. All or nothing: both writes are checked first (dry runs of every
//       check the store makes, the idea's on `base`), and nothing is written on any error. Then the
//       change is written first and the idea second: should the idea's write still fail, the new
//       change file is removed again (store.discard), so no change stays without its accepted idea,
//       and no accepted idea without its change. Refused, with the code (or the store's own, should
//       a write be refused: 'forbidden', 'stale', a type's rule):
//         forbidden   by is not 'human': Claude (the command line) never accepts an idea
//         bad         a route that is none of ROUTES          route    a route not built yet (none now)
//         missing     no idea with that id                    stale    the idea changed since `base`
//         state       the idea is accepted already, or no module declares the changes (C)
//
// A new route is one entry of OPENS: what the change it opens is made of (fields and body).

import { changeBody } from './changes.mjs'

/** @typedef {import('./types.mjs').Actor} Actor */
/** @typedef {import('./types.mjs').Fields} Fields */
/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {'grilling' | 'ticket'} Route */
/**
 * The change a route opens: its fields and its body (a function of the new change's id, as the
 * tickets rule names it).
 * @typedef {(idea: StoredRecord) => { fields: Fields, body: (id: string) => string }} Opens
 */
/**
 * What accept needs of the store; `discard` removes a record file it has just written.
 * @typedef {{
 *   get: (id: string) => StoredRecord | null,
 *   types: () => Array<{ prefix: string }>,
 *   create: (prefix: string, input: { fields?: Fields, body?: string | ((id: string) => string) }, opts: { by: Actor, event?: string, dry?: boolean }) => StoredRecord,
 *   update: (id: string, input: { fields?: Fields }, opts: { by: Actor, base?: string, event?: string, dry?: boolean }) => StoredRecord,
 *   discard?: (rec: StoredRecord) => void,
 * }} StoreLike
 */

/** @type {Route[]} */
export const ROUTES = ['grilling', 'ticket']

// A change from the idea: its title, its text as the problem, the idea in `ideas`; no milestone, no items.
/** @param {StoredRecord} idea @param {string} status @returns {ReturnType<Opens>} */
const fromIdea = (idea, status) => ({
  fields: { title: String(idea.fields.title ?? idea.id), ideas: [idea.id], status },
  body: (id) => changeBody({ problem: idea.body }, id),
})

/** @type {Partial<Record<Route, Opens>>} */
const OPENS = {
  grilling: (idea) => fromIdea(idea, 'grilling'),
  ticket: (idea) => fromIdea(idea, 'implementing'),
}

/** @param {string} msg @param {string} code */
const fail = (msg, code) => Object.assign(new Error(msg), { code })

/**
 * @param {StoreLike} store
 * @param {string} id
 * @param {{ route?: string, by?: Actor, base?: string }} [opts]
 * @returns {{ route: Route, idea: StoredRecord, change: StoredRecord }}
 */
export function acceptIdea(store, id, { route, by = 'claude', base } = {}) {
  if (by !== 'human') throw fail(`only a human accepts ${id} (on the Ideas board, in the browser)`, 'forbidden')
  const way = /** @type {Route} */ (route)
  if (!ROUTES.includes(way)) throw fail(`an idea is accepted on a route, ${ROUTES.join(' or ')}, not ${route ?? 'none'}`, 'bad')
  const opens = OPENS[way]
  if (!opens) throw fail(`the ${way} route is not built yet: accept ${id} on the grilling route`, 'route')
  const idea = /^I-\d+$/.test(String(id)) ? store.get(id) : null
  if (!idea || idea.type !== 'I') throw fail(`no idea ${id}`, 'missing')
  if (base != null && base !== idea.version) throw fail(`${id} changed since it was read`, 'stale')
  if (idea.fields.status === 'accepted') throw fail(`${id} is accepted already`, 'state')
  if (!store.types().some((t) => t.prefix === 'C')) throw fail(`no module keeps the changes: ${id} cannot open one`, 'state')

  const { fields, body } = opens(idea)
  const made = { by, event: `created from ${id}` }
  // Both writes checked first (dry runs), so neither is refused once the other is written.
  const planned = store.create('C', { fields, body }, { ...made, dry: true })
  const accepted = { fields: { status: 'accepted' } }
  const said = { by, base, event: `accepted → ${planned.id}` }
  store.update(id, accepted, { ...said, dry: true })

  const change = store.create('C', { fields, body }, made)
  if (change.id !== planned.id) {
    store.discard?.(change)
    throw fail(`${planned.id} was taken meanwhile: accept ${id} again`, 'stale')
  }
  try {
    return { route: way, idea: store.update(id, accepted, said), change }
  } catch (e) {
    store.discard?.(change)
    throw e
  }
}
