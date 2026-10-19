// The Ideas page: the entry module index.html loads. It reads the ideas (api.mjs), draws the board
// (board.mjs), and reads them again when the shell says an idea file changed (topic "ideas.items")
// or the connection came back. An idea that arrives live is marked for a moment.
//
// Here the human decides (d-ideas-human-decides): a card opens in the drawer (drawer.mjs) to edit
// every field, and moves by drag and drop or its move menu; a move to Rejected first asks why
// (reject.mjs). Each save is made on the version the page saw; when the file changed meanwhile the
// page says so and shows the newer one. Saving and errors are short toasts. The language follows the
// shell (strings.mjs).
//
// An engineering idea in To develop offers "Make a ticket" (tickets.mjs): it copies a prompt for
// Claude. The tickets naming an idea come from Build (GET /api/build/ideas), read again when Build
// says its tickets changed ("build.files", "build.issues"). A link with ?idea=I-12 (Build's link from
// a ticket) opens that idea in the drawer.

import { html, render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n, ui } from './strings.mjs'
import { listIdeas, saveIdea, ideaTickets } from './api.mjs'
import { board } from './board.mjs'
import { drawer, valuesOf, changesOf } from './drawer.mjs'
import { rejectForm } from './reject.mjs'
import { copyText } from './tickets.mjs'
import { ticketPrompt } from '../ticket.mjs'

const $ = (id) => document.getElementById(id)
const state = { ideas: null, error: null, fresh: new Set(), menu: null, over: null, tickets: {} }
let draft = null    // the idea open in the drawer: { idea, values, saving, error }
let ask = null      // the reason a move to Rejected asks for: { idea, reason, error }
let toasts = []
let known = null    // the ids seen so far; null before the first read
let freshTimer
let wanted = new URLSearchParams(location.search).get('idea')   // the idea a link asks to open, once

function draw() {
  render(board(state, boardActs), $('board'))
  render(drawer(draft, drawerActs), $('drawer'))
  render(rejectForm(ask, rejectActs), $('reject'))
  render(toasts.map((t) => html`<div class="gw-toast gw-toast--${t.tone}" role=${t.tone === 'bad' ? 'alert' : 'status'}>${t.text}</div>`), $('toasts'))
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

// A save's answer: the idea as saved, or the newer one when someone else saved first.
function answered(r, done) {
  if (r.ok) { put(r.idea); done(r.idea); toast(ui('toast.saved', { id: r.idea.id })) }
  else if (r.stale) { put(r.idea); toast(ui('toast.stale'), 'bad') }
  else toast(ui('toast.error', { error: r.error }), 'bad')
  draw()
  return r
}

async function move(idea, status) {
  if (status === 'rejected') {
    ask = { idea, reason: '', error: null }
    draw()
    $('reject').showModal()
    return
  }
  answered(await saveIdea(idea, { status }), () => {})
  document.querySelector(`[data-idea="${idea.id}"] .idea__move`)?.focus()
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
  async confirm() {
    const r = await saveIdea(ask.idea, { status: 'rejected', reason: ask.reason })
    if (r.error) ask = { ...ask, error: r.error }
    answered(r, () => {})
    if (!r.error) $('reject').close()
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
  onHello: () => { read(); readTickets() },
  onChange: (topics) => {
    if (topics.includes('ideas.items')) read()
    if (topics.includes('build.files') || topics.includes('build.issues')) readTickets()
  },
})
