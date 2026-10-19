// The map: Mind Elixir draws it; this module creates it, draws its branch lines, follows the shell's
// light or dark, decorates the nodes (status, branch colour, icons, badges), pans, fits and selects.
//   createMap(data, { onOperation, onSelect })  the Mind Elixir instance on #map
//   decorate()          the nodes' data attributes and badges, then the chrome and the document
//   fitMap()            the whole map in view, never smaller than readable
//   reveal(id), selectOnMap(id), labelMap()

import MindElixir from '/vendor/mind-elixir/MindElixir.js'
import { mapTheme, followTheme } from '../map-theme.mjs'
import { COMPONENT_TYPES, listDocs, isSection } from '../documents.mjs'
import { buildLink } from '../deep-link.mjs'
import { fitScale } from '../view-rules.mjs'
import { state, fullTree, mapData, ele } from './state.mjs'
import { ui } from './strings.mjs'
import { update } from './chrome.mjs'
import { renderPrdSoon, highlightInPrd } from './document.mjs'

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Every line runs from the right edge of a node's pill to the left edge of its child's pill, at
// mid-height (Mind Elixir's defaults start the main lines inside the root and draw the others
// underline-style).

// Root to main topic. The parent box Mind Elixir hands over is me-root, which is the root's pill;
// the child box is the main topic's pill itself.
function mainBranch({ pT, pL, pW, pH, cT, cL, cW, cH, direction }) {
  const y1 = pT + pH / 2, y2 = cT + cH / 2
  if (direction === 'down') {
    const x1 = pL + pW / 2, x2 = cL + cW / 2, my = (pT + pH + cT) / 2
    return `M ${x1} ${pT + pH} C ${x1} ${my} ${x2} ${my} ${x2} ${cT}`
  }
  const x1 = direction === 'lhs' ? pL : pL + pW
  const x2 = direction === 'lhs' ? cL + cW : cL
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
}

// A node to its child.
// The boxes Mind Elixir hands over are its me-parent boxes: below the main topics they carry the
// node gap as padding on both sides, so the line starts and ends that far inside them, on the
// node's own edge. A main topic's box (isFirst: its first-level children) has no padding.
function subBranch({ pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }) {
  const y1 = pT + pH / 2, y2 = cT + cH / 2
  if (direction === 'down') {
    const x1 = pL + pW / 2, x2 = cL + cW / 2, my = (pT + pH + cT) / 2
    return `M ${x1} ${pT + pH} C ${x1} ${my} ${x2} ${my} ${x2} ${cT}`
  }
  const gap = parseInt(this.container.style.getPropertyValue('--node-gap-x')) || 0
  const inset = isFirst ? 0 : gap
  const x1 = direction === 'lhs' ? pL + inset : pL + pW - inset
  const x2 = direction === 'lhs' ? cL + cW - gap : cL + gap
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
}

// Light or dark follows the shell's theme (/shell/theme.js), also when it switches while the page
// is open: the map gets the matching theme and the branches their palette again.
let THEME, PALETTE
followTheme(groundworkTheme, (dark) => {
  THEME = mapTheme({ dark, css, generateMainBranch: mainBranch, generateSubBranch: subBranch })
  PALETTE = THEME.palette
  if (state.mind) { state.mind.changeTheme(THEME); decorate() }
})

