// A Mermaid flowchart, read and laid out in Node, for `groundwork sketch apply`'s mermaid op.
//
//   layoutFlowchart(source, sizeOf)   { nodes: [{ id, label, shape, x, y, width, height }],
//                                       edges: [{ from, to, label, arrow, dashed, thick }] }
//                                     sizeOf(shape, label) -> { width, height }; x, y from 0,0
//
// Why here and not Excalidraw's parseMermaidToExcalidraw: that one renders the chart with Mermaid,
// which needs a browser's DOM, so the command line could draw only while a page is open. A
// flowchart is boxes and arrows; reading its common syntax and placing it in layers is enough.
//
// What it reads: `flowchart` or `graph` with TD, TB, BT, LR or RL; nodes `id`, `id[box]`,
// `id(round)`, `id([stadium])`, `id[[sub]]`, `id[(db)]`, `id{decision}`, `id{{hex}}`,
// `id((circle))`, `id>flag]`, labels in quotes too; edges `-->`, `---`, `-.->`, `==>`, with a label
// as `-->|text|` or `-- text -->`, chained (`a --> b --> c`) and with `&` (`a --> b & c`). Lines
// with classDef, class, style, linkStyle, click, subgraph, end and direction are skipped (a
// subgraph's nodes are drawn, without a frame). Anything else is an error saying which line.
//
// The layout: each node goes one layer after the nodes pointing to it (a cycle's way back is not
// counted); nodes of a layer sit side by side, in the order they first appear, centred on the line.

const GAP_LAYER = 100
const GAP_SIDE = 60

const SHAPES = [   // opening, closing, shape; the longer openings first
  ['([', '])', 'rectangle'], ['[[', ']]', 'rectangle'], ['[(', ')]', 'rectangle'], ['((', '))', 'ellipse'],
  ['{{', '}}', 'diamond'], ['[/', '/]', 'rectangle'], ['[\\', '\\]', 'rectangle'], ['[/', '\\]', 'rectangle'], ['[\\', '/]', 'rectangle'],
  ['[', ']', 'rectangle'], ['(', ')', 'rectangle'], ['{', '}', 'diamond'], ['>', ']', 'rectangle'],
]
const SKIP = /^(classDef|class|style|linkStyle|click|subgraph|end|direction)\b/
const EDGES = [
  /^\s*<?(-{2,}|={2,}|-\.+-)([>ox]?)\s*\|([^|]*)\|/,              // -->|label|
  /^\s*<?(--|==|-\.)\s+(.+?)\s+(-{2,}|={2,}|\.+-)([>ox]?)/,      // -- label -->
  /^\s*<?(-{2,}|={2,}|-\.+-)([>ox]?)/,                           // -->
]

const clean = (s) => s.trim().replace(/^"(.*)"$/s, '$1').replace(/<br\s*\/?>/gi, '\n').trim()

function edgeAt(text) {
  let m = EDGES[0].exec(text)
  if (m) return { len: m[0].length, line: m[1], head: m[2], label: clean(m[3]) }
  m = EDGES[1].exec(text)
  if (m) return { len: m[0].length, line: m[1] + m[3], head: m[4], label: clean(m[2]) }
  m = EDGES[2].exec(text)
  if (m) return { len: m[0].length, line: m[1], head: m[2], label: '' }
  return null
}

// One statement: node groups joined by edges. Adds to nodes (a Map) and edges.
function statement(text, nodes, edges, where) {
  let rest = text
  const group = () => {
    const ids = []
    for (;;) {
      const m = /^\s*([A-Za-z0-9_]+)/.exec(rest)
      if (!m) throw new Error(`${where}: expected a node at "${rest.trim()}"`)
      rest = rest.slice(m[0].length)
      const id = m[1]
      const shape = SHAPES.find(([open]) => rest.startsWith(open))
      let node = nodes.get(id) ?? { id, label: id, shape: 'rectangle' }
      if (shape) {
        const [open, close, kind] = shape
        const end = rest.indexOf(close, open.length)
        if (end < 0) throw new Error(`${where}: "${open}" of ${id} is not closed with "${close}"`)
        node = { ...node, label: clean(rest.slice(open.length, end)) || id, shape: kind }
        rest = rest.slice(end + close.length)
      }
      nodes.set(id, node)
      ids.push(id)
      const amp = /^\s*&/.exec(rest)
      if (!amp) return ids
      rest = rest.slice(amp[0].length)
    }
  }
  let from = group()
  while (rest.trim()) {
    const e = edgeAt(rest)
    if (!e) throw new Error(`${where}: expected an edge (-->, ---, -.->, ==>) at "${rest.trim()}"`)
    rest = rest.slice(e.len)
    const to = group()
    for (const a of from) for (const b of to)
      edges.push({ from: a, to: b, label: e.label, arrow: e.head !== '', dashed: e.line.includes('.'), thick: e.line.includes('=') })
    from = to
  }
}

