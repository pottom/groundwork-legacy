// What `groundwork sketch apply` does to a sketch's elements: Claude's drawing ops, turned into
// Excalidraw elements as the standard .excalidraw file has them (f-board-claude-draw).
//
//   applyOps(elements, ops)   the elements after the ops, in order; throws OpError, and then none
//                             of the ops count (the caller writes nothing)
//
// The ops (`id` is optional on add: a short random one is made; give one to refer to it later):
//   { op: 'add', type: 'rectangle'|'ellipse'|'diamond', id, x, y, width, height, label }
//   { op: 'add', type: 'text', id, x, y, text, fontSize }
//   { op: 'add', type: 'arrow'|'line', id, from, to, label }       from/to: ids of shapes, bound to them
//   { op: 'add', type: 'arrow'|'line', id, points: [[x, y], ...] } or free, absolute points
//   { op: 'move', id, x, y } or { op: 'move', id, dx, dy }        a shape takes its label and arrows along
//   { op: 'update', id, label | text, width, height, <style>, <font> }
//   { op: 'delete', id }                                          a shape's label goes too; its arrows stay, unbound
//   { op: 'mermaid', source, x, y }                               a Mermaid flowchart, laid out (mermaid.mjs)
// Style, on add and update: strokeColor, backgroundColor, fillStyle, strokeWidth, strokeStyle,
// roughness, opacity, link. Font, on add and update of a text, or of a shape's or an arrow's label:
// fontFamily (1 hand-drawn, 2 normal, 3 code), fontSize. Without x and y a new shape goes below the drawing.
//
// Every edit raises the element's version (with a new versionNonce), so it wins the merge with a
// page that still has the old one (merge.mjs). A deletion keeps the element as isDeleted: true.

import { layoutFlowchart } from './mermaid.mjs'

export class OpError extends Error {}

const SHAPES = ['rectangle', 'ellipse', 'diamond']
const LINES = ['arrow', 'line']
const STYLE = ['strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity', 'link']
const FONT_FAMILIES = [1, 2, 3]   // Excalidraw's Virgil (hand-drawn), Helvetica (normal), Cascadia (code)
const FONT_SIZE = 20
const LINE_HEIGHT = 1.25
const GAP = 8          // between a shape and the end of its arrow
const SPACE = 80       // between the drawing and a shape placed below it

const rand = () => Math.floor(Math.random() * 2 ** 31)
const newId = () => Math.random().toString(36).slice(2, 10)
const num = (v) => typeof v === 'number' && Number.isFinite(v)

// A character's width in em, roughly and erring wide, per font family: the hand-drawn and the code
// font are wider than the normal one.
const CHAR_WIDTH = { 1: 0.6, 2: 0.5, 3: 0.6 }

// A text's size as Excalidraw roughly takes it in the given font family (1, the hand-drawn, by default),
// and its baseline: that of the last line. Excalidraw draws each line that far up from the bottom, so the
// first line's baseline would lift a text of several lines out of its shape.
export function measure(text, fontSize = FONT_SIZE, fontFamily = 1) {
  const lines = String(text).split('\n')
  const em = CHAR_WIDTH[fontFamily] ?? CHAR_WIDTH[1]
  const height = Math.ceil(lines.length * fontSize * LINE_HEIGHT)
  return { width: Math.ceil(Math.max(...lines.map((l) => l.length)) * fontSize * em) + 2, height, baseline: height - Math.round(fontSize * (LINE_HEIGHT - 0.9)) }
}

const base = (type, id, extra) => ({
  id, type, x: 0, y: 0, width: 0, height: 0, angle: 0,
  strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
  roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null,
  seed: rand(), version: 1, versionNonce: rand(), isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false,
  ...extra,
})

const textElement = (id, text, extra = {}) => {
  const fontSize = extra.fontSize ?? FONT_SIZE
  return base('text', id, {
    ...measure(text, fontSize), text, originalText: text, fontSize, fontFamily: 1, textAlign: 'left', verticalAlign: 'top',
    containerId: null, lineHeight: LINE_HEIGHT, ...extra,
  })
}

const center = (e) => ({ x: e.x + e.width / 2, y: e.y + e.height / 2 })

// Where the line from a shape's centre towards (tx, ty) leaves the shape, plus the gap.
function edgePoint(shape, tx, ty) {
  const c = center(shape), hw = shape.width / 2 || 1, hh = shape.height / 2 || 1
  const dx = tx - c.x, dy = ty - c.y
  if (!dx && !dy) return c
  const t = shape.type === 'ellipse' ? 1 / Math.hypot(dx / hw, dy / hh)
    : shape.type === 'diamond' ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh)
    : Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity)
  const len = Math.hypot(dx, dy)
  return { x: c.x + dx * t + (dx / len) * GAP, y: c.y + dy * t + (dy / len) * GAP }
}

