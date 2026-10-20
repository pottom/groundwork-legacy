// The Ideas page: the entry module index.html loads. It reads the ideas (api.mjs), draws the board
// (board.mjs) or the impact–effort matrix (matrix.mjs), as the switch above them says (remembered
// by the browser), and reads them again when the shell says an idea file changed (topic
// "ideas.items") or the connection came back. An idea that arrives live is marked for a moment.
//
// Here the human decides (d-ideas-human-decides): a card opens in the drawer (drawer.mjs) to edit
// every field, and moves by drag and drop or its move menu (on the matrix, a move to another
// quadrant changes its impact and effort); a move to Rejected first asks why (reject.mjs), and a
// move to Snoozed or Duplicate opens the drawer on that column, for the date or the idea it repeats.
// Each save is made on the version the page saw; when the file changed meanwhile the page says so
// and shows the newer one. Saving and errors are short toasts. The language follows the shell
// (strings.mjs).
//
// An accepted engineering idea, or one whose change is implementing, offers "Make a ticket" (tickets.mjs): it copies a prompt for
// Claude. The tickets naming an idea come from Build (GET /api/build/ideas), read again when Build
// says its tickets changed ("build.files", "build.issues"). A link with ?idea=I-12 (Build's link from
// a ticket, or the link on the idea's node on Plan's map) opens that idea in the drawer.
//
// A move to Accepted asks for the route (accept.mjs), Grilling or Straight to a ticket, the idea's
// kind giving the default; accepting opens the change, and the card then links to it (changes.mjs).
// On Straight to a ticket it also copies the prompt for Claude that writes the change's ticket (the
// card's "Make a ticket" copies it again).
// The board reads again when any record changes (the core's topic "records"), so the card follows
// its change's stage.
//
// A card shows the sketches that link to its idea (the Sketch module's GET /api/sketch/links, topic
// "sketch.links"), each opening that sketch.

import { html, render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { createToasts } from '/shell/toasts.mjs'
import { i18n, ui } from './strings.mjs'
import { listIdeas, saveIdea, acceptIdea, ideaTickets, sketchLinks } from './api.mjs'
import { board } from './board.mjs'
import { matrix } from './matrix.mjs'
import { estimateFor } from '../matrix.mjs'
import { drawer, valuesOf, changesOf } from './drawer.mjs'
import { rejectForm } from './reject.mjs'
import { acceptForm } from './accept.mjs'
import { routeFor } from '../fields.mjs'
import { copyText } from './tickets.mjs'
import { ticketPrompt } from '../ticket.mjs'

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
let accepting = null   // the route a move to Accepted asks for: { idea, route, saving, error }
let known = null    // the ids seen so far; null before the first read
let freshTimer
let wanted = new URLSearchParams(location.search).get('idea')   // the idea a link asks to open, once

function draw() {
  render(page(), $('board'))
  render(drawer(draft, drawerActs), $('drawer'))
  render(rejectForm(ask, rejectActs), $('reject'))
  render(acceptForm(accepting, acceptActs), $('accept'))
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

const toast = createToasts($('toasts'), { ms: 3600 })

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

// The columns whose move needs a field the drawer asks for: Snoozed a date, Duplicate an idea.
const ASKS_IN_DRAWER = ['snoozed', 'duplicate']

async function move(idea, status) {
  if (status === 'rejected') {
    ask = { idea, reason: '', error: null }
    draw()
    $('reject').showModal()
    return
  }
  if (status === 'accepted') {
    accepting = { idea, route: routeFor(idea), saving: false, error: null }
    draw()
    $('accept').showModal()
    return
  }
  if (ASKS_IN_DRAWER.includes(status)) return openDrawer(idea, { status })
  answered(await saveIdea(idea, { status }), () => {})
  document.querySelector(`[data-idea="${idea.id}"] .idea__move`)?.focus()
}

function openDrawer(idea, preset = {}) {
  draft = { idea, values: { ...valuesOf(idea), ...preset }, saving: false, error: null }
  state.menu = null
  draw()
  $('drawer').showModal()
}

const boardActs = {
  open(idea) { openDrawer(idea) },
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
    const { idea: before } = draft
    draft = { ...draft, saving: true, error: null }
    draw()
    const r = await saveIdea(before, changesOf(draft.values))
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
  async confirm() {
    const r = await saveIdea(ask.idea, { status: 'rejected', reason: ask.reason })
    if (r.error) ask = { ...ask, error: r.error }
    answered(r, () => {})
    if (!r.error) $('reject').close()
  },
  cancel() { $('reject').close() },
}

const acceptActs = {
  route(route) { accepting = { ...accepting, route, error: null }; draw() },
  async confirm() {
    accepting = { ...accepting, saving: true, error: null }
    draw()
    const r = await acceptIdea(accepting.idea, accepting.route)
    if (r.ok) {
      put(r.idea)
      $('accept').close()
      // Straight to a ticket: the prompt for Claude that writes the change's ticket, on the clipboard
      if (r.route === 'ticket' && await copyText(ticketPrompt(r.idea))) toast(ui('toast.accepted-prompt', { id: r.idea.id, change: r.change.id }))
      else toast(ui('toast.accepted', { id: r.idea.id, change: r.change.id }))
    } else if (r.stale) {
      put(r.idea)
      accepting = { ...accepting, idea: r.idea, saving: false, error: ui('drawer.stale') }
    } else accepting = { ...accepting, saving: false, error: r.error }
    draw()
  },
  cancel() { $('accept').close() },
}

// A closed dialog forgets its content (Escape closes it too).
$('drawer').addEventListener('close', () => { draft = null; draw() })
$('reject').addEventListener('close', () => { ask = null; draw() })
$('accept').addEventListener('close', () => { accepting = null; draw() })
// A click outside an open move menu closes it.
document.addEventListener('click', (e) => {
  if (state.menu && !e.target.closest('.move-menu, .idea__move')) { state.menu = null; draw() }
})

document.documentElement.lang = i18n.lang
i18n.onChange(() => { document.documentElement.lang = i18n.lang; draw() })
subscribe({
  onHello: () => { read(); readTickets(); readSketches() },
  onChange: (topics) => {
    if (topics.includes('ideas.items') || topics.includes('records')) read()
    if (topics.includes('build.files') || topics.includes('build.issues')) readTickets()
    if (topics.includes('sketch.links')) readSketches()
  },
})