// ---- the lines follow the nodes' sizes ----
// Mind Elixir draws the lines for the sizes the nodes have at that moment. A node changes size
// afterwards: decorate() adds icons and badges, a font loads, a language switch changes a badge's
// words. So the sizes the lines were drawn for are kept, and whenever a node's size differs from
// them, the lines are drawn again: at once when decorate itself changed a size (so no frame shows a
// gap), and soon after when a ResizeObserver on the nodes or the fonts report a change. That is the
// guard: a redraw only happens while the lines are out of date, and the redraw's decorate finds
// every node at the size it was drawn for, so it stops by itself. A redraw is never started from
// inside another (relinking): that one is put off instead.
let drawnFor = new Map()   // me-tpc -> its size when the lines were last drawn
let relinking = false
let relinkTimer = 0
const sizeOf = (t) => t.offsetWidth + 'x' + t.offsetHeight
const linesStale = () => [...drawnFor].some(([t, size]) => t.isConnected && sizeOf(t) !== size)
function relinkNow() {
  if (!state.mind || !linesStale()) return
  if (relinking) { relinkSoon(); return }
  relinking = true
  try { state.mind.linkDiv() } finally { relinking = false }
}
// A timer, not requestAnimationFrame: a map in a background tab gets its lines right as well.
function relinkSoon() {
  if (!relinkTimer) relinkTimer = setTimeout(() => { relinkTimer = 0; relinkNow() })
}
const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(relinkSoon) : null
document.fonts?.ready.then(relinkSoon)

// Mind Elixir drew the lines (its linkDiv event): keep the sizes they fit, watch every node, decorate.
function linesDrawn() {
  const nodes = [...state.mind.container.querySelectorAll('me-tpc')]
  drawnFor = new Map(nodes.map((t) => [t, sizeOf(t)]))
  if (resized) { resized.disconnect(); for (const t of nodes) resized.observe(t) }
  decorate()
}

// ---- decoration: status, branch colour, notes, badges ----
// Runs after every drawing of the lines (linesDrawn), and when the data or the language changed.
export function decorate() {
  const mind = state.mind
  const nodes = [...mind.container.querySelectorAll('me-tpc')]
  const data = mapData()
  const structured = listDocs(data).some((d) => !d.legacy)
  const setAccent = (n, i) => {
    const wrapper = ele(n.id)?.closest('me-wrapper')
    if (wrapper) wrapper.style.setProperty('--accent', n.branchColor || PALETTE[i % PALETTE.length])
  }
  // the main branches of the current view follow Mind Elixir's line palette...
  const visibleMain = mind.nodeData.children || []
  visibleMain.forEach(setAccent)
  // ...and every section below them still gets a colour of its own
  if (structured) {
    let i = visibleMain.length
    for (const d of listDocs(data)) for (const sec of d.node.children || []) if (!visibleMain.includes(sec)) setAccent(sec, i++)
  }
  for (const tpc of nodes) {
    const n = tpc.nodeObj
    if (!n) continue
    const set = (key, value) => { if (value == null) delete tpc.dataset[key]; else if (tpc.dataset[key] !== value) tpc.dataset[key] = value }
    set('status', n.metadata?.status)
    set('layer', n.metadata?.doc)
    const ct = n.metadata?.component
    set('component', ct)
    const ctLabel = ct ? (COMPONENT_TYPES.includes(ct) ? ui(`component.${ct}`) : ct) : null
    set('componentLabel', ctLabel)
    const title = ct ? ui('component.title', { type: ctLabel }) : null
    if (title) { if (tpc.title !== title) tpc.title = title } else if (tpc.hasAttribute('title')) tpc.removeAttribute('title')
    set('section', structured && isSection(data, n.id) ? '' : null)
    set('hasNote', n.note ? '' : null)
    const impl = n.metadata?.impl
    set('impl', impl)
    set('implLabel', impl ? ui(`impl.${impl}`) : null)
    ticketBadge(tpc, state.ticketCounts[n.id])
    sketchBadges(tpc, state.sketchLinks[n.id])
  }
  if (linesStale()) {
    if (!relinking) { relinkNow(); return }   // the redraw's own decorate does the rest
    relinkSoon()
  }
  update()
  renderPrdSoon()
}

// The ticket count of a map item, a link that opens Build on its tickets. It lives inside
// Mind Elixir's node, which Mind Elixir owns, so it is set on the node directly.
function ticketBadge(tpc, count) {
  let a = tpc.querySelector(':scope > a.mm-tickets')
  if (!count) { a?.remove(); return }
  if (!a) {
    a = document.createElement('a')
    a.className = 'mm-tickets'
    a.target = '_top'
    // the map must not take the click (select, drag, edit): the link opens Build
    for (const ev of ['mousedown', 'pointerdown', 'dblclick']) a.addEventListener(ev, (e) => e.stopPropagation())
    tpc.appendChild(a)
  }
  const text = `${count.done}/${count.total}`
  if (a.textContent !== text) a.textContent = text
  a.href = buildLink(tpc.nodeObj.id)
  a.title = ui('tickets.title', { done: count.done, total: count.total })
  if (count.total && count.done === count.total) a.dataset.complete = ''; else delete a.dataset.complete
}

