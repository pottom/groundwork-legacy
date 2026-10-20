// What <gw-mind-map> (mind-map.mjs) draws, as plain data: a tree of kinds turned into Mind Elixir's
// data, and the icons of the kinds. No imports, so the tests load it as the browser does.
//
//   tree: { topic, children: [MapNode] }   the root's topic, then the nodes
//   MapNode: { id, kind, text, recommended?, note?, link?, children: [MapNode] }
//            id: unique in the tree, made of [\w-] (Mind Elixir finds a node by it);
//            kind: one of KINDS; link: an id it points to, shown as `→ id`
//   KINDS                      kind → the inner markup of its 24×24 icon (Lucide, ISC license)
//   ROOT_ID                    the root's id
//   toMindElixir(tree)  -> { nodeData }     Mind Elixir's data, every branch open
//   indexTree(tree)     -> Map(id → { node, path })   path: the ids of its ancestors, root first
//   iconUrl(kind)       -> a CSS url() of the kind's icon, usable as a mask

export const ROOT_ID = 'gw-root'

export const KINDS = {
  thought: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  question: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  option: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
  decision: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  constraint: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  excluded: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
}

/** @typedef {{ id: string, kind: string, text: string, recommended?: boolean, note?: string, link?: string, children?: MapNode[] }} MapNode */
/** @typedef {{ topic: string, children?: MapNode[] }} Tree */

/** @param {Tree | null | undefined} tree */
export function toMindElixir(tree) {
  /** @param {MapNode} n @returns {any} */
  const node = (n) => ({ id: n.id, topic: n.text, expanded: true, children: (n.children ?? []).map(node) })
  return { nodeData: { id: ROOT_ID, topic: tree?.topic ?? '', root: true, expanded: true, children: (tree?.children ?? []).map(node) } }
}

/** @param {Tree | null | undefined} tree @returns {Map<string, { node: MapNode, path: string[] }>} */
export function indexTree(tree) {
  const out = new Map()
  /** @param {MapNode[]} nodes @param {string[]} path */
  const walk = (nodes, path) => { for (const n of nodes) { out.set(n.id, { node: n, path }); walk(n.children ?? [], [...path, n.id]) } }
  walk(tree?.children ?? [], [ROOT_ID])
  return out
}

/** @param {string} kind */
export function iconUrl(kind) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${KINDS[kind] ?? KINDS.thought}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