function withPoints(line, abs) {
  const x = abs[0].x, y = abs[0].y
  const points = abs.map((p) => [Math.round(p.x - x), Math.round(p.y - y)])
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
  return { ...line, x: Math.round(x), y: Math.round(y), points, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) }
}

// The working copy of a sketch: elements by id, every change marked so its version goes up once.
function scene(elements) {
  const list = elements.map((e) => ({ ...e }))
  const touched = new Set()
  const find = (id) => list.find((e) => e.id === id && !e.isDeleted)
  const get = (id, what = 'element') => {
    const e = find(id)
    if (!e) throw new OpError(`no ${what} ${JSON.stringify(id)} in the sketch`)
    return e
  }
  const set = (e, patch) => { Object.assign(e, patch); touched.add(e) }
  const add = (e) => {
    if (list.some((o) => o.id === e.id)) throw new OpError(`the id ${JSON.stringify(e.id)} is taken`)
    list.push(e)
    return e
  }
  const labelOf = (e) => list.find((t) => t.containerId === e.id && !t.isDeleted)
  const bind = (shape, id, type) => set(shape, { boundElements: [...(shape.boundElements ?? []).filter((b) => b.id !== id), { id, type }] })
  const unbind = (shape, id) => shape && set(shape, { boundElements: (shape.boundElements ?? []).filter((b) => b.id !== id) })

  // A label sits in the middle of its shape, or of its arrow.
  function placeLabel(owner) {
    const t = labelOf(owner)
    if (!t) return
    const c = LINES.includes(owner.type) ? (() => {
      const a = owner.points[0], b = owner.points.at(-1)
      return { x: owner.x + (a[0] + b[0]) / 2, y: owner.y + (a[1] + b[1]) / 2 }
    })() : center(owner)
    set(t, { x: Math.round(c.x - t.width / 2), y: Math.round(c.y - t.height / 2) })
  }

  function setLabel(owner, text) {
    const t = labelOf(owner)
    if (t && !text) { set(t, { isDeleted: true }); unbind(owner, t.id); return }
    if (!text) return
    if (t) set(t, { text, originalText: text, ...measure(text, t.fontSize, t.fontFamily) })
    else {
      const id = `${owner.id}-label`
      add(textElement(list.some((o) => o.id === id) ? newId() : id, text, { containerId: owner.id, textAlign: 'center', verticalAlign: 'middle' }))
      bind(owner, labelOf(owner).id, 'text')
      touched.add(labelOf(owner))
    }
    placeLabel(owner)
  }

  // An arrow's ends at the edges of the shapes it is bound to.
  function route(line) {
    const abs = line.points.map(([px, py]) => ({ x: line.x + px, y: line.y + py }))
    const from = line.startBinding && find(line.startBinding.elementId)
    const to = line.endBinding && find(line.endBinding.elementId)
    const towardsEnd = to ? center(to) : abs.at(-1), towardsStart = from ? center(from) : abs[0]
    if (from) abs[0] = edgePoint(from, (abs.length > 2 ? abs[1] : towardsEnd).x, (abs.length > 2 ? abs[1] : towardsEnd).y)
    if (to) abs[abs.length - 1] = edgePoint(to, (abs.length > 2 ? abs.at(-2) : towardsStart).x, (abs.length > 2 ? abs.at(-2) : towardsStart).y)
    set(line, withPoints(line, abs))
    placeLabel(line)
  }
  const arrowsOf = (shape) => (shape.boundElements ?? []).filter((b) => b.type === 'arrow').map((b) => find(b.id)).filter(Boolean)

  function bottom() {
    const live = list.filter((e) => !e.isDeleted)
    if (!live.length) return { x: 0, y: 0 }
    return { x: Math.min(...live.map((e) => e.x)), y: Math.max(...live.map((e) => e.y + e.height)) + SPACE }
  }

  return { list, touched, find, get, set, add, labelOf, bind, unbind, setLabel, placeLabel, route, arrowsOf, bottom }
}

function style(op) {
  const out = {}
  for (const k of STYLE) if (op[k] !== undefined) out[k] = op[k]
  return out
}