export function parseFlowchart(source) {
  const lines = String(source).split('\n').map((l) => l.replace(/%%.*$/, '').trim())
  const first = lines.findIndex(Boolean)
  const head = /^(flowchart|graph)(?:\s+(TD|TB|BT|LR|RL))?\s*;?$/i.exec(lines[first] ?? '')
  if (!head) throw new Error('only a flowchart is drawn: it starts with "flowchart TD" (or graph, and TB, BT, LR, RL)')
  const nodes = new Map(), edges = []
  lines.forEach((line, i) => {
    if (i <= first || !line) return
    for (const part of line.split(';').map((p) => p.trim()).filter(Boolean)) {
      if (!SKIP.test(part)) statement(part, nodes, edges, `line ${i + 1}`)
    }
  })
  if (!nodes.size) throw new Error('the flowchart has no nodes')
  return { direction: (head[2] ?? 'TD').toUpperCase().replace('TB', 'TD'), nodes: [...nodes.values()], edges }
}

// The layer of each node: one after the latest node pointing to it, the way back of a cycle aside.
function layers(nodes, edges) {
  const out = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) out.get(e.from).push(e.to)
  const state = new Map(), forward = []
  const visit = (id) => {
    state.set(id, 1)
    for (const to of out.get(id)) {
      if (state.get(to) === 1) continue                 // back to a node on the way: a cycle
      forward.push([id, to])
      if (!state.has(to)) visit(to)
    }
    state.set(id, 2)
  }
  for (const n of nodes) if (!state.has(n.id)) visit(n.id)
  const layer = new Map(nodes.map((n) => [n.id, 0]))
  for (let changed = true, guard = 0; changed && guard <= nodes.length; guard++) {
    changed = false
    for (const [a, b] of forward) if (layer.get(b) < layer.get(a) + 1) { layer.set(b, layer.get(a) + 1); changed = true }
  }
  return layer
}

export function layoutFlowchart(source, sizeOf) {
  const { direction, nodes, edges } = parseFlowchart(source)
  const layer = layers(nodes, edges)
  const across = direction === 'LR' || direction === 'RL'
  const placed = nodes.map((n) => ({ ...n, ...sizeOf(n.shape, n.label) }))
  const rows = []
  for (const n of placed) (rows[layer.get(n.id)] ??= []).push(n)

  // Along: the direction of the flow; side: across it. A row's nodes are centred on its line.
  const along = (n) => (across ? n.width : n.height), side = (n) => (across ? n.height : n.width)
  const widths = rows.map((row) => row.reduce((s, n) => s + side(n), 0) + GAP_SIDE * (row.length - 1))
  const widest = Math.max(...widths)
  let pos = 0
  rows.forEach((row, i) => {
    const depth = Math.max(...row.map(along))
    let s = (widest - widths[i]) / 2
    for (const n of row) {
      const a = Math.round(pos + (depth - along(n)) / 2), b = Math.round(s)
      Object.assign(n, across ? { x: a, y: b } : { x: b, y: a })
      s += side(n) + GAP_SIDE
    }
    pos += depth + GAP_LAYER
  })
  if (direction === 'BT' || direction === 'RL') {
    const total = pos - GAP_LAYER
    for (const n of placed) {
      if (across) n.x = total - n.x - n.width
      else n.y = total - n.y - n.height
    }
  }
  return { nodes: placed, edges }
}
