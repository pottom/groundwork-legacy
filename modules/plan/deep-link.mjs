// Plan's deep link: an address that opens Plan with one map node (PRD item) focused.
//
//   /?module=plan&node=<id>   through the shell (it hands ?node=<id> on to Plan's frame)
//   /plan/?node=<id>          Plan alone
//
// planLink(id) makes the first; linkTarget(location.search, map) reads either.

import { docOf } from './documents.mjs'

export const planLink = (id) => '/?module=plan&node=' + encodeURIComponent(id)

// The node the address names: null without one; else { id, found, path (the ids from the root
// down to its parent), doc (the document it is in, or null) }.
export function linkTarget(search, data) {
  const id = new URLSearchParams(search).get('node')
  if (!id) return null
  const path = []
  const find = (n) => {
    if (n.id === id) return true
    for (const c of n.children || []) if (find(c)) { path.unshift(n.id); return true }
    return false
  }
  if (!find(data.nodeData)) return { id, found: false, path: [], doc: null }
  return { id, found: true, path, doc: docOf(data, id) }
}