// The font fields of an op, checked: they go on a text, or on the label of a shape or an arrow.
function font(op) {
  const out = {}
  if (op.fontFamily !== undefined) {
    if (!FONT_FAMILIES.includes(op.fontFamily)) throw new OpError(`fontFamily is one of ${FONT_FAMILIES.join(', ')} (hand-drawn, normal, code)`)
    out.fontFamily = op.fontFamily
  }
  if (op.fontSize !== undefined) {
    if (!num(op.fontSize) || op.fontSize <= 0) throw new OpError('fontSize is a positive number')
    out.fontSize = op.fontSize
  }
  return out
}

// A text in the given font, sized for it; a label is centred on its shape or arrow again.
function setFont(s, t, f) {
  if (!t || !Object.keys(f).length) return
  s.set(t, { ...f, ...measure(t.text, f.fontSize ?? t.fontSize, f.fontFamily ?? t.fontFamily) })
  if (t.containerId) s.placeLabel(s.get(t.containerId))
}

// A shape just large enough for its label (a diamond or an ellipse needs more room around it).
function shapeSize(type, label) {
  const text = label ? measure(label) : { width: 0, height: 0 }
  const grow = type === 'diamond' ? 1.6 : type === 'ellipse' ? 1.3 : 1
  return { width: Math.max(120, Math.ceil((text.width + 40) * grow)), height: Math.max(60, Math.ceil((text.height + 30) * grow)) }
}

function addShape(s, op) {
  const size = shapeSize(op.type, op.label)
  const width = num(op.width) ? op.width : size.width
  const height = num(op.height) ? op.height : size.height
  const at = num(op.x) && num(op.y) ? { x: op.x, y: op.y } : s.bottom()
  const shape = s.add(base(op.type, op.id ?? newId(), {
    x: at.x, y: at.y, width, height, roundness: op.type === 'rectangle' ? { type: 3 } : op.type === 'diamond' ? { type: 2 } : null, ...style(op),
  }))
  s.touched.add(shape)
  s.setLabel(shape, op.label)
  setFont(s, s.labelOf(shape), font(op))
  return shape
}

function addLine(s, op) {
  const line = base(op.type, op.id ?? newId(), {
    points: [[0, 0], [1, 1]], lastCommittedPoint: null, startBinding: null, endBinding: null,
    startArrowhead: null, endArrowhead: op.type === 'arrow' ? 'arrow' : null, roundness: { type: 2 }, ...style(op),
  })
  if (op.from !== undefined || op.to !== undefined) {
    const from = s.get(op.from, 'shape to start the arrow at'), to = s.get(op.to, 'shape to end the arrow at')
    Object.assign(line, withPoints(line, [center(from), center(to)]), {
      startBinding: { elementId: from.id, focus: 0, gap: GAP }, endBinding: { elementId: to.id, focus: 0, gap: GAP },
    })
    s.add(line)
    s.bind(from, line.id, 'arrow')
    s.bind(to, line.id, 'arrow')
    s.route(line)
  } else {
    if (!Array.isArray(op.points) || op.points.length < 2 || !op.points.every((p) => Array.isArray(p) && num(p[0]) && num(p[1])))
      throw new OpError(`an ${op.type} needs "from" and "to" (shape ids) or "points": [[x, y], [x, y], ...]`)
    // a free line through more than two points turns at sharp corners, as drawn, not in a curve
    s.add(Object.assign(line, withPoints(line, op.points.map(([x, y]) => ({ x, y }))), op.points.length > 2 ? { roundness: null } : {}))
  }
  s.touched.add(line)
  s.setLabel(line, op.label)
  setFont(s, s.labelOf(line), font(op))
  return line
}

function add(s, op) {
  if (op.id !== undefined && (typeof op.id !== 'string' || !op.id)) throw new OpError('an id is a non-empty string')
  if (SHAPES.includes(op.type)) return addShape(s, op)
  if (LINES.includes(op.type)) return addLine(s, op)
  if (op.type === 'text') {
    if (typeof op.text !== 'string' || !op.text) throw new OpError('a text needs "text"')
    const at = num(op.x) && num(op.y) ? { x: op.x, y: op.y } : s.bottom()
    const f = font(op)
    const t = s.add(textElement(op.id ?? newId(), op.text, { x: at.x, y: at.y, ...f, ...style(op) }))
    if (f.fontSize || f.fontFamily) Object.assign(t, measure(op.text, t.fontSize, t.fontFamily))
    s.touched.add(t)
    return t
  }
  throw new OpError(`cannot add a ${JSON.stringify(op.type)}: one of ${[...SHAPES, 'text', ...LINES].join(', ')}`)
}