// The sketches that link to a map item, a link each that opens the sketch (through the shell).
// Set on Mind Elixir's node directly, like the ticket count.
function sketchBadges(tpc, names = []) {
  const have = [...tpc.querySelectorAll(':scope > a.mm-sketch')]
  if (have.length === names.length && have.every((a, i) => a.dataset.sketch === names[i] && a.textContent === ui('sketch.badge', { name: names[i] }))) return
  for (const a of have) a.remove()
  for (const name of names) {
    const a = document.createElement('a')
    a.className = 'mm-sketch gw-pill'   // the shared pill (feedback.css)
    a.target = '_top'
    a.dataset.sketch = name
    a.href = '/?module=sketch&sketch=' + encodeURIComponent(name)
    a.textContent = ui('sketch.badge', { name })
    a.title = ui('sketch.title', { name })
    for (const ev of ['mousedown', 'pointerdown', 'dblclick']) a.addEventListener(ev, (e) => e.stopPropagation())
    tpc.appendChild(a)
  }
}

// ---- background pan ----
// Mind Elixir 5.15 always box-selects on a left-drag over the empty background
// when editing is on. Pan instead; Shift+drag still box-selects.
function enableBackgroundPan(mind) {
  const c = mind.container
  let last = null, moved = false
  const isBackground = (t) => c.contains(t) &&
    !t.closest('me-tpc, me-epd, .mind-elixir-toolbar, .context-menu, #input-box, .circle, .svg-label, .topiclinks')
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.shiftKey || e.pointerType !== 'mouse' || !isBackground(e.target)) return
    e.stopPropagation()
    last = { x: e.clientX, y: e.clientY }
    moved = false
    c.classList.add('panning')
  }, true)
  window.addEventListener('pointermove', (e) => {
    if (!last) return
    const dx = e.clientX - last.x, dy = e.clientY - last.y
    if (Math.abs(dx) + Math.abs(dy) > 0) { mind.move(dx, dy); moved = true }
    last = { x: e.clientX, y: e.clientY }
  }, true)
  window.addEventListener('pointerup', () => {
    if (!last) return
    if (!moved) { mind.clearSelection(); update() } // a plain click on the background deselects
    last = null
    c.classList.remove('panning')
  }, true)
}

// ---- fit: the whole map in view, but never smaller than readable ----
// A map too big to fit at a readable size starts at that size with its root at the left edge
// (the map grows to the right); the rest is a pan or a zoom away.
export function fitMap() {
  const mind = state.mind
  if (!mind) return
  const { scale, clamped } = fitScale(
    { width: mind.nodes.offsetWidth, height: mind.nodes.offsetHeight },
    { width: mind.container.offsetWidth, height: mind.container.offsetHeight })
  if (!clamped) { mind.scaleFit(); return }
  mind.scaleVal = scale
  mind.toCenter()
  const root = mind.map.querySelector('me-root')
  if (!root) return
  const box = mind.container.getBoundingClientRect(), r = root.getBoundingClientRect()
  mind.move(box.left + 40 - r.left, 0)
}

// Expands every collapsed ancestor so the node is visible on the map.
export function reveal(id) {
  const path = []
  const find = (n) => { if (n.id === id) return true; for (const c of n.children || []) if (find(c)) { path.unshift(n); return true } return false }
  find(fullTree())
  for (const n of path) if (n.expanded === false) { const el = ele(n.id); if (el) state.mind.expandNode(el, true) }
}

