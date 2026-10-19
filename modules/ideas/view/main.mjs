// The Ideas page: the entry module index.html loads. It reads the ideas (api.mjs), draws the board
// (board.mjs) or the impact–effort matrix (matrix.mjs), as the switch above them says (remembered
// by the browser), and reads them again when the shell says an idea file changed (topic
// "ideas.items") or the connection came back. An idea that arrives live is marked for a moment.
//
// Here the human decides (d-ideas-human-decides): a card opens in the drawer (drawer.mjs) to edit
// every field, and moves by drag and drop or its move menu (on the matrix, a move to another
// quadrant changes its impact and effort); a move to Rejected first asks why (reject.mjs).
// Each save is made on the version the page saw; when the file changed meanwhile the page says so
// and shows the newer one. Saving and errors are short toasts. The language follows the shell
// (strings.mjs).
//
// An engineering idea in To develop offers "Make a ticket" (tickets.mjs): it copies a prompt for
// Claude. The tickets naming an idea come from Build (GET /api/build/ideas), read again when Build
// says its tickets changed ("build.files", "build.issues"). A link with ?idea=I-12 (Build's link from
// a ticket, or the link on the idea's node on Plan's map) opens that idea in the drawer.
//
// A product idea moved to To develop goes to Plan's map as a todo node, and a rejected one, when the
// human asks, as a non-goal (plan.mjs); without Plan a toast says the map is unavailable.
//
// A card shows the sketches that link to its idea (the Sketch module's GET /api/sketch/links, topic
// "sketch.links"), each opening that sketch.

import { html, render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n, ui } from './strings.mjs'
import { listIdeas, saveIdea, ideaTickets, sketchLinks } from './api.mjs'
import { board } from './board.mjs'
import { matrix } from './matrix.mjs'
import { estimateFor } from '../matrix.mjs'
import { drawer, valuesOf, changesOf } from './drawer.mjs'
import { rejectForm } from './reject.mjs'
import { copyText } from './tickets.mjs'
import { ticketPrompt } from '../ticket.mjs'
import { toMap } from './plan.mjs'

const $ = (id) => document.getElementById(id)
// The view chosen (Kanban or Matrix), remembered by the browser when it may.
const VIEW_KEY = 'groundwork-ideas:view'
const VIEWS = ['kanban', 'matrix']
function recallView() { try { return localStorage.getItem(VIEW_KEY) } catch { return null } }
function rememberView(view) { try { localStorage.setItem(VIEW_KEY, view) } catch {} }

const state = { ideas: null, error: null, fresh: new Set(), menu: null, over: null, tickets: {}, sketches: {},
  view: VIEWS.includes(recallView()) ? recallView() : 'kanban' }
let draft = null    // the idea open in the drawer: { idea, values, saving, error }
let ask = null      // the reason a move to Rejected asks for: { idea, reason, error }
let toasts = []
let known = null    // the ids seen so far; null before the first read
let freshTimer
let wanted = new URLSearchParams(location.search).get('idea')   // the idea a link asks to open, once

function draw() {
  render(page(), $('board'))
  render(drawer(draft, drawerActs), $('drawer'))
  render(rejectForm(ask, rejectActs), $('reject'))
  render(toasts.map((t) => html`<div class="gw-toast gw-toast--${t.tone}" role=${t.tone === 'bad' ? 'alert' : 'status'}>${t.text}</div>`), $('toasts'))
}

// The board or the matrix, under the switch between them (shown once there are ideas to switch over).
function page() {
  if (state.error || !state.ideas?.length) return board(state, boardActs)
  return html`<div class="gw-seg views" role="group" aria-label=${ui('view.label')}>
      ${VIEWS.map((v) => html`<button type="button" aria-pressed=${state.view === v ? 'true' : 'false'}
        @click=${() => pick(v)}>${ui(`view.${v}`)}</button>`)}
    </div>
    ${state.view === 'matrix' ? matrix(state, matrixActs) : board(state, boardActs)}`
}

function pick(view) {
  Object.assign(state, { view, menu: null, over: null })
  rememberView(view)
  draw()
}

function toast(text, tone = 'ok') {
  const t = { text, tone }
  toasts = [...toasts, t]
  draw()
  setTimeout(() => { toasts = toasts.filter((x) => x !== t); draw() }, 3600)
}

// One idea, as the server now has it, in place on the board.
function put(idea) {
  if (idea && state.ideas) state.ideas = state.ideas.map((i) => (i.id === idea.id ? idea : i))
}

async function read() {
  try {
    const ideas = await listIdeas()
    state.fresh = new Set(known ? ideas.map((i) => i.id).filter((id) => !known.has(id)) : [])
    known = new Set(ideas.map((i) => i.id))
    Object.assign(state, { ideas, error: null })
    clearTimeout(freshTimer)
    if (state.fresh.size) freshTimer = setTimeout(() => { state.fresh = new Set(); draw() }, 2400)
  } catch (e) {
    state.error = e.message
  }
  document.body.dataset.state = 'ready'
  draw()
  const asked = wanted && state.ideas?.find((i) => i.id === wanted)
  wanted = null
  if (asked) boardActs.open(asked)
}

