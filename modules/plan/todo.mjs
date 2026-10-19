// An idea from the Ideas module, as a node on the map (POST /api/plan/todo, module.mjs). Ideas never
// writes the map: it asks Plan, and Plan adds the node (d-ideas-plan-endpoint).
//
//   addIdea(store, { idea: 'I-12', title, status?: 'todo' | 'excluded', reason? })
//     -> { id, added }   the node's id; added is false when the idea was on the map already
//     throws (code 'bad') on a missing idea or title, another status, or a non-goal without its reason;
//     (code 'nodoc') when the map has no document to put the idea in (no root node)
//
// The node links to the idea (/?module=ideas&idea=I-12) and is marked as written by "ideas". It goes
// into the "Ideas" section of the first PRD (made on first use, titled in the document language), so
// the PRD lists a todo among its open questions and an excluded idea among its non-goals. The same
// idea gets the same node: sent again it is not added twice; sent as excluded it becomes a non-goal.

import crypto from 'node:crypto'
import { walk } from './map-store.mjs'
import { listDocs } from './documents.mjs'
import { docStrings, langOf } from './doc-strings.mjs'

export const IDEAS_SECTION = 'from-ideas'
export const ideaLink = (idea) => '/?module=ideas&idea=' + encodeURIComponent(idea)

const fail = (code, message) => Object.assign(new Error(message), { code })
const bad = (message) => fail('bad', message)
const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

export function addIdea(store, { idea, title, status = 'todo', reason } = {}) {
  idea = line(idea)
  title = line(title)
  reason = line(reason)
  if (!/^I-\d+$/.test(idea)) throw bad('idea must be an idea number like I-12')
  if (!title) throw bad('an idea needs a title')
  if (status !== 'todo' && status !== 'excluded') throw bad(`status must be todo or excluded, not ${status}`)
  if (status === 'excluded' && !reason) throw bad('a non-goal needs its reason')

  const { data } = store.read()
  if (!data?.nodeData?.id) throw fail('nodoc', 'the map has no document to put the idea in')
  const link = ideaLink(idea)
  let found = null
  let section = null
  walk(data.nodeData, (n) => {
    if (n.hyperLink === link && !found) found = n
    if (n.id === IDEAS_SECTION) section = n
  })
  if (found) {
    // A todo already on the map may have moved on; only a rejection changes it.
    if (status === 'excluded') store.apply([{ op: 'set', id: found.id, status, note: reason }], 'ideas')
    return { id: found.id, added: false }
  }
  const ops = []
  if (!section) {
    const docs = listDocs(data)
    const doc = docs.find((d) => d.kind === 'prd') ?? docs[0]
    ops.push({ op: 'add', id: IDEAS_SECTION, parent: doc.node.id, topic: docStrings(langOf(data)).ideasSection })
  }
  const id = crypto.randomBytes(6).toString('hex')
  ops.push({ op: 'add', id, parent: IDEAS_SECTION, topic: title, status, note: reason || undefined, link })
  const { errors } = store.apply(ops, 'ideas')
  if (errors.length) throw new Error(errors.join('; '))
  return { id, added: true }
}