export function selectOnMap(id) {
  reveal(id)
  const el = ele(id)
  if (!el) return
  state.mind.selectNode(el)
  update()
  highlightInPrd(id, { scroll: false })
}

// The selected node's metadata, changed (the status dock); the root has none.
export function setMeta(field, value) {
  const tpc = state.mind?.currentNode
  if (!tpc || !tpc.nodeObj.parent) return
  state.mind.reshapeNode(tpc, { metadata: { ...(tpc.nodeObj.metadata || {}), [field]: value } })
}

// ---- the map's own words: the zoom toolbar and the context menu, in the UI language ----
const MAP_TOOLS = { fullscreen: 'map.fullscreen', toCenter: 'map.center', zoomin: 'map.zoomIn', zoomout: 'map.zoomOut' }
// Mind Elixir's context menu reads its labels from this object (clickTips when used, the rest
// when built), so a switch updates it in place and relabels the built menu.
const MENU = { addChild: 'cm-add_child', addParent: 'cm-add_parent', addSibling: 'cm-add_sibling', removeNode: 'cm-remove_child',
  focus: 'cm-fucus', cancelFocus: 'cm-unfucus', moveUp: 'cm-up', moveDown: 'cm-down', link: 'cm-link',
  linkBidirectional: 'cm-link-bidirectional', summary: 'cm-summary', clickTips: null }
const menuLocale = {}

export function labelMap() {
  for (const [key, id] of Object.entries(MENU)) {
    menuLocale[key] = ui(`menu.${key}`)
    const label = id && document.getElementById(id)?.querySelector('span')
    if (label) label.textContent = menuLocale[key]
  }
  const mind = state.mind
  if (!mind) return
  mind.newTopicName = ui('map.newTopic')
  // the zoom toolbar's icons get a translated name, and keys work on them
  for (const [id, key] of Object.entries(MAP_TOOLS)) {
    const el = mind.container.querySelector(`.mind-elixir-toolbar #${id}`)
    if (!el) continue
    el.title = ui(key)
    el.setAttribute('aria-label', ui(key))
    if (!el.hasAttribute('role')) {
      el.setAttribute('role', 'button')
      el.tabIndex = 0
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click() } })
    }
  }
}

// ---- the instance ----
// onOperation: an edit on the map (to be saved); onSelect: the selection changed.
export function createMap(data, { onOperation, onSelect }) {
  labelMap()
  const mind = new MindElixir({
    el: '#map',
    direction: MindElixir.RIGHT,
    editable: true,
    contextMenu: { locale: menuLocale },
    toolBar: true,
    keypress: true,
    allowUndo: true,
    newTopicName: ui('map.newTopic'),
    theme: THEME,
    generateMainBranch: mainBranch,
    generateSubBranch: subBranch,
  })
  state.mind = mind
  mind.bus.addListener('linkDiv', linesDrawn)
  mind.init(data)
  if (state.mode !== 'edit') mind.disableEdit()
  labelMap()
  enableBackgroundPan(mind)
  mind.bus.addListener('operation', (op) => { if (op.name !== 'beginEdit') onOperation() })
  for (const ev of ['selectNewNode', 'selectNodes', 'unselectNodes']) mind.bus.addListener(ev, () => setTimeout(onSelect))
  window.mind = mind // handy for debugging from the console
  return mind
}

// The map file stores content only. Mind Elixir's getData() also returns the
// theme (whose functions do not survive JSON), so it is dropped both ways.
export function content(data) {
  const { theme, ...rest } = data
  return { ...rest, direction: MindElixir.RIGHT }
}

// ---- note tooltip ----
export function showNoteTips(tip) {
  document.addEventListener('mouseover', (e) => {
    const tpc = e.target.closest?.('me-tpc')
    const note = tpc?.nodeObj?.note
    if (!note) { tip.classList.remove('show'); return }
    tip.textContent = note
    const r = tpc.getBoundingClientRect()
    tip.style.left = Math.max(8, Math.min(r.left, innerWidth - 310)) + 'px'
    tip.style.top = r.bottom + 8 + 'px'
    tip.classList.add('show')
  })
}
