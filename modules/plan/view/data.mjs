// Plan's data and its live updates: the map from /api/plan/map (read, saved, merged), the
// glossary, and the ticket counts Build gives; the core's live updates through the shell say when
// to read again (one stream per browser tab, /shell/live.mjs). No polling.
//   connect()  starts it all: the first hello reads the map

import { subscribe } from '/shell/live.mjs'
import { listDocs } from '../documents.mjs'
import { state, editing, fullTree, ele } from './state.mjs'
import { ui, clock } from './strings.mjs'
import { update, toast } from './chrome.mjs'
import { renderPrd, resetFlash, highlightInPrd } from './document.mjs'
import { createMap, content, decorate, fitMap, reveal } from './map.mjs'
import { applyFocus, firstDoc, focusLinked } from './focus.mjs'

// Big maps start with their sections collapsed, like a table of contents.
function collapseBig(data) {
  let count = 0, hasState = false
  const walkAll = (n) => { count++; if ('expanded' in n) hasState = true; (n.children || []).forEach(walkAll) }
  walkAll(data.nodeData)
  if (count <= 40 || hasState) return data
  const sections = new Set()
  for (const d of listDocs(data)) for (const s of d.legacy ? data.nodeData.children || [] : d.node.children || []) sections.add(s.id)
  const rec = (n, below) => {
    const inside = below || sections.has(n.id)
    if (inside && n.children?.length) n.expanded = false
    ;(n.children || []).forEach((c) => rec(c, inside))
  }
  rec(data.nodeData, false)
  return data
}

function ids(data) {
  const out = new Set()
  const rec = (n) => { out.add(n.id); (n.children || []).forEach(rec) }
  rec(data.nodeData)
  return out
}

// The file does not store what is collapsed in this browser; carry it over a refresh.
function keepExpanded(data) {
  const expanded = new Map()
  const read = (n) => { if ('expanded' in n) expanded.set(n.id, n.expanded); (n.children || []).forEach(read) }
  read(fullTree())
  const write = (n) => { if (!('expanded' in n) && expanded.has(n.id)) n.expanded = expanded.get(n.id); (n.children || []).forEach(write) }
  write(data.nodeData)
  return data
}

// A new version of the map: drawn once; the glossary has its own live topic, so it is not asked for here.
function show(data, { flashNew = false } = {}) {
  const mind = state.mind
  const before = flashNew ? ids(mind.getData()) : null
  const selected = mind.currentNode?.nodeObj?.id
  if (mind.isFocusMode) { mind.isFocusMode = false; mind.tempDirection = null } // refresh replaces the whole tree
  mind.refresh(content(keepExpanded(data)))
  applyFocus({ keepView: true })
  if (selected) { const el = ele(selected); if (el) mind.selectNode(el) }
  if (before) for (const id of ids(data)) if (!before.has(id)) { reveal(id); ele(id)?.classList.add('mm-new') } // open collapsed branches so new items show
}

// ---- saving: an edit is sent half a second later, with the version it was made on ----
let saveTimer = null
function schedule() {
  state.dirty = true
  clearTimeout(saveTimer)
  saveTimer = setTimeout(save, 500)
}

async function save() {
  if (editing() || state.saving) { saveTimer = setTimeout(save, 500); return }
  state.saving = true
  state.dirty = false
  try {
    const r = await fetch('/api/plan/map', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base: state.version, data: content(state.mind.getData()) }),
    })
    const j = await r.json()
    if (j.stale) { // the server does not know the version this edit was made on (it restarted)
      state.version = j.v
      show(j.data)
      toast('save', ui('toast.stale'), { tone: 'bad', ms: 8000 })
      return
    }
    if (!r.ok) throw new Error(j.error)
    state.version = j.v
    if (j.changed && !state.dirty && !editing()) show(j.data)
    toast('save', ui('toast.saved', { time: clock() }))
  } catch (e) {
    toast('save', ui('toast.saveError', { error: e.message }), { tone: 'bad', ms: 6000 })
    state.dirty = true
  } finally {
    state.saving = false
  }
}

// Asks for the map again (the live updates said it changed, or the page reconnected). While an
// edit or a save is under way it asks again a moment later, so a change on disk is never lost.
let reloadLater = null
async function reloadMap() {
  clearTimeout(reloadLater)
  if (!state.mind) { start(); return }
  if (state.saving || state.dirty || editing()) { reloadLater = setTimeout(reloadMap, 1000); return }
  try {
    const r = await fetch('/api/plan/map?v=' + encodeURIComponent(state.version))
    const j = await r.json()
    if (!r.ok) throw new Error(j.error)
    if (!j.same) {
      state.version = j.v
      show(j.data, { flashNew: true })
      toast('update', ui('toast.updated', { time: clock() }), { tone: 'info' })
    }
  } catch { /* no connection: the shell says so, and the next hello asks again */ }
}

async function loadGlossary() {
  try { state.glossary = (await (await fetch('/api/plan/glossary')).json()).text || '' } catch { state.glossary = '' }
}

// The ticket counts on the map (see state.ticketCounts).
async function loadTickets() {
  try {
    const r = await fetch('/api/build/prd', { cache: 'no-store' })
    const next = r.ok ? (await r.json()).items || {} : {}
    if (JSON.stringify(next) === JSON.stringify(state.ticketCounts)) return
    state.ticketCounts = next
    if (state.mind) decorate()
  } catch { /* no connection: the live updates say when it is back */ }
}

// The sketches that link to map items (see state.sketchLinks).
async function loadSketches() {
  try {
    const r = await fetch('/api/sketch/links', { cache: 'no-store' })
    const next = r.ok ? (await r.json()).linked?.node || {} : {}
    if (JSON.stringify(next) === JSON.stringify(state.sketchLinks)) return
    state.sketchLinks = next
    if (state.mind) decorate()
  } catch { /* no connection: the live updates say when it is back */ }
}

// The map is read when the live connection says hello (once at the start, again after a
// reconnect) and when it says the map changed: no request of its own at the start, no polling.
let starting = false
async function start() {
  if (state.mind || starting) return
  starting = true
  try {
    const r = await fetch('/api/plan/map')
    const j = await r.json()
    if (!r.ok) { state.page = 'empty'; update(); return } // the live updates say when the map file appears
    state.page = 'ready'
    state.version = j.v
    update()
    createMap(content(collapseBig(j.data)), {
      onOperation: schedule,
      onSelect: () => { update(); highlightInPrd(state.mind.currentNode?.nodeObj?.id) },
    })
    state.doc = firstDoc()
    applyFocus({ keepView: false })
    fitMap()
    await loadGlossary()
    renderPrd()
    focusLinked() // the document is drawn: the linked node can be shown in it
  } catch { /* no connection: the next hello starts again */ } finally {
    starting = false
  }
}

// The live topics: the map file ("plan.map"), the glossary ("plan.glossary"), and the tickets or
// GitHub issues Build reads ("build.files", "build.issues"), the sketches' links ("sketch.links").
// Each (re)connect says hello first.
export function connect() {
  let heard = false
  subscribe({
    onHello: () => { heard = true; reloadMap(); loadTickets(); loadSketches() },
    onChange: (topics) => {
      if (topics.includes('plan.map')) reloadMap()
      if (topics.includes('plan.glossary')) loadGlossary().then(() => { resetFlash(); renderPrd() })
      if (topics.includes('build.files') || topics.includes('build.issues')) loadTickets()
      if (topics.includes('sketch.links')) loadSketches()
    },
    // no live connection at all: read what there is once, so the page is not blank
    onState: (s) => { if (s === 'off' && !heard && !state.mind) start() },
  })
}