async function readTickets() {
  state.tickets = await ideaTickets()
  draw()
}

async function readSketches() {
  state.sketches = await sketchLinks()
  draw()
}

// A save's answer: the idea as saved, or the newer one when someone else saved first.
function answered(r, done) {
  if (r.ok) { put(r.idea); done(r.idea); toast(ui('toast.saved', { id: r.idea.id })) }
  else if (r.stale) { put(r.idea); toast(ui('toast.stale'), 'bad') }
  else toast(ui('toast.error', { error: r.error }), 'bad')
  draw()
  return r
}

// The idea on Plan's map (plan.mjs): a todo node, or a non-goal with its reason; the idea then links
// to the node. Without Plan the page says the map is unavailable, and the idea stays as it is.
async function sendToMap(idea, status, reason) {
  const r = await toMap(idea, { status, reason }, saveIdea)
  if (r.unavailable) toast(ui('toast.no-map', { id: idea.id }), 'info')
  else if (r.error) toast(ui('toast.map-error', { id: idea.id, error: r.error }), 'bad')
  else { put(r.idea); toast(ui('toast.on-map', { id: idea.id })) }
  draw()
}

async function move(idea, status) {
  if (status === 'rejected') {
    ask = { idea, reason: '', toMap: false, error: null }
    draw()
    $('reject').showModal()
    return
  }
  const r = answered(await saveIdea(idea, { status }), () => {})
  document.querySelector(`[data-idea="${idea.id}"] .idea__move`)?.focus()
  // A product idea to develop becomes a todo on the map (f-ideas-to-plan); an engineering one a ticket.
  if (r.ok && status === 'to-develop' && (r.idea.kind ?? 'product') === 'product') await sendToMap(r.idea, 'todo')
}

const boardActs = {
  open(idea) {
    draft = { idea, values: valuesOf(idea), saving: false, error: null }
    state.menu = null
    draw()
    $('drawer').showModal()
  },
  move,
  menu(id) {
    const was = state.menu
    state.menu = id
    draw()
    if (id) document.querySelector(`#move-${id} [role="menuitem"]`)?.focus()
    else if (was) document.querySelector(`[data-idea="${was}"] .idea__move`)?.focus()
  },
  over(status) { state.over = status; draw() },
  async copyPrompt(idea) {
    if (await copyText(ticketPrompt(idea))) toast(ui('toast.prompt-copied', { id: idea.id }))
    else toast(ui('toast.copy-failed'), 'bad')
  },
}

// The matrix: the same card actions; a move to another quadrant saves the new impact and effort.
const matrixActs = {
  ...boardActs,
  async place(idea, quadrant) {
    answered(await saveIdea(idea, estimateFor(idea, quadrant)), () => {})
    document.querySelector(`[data-idea="${idea.id}"] .idea__move`)?.focus()
  },
}

const drawerActs = {
  edit(name, value) { draft.values = { ...draft.values, [name]: value }; draw() },
  async save() {
    draft = { ...draft, saving: true, error: null }
    draw()
    const r = await saveIdea(draft.idea, changesOf(draft.values))
    if (r.stale && r.idea) {
      draft = { idea: r.idea, values: valuesOf(r.idea), saving: false, error: ui('drawer.stale') }
    } else if (r.error) {
      draft = { ...draft, saving: false, error: r.error }
    }
    answered(r, () => { draft = null; $('drawer').close() })
  },
  close() { $('drawer').close() },
}

const rejectActs = {
  edit(reason) { ask.reason = reason; draw() },
  toMap(on) { ask.toMap = on; draw() },
  async confirm() {
    const nonGoal = ask.toMap
    const r = await saveIdea(ask.idea, { status: 'rejected', reason: ask.reason })
    if (r.error) ask = { ...ask, error: r.error }
    answered(r, () => {})
    if (r.error) return
    $('reject').close()
    if (r.ok && nonGoal) await sendToMap(r.idea, 'excluded', r.idea.reason)
  },
  cancel() { $('reject').close() },
}

// A closed dialog forgets its content (Escape closes it too).
$('drawer').addEventListener('close', () => { draft = null; draw() })
$('reject').addEventListener('close', () => { ask = null; draw() })
// A click outside an open move menu closes it.
document.addEventListener('click', (e) => {
  if (state.menu && !e.target.closest('.move-menu, .idea__move')) { state.menu = null; draw() }
})

document.documentElement.lang = i18n.lang
i18n.onChange(() => { document.documentElement.lang = i18n.lang; draw() })
subscribe({
  onHello: () => { read(); readTickets(); readSketches() },
  onChange: (topics) => {
    if (topics.includes('ideas.items')) read()
    if (topics.includes('build.files') || topics.includes('build.issues')) readTickets()
    if (topics.includes('sketch.links')) readSketches()
  },
})