function move(s, op) {
  const e = s.get(op.id)
  if (e.containerId) throw new OpError(`${op.id} is the label of ${e.containerId}: move that`)
  const dx = num(op.dx) ? op.dx : num(op.x) ? op.x - e.x : 0
  const dy = num(op.dy) ? op.dy : num(op.y) ? op.y - e.y : 0
  if (!dx && !dy && !(num(op.x) || num(op.y))) throw new OpError('move needs x and y, or dx and dy')
  s.set(e, { x: e.x + dx, y: e.y + dy })
  if (LINES.includes(e.type)) {
    for (const end of ['startBinding', 'endBinding']) if (e[end]) { s.unbind(s.find(e[end].elementId), e.id); s.set(e, { [end]: null }) }
    s.placeLabel(e)
    return
  }
  s.placeLabel(e)
  for (const a of s.arrowsOf(e)) s.route(a)
}

function update(s, op) {
  const e = s.get(op.id)
  s.set(e, style(op))
  if (e.type === 'text') {
    if (op.text !== undefined) {
      if (typeof op.text !== 'string' || !op.text) throw new OpError('a text needs "text"')
      s.set(e, { text: op.text, originalText: op.text, ...measure(op.text, e.fontSize, e.fontFamily) })
      if (e.containerId) s.placeLabel(s.get(e.containerId))
    }
    setFont(s, e, font(op))
    return
  }
  if (num(op.width) || num(op.height)) {
    if (LINES.includes(e.type)) throw new OpError('an arrow has no width or height of its own: move its shapes')
    s.set(e, { width: num(op.width) ? op.width : e.width, height: num(op.height) ? op.height : e.height })
    for (const a of s.arrowsOf(e)) s.route(a)
  }
  if (op.label !== undefined) s.setLabel(e, op.label)
  setFont(s, s.labelOf(e), font(op))
  s.placeLabel(e)
}

function remove(s, op) {
  const e = s.get(op.id)
  s.set(e, { isDeleted: true })
  const label = s.labelOf(e)
  if (label) s.set(label, { isDeleted: true })
  if (e.containerId) s.unbind(s.find(e.containerId), e.id)
  for (const a of s.arrowsOf(e)) for (const end of ['startBinding', 'endBinding']) if (a[end]?.elementId === e.id) s.set(a, { [end]: null })
  if (LINES.includes(e.type)) for (const end of ['startBinding', 'endBinding']) if (e[end]) s.unbind(s.find(e[end].elementId), e.id)
}

function mermaid(s, op) {
  if (typeof op.source !== 'string') throw new OpError('mermaid needs "source": the flowchart')
  let chart
  try { chart = layoutFlowchart(op.source, shapeSize) } catch (e) { throw new OpError(`mermaid: ${e.message}`) }
  const at = num(op.x) && num(op.y) ? { x: op.x, y: op.y } : s.bottom()
  const ids = new Map()
  const idOf = (node) => {
    if (!ids.has(node)) ids.set(node, s.list.some((e) => e.id === node) ? `${node}-${newId().slice(0, 4)}` : node)
    return ids.get(node)
  }
  for (const n of chart.nodes) addShape(s, { op: 'add', type: n.shape, id: idOf(n.id), x: at.x + n.x, y: at.y + n.y, width: n.width, height: n.height, label: n.label })
  for (const e of chart.edges) {
    const id = `${idOf(e.from)}-${idOf(e.to)}`
    addLine(s, {
      op: 'add', type: e.arrow ? 'arrow' : 'line', id: s.list.some((o) => o.id === id) ? newId() : id, from: idOf(e.from), to: idOf(e.to),
      label: e.label, strokeStyle: e.dashed ? 'dashed' : undefined, strokeWidth: e.thick ? 4 : undefined,
    })
  }
}

const OPS = { add, move, update, delete: remove, mermaid }

export function applyOps(elements, ops) {
  if (!Array.isArray(ops)) throw new OpError('expected a JSON array of ops')
  const s = scene(elements)
  const before = new Map(elements.map((e) => [e.id, e.version]))
  ops.forEach((op, i) => {
    const fn = OPS[op?.op]
    if (!fn) throw new OpError(`op ${i + 1}: unknown op ${JSON.stringify(op?.op)}: one of ${Object.keys(OPS).join(', ')}`)
    try { fn(s, op) } catch (e) { throw e instanceof OpError ? new OpError(`op ${i + 1} (${op.op}): ${e.message}`) : e }
  })
  for (const e of s.touched) {
    if (before.has(e.id)) Object.assign(e, { version: before.get(e.id) + 1, versionNonce: rand(), updated: Date.now() })
  }
  return s.list
}
