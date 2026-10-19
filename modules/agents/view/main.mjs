// The Agents page: the entry module index.html loads. It reads the sessions and their agents
// (GET /api/agents/list) and draws them (list.mjs). The open agent or session is in the address
// (#agent=<session>/<agent>, #agent=<session>); its timeline and report come from
// GET /api/agents/agent. Both are read again when the shell says the event log changed (topic
// "agents.events") or the connection came back. While something runs, a clock redraws the page
// each second so the running durations count up; it never asks the server.
// The language follows the shell (strings.mjs).

import { render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n } from './strings.mjs'
import { agentList } from './list.mjs'

const root = document.getElementById('agents')
const state = { sessions: null, error: null, open: null, detail: null, detailError: null }
let ticker = null

function draw() {
  render(agentList(state, Date.now()), root)
  document.body.dataset.state = state.error ? 'error' : state.sessions ? 'ready' : 'loading'
  const running = state.sessions?.some((s) => s.state === 'running' || s.agents.some((a) => a.state === 'running'))
  if (running && !ticker) ticker = setInterval(draw, 1000)
  if (!running && ticker) { clearInterval(ticker); ticker = null }
}

async function load() {
  try {
    const res = await fetch('/api/agents/list', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    Object.assign(state, { sessions: (await res.json()).sessions, error: null })
  } catch (e) {
    state.error = e.message
  }
  draw()
}

// The open agent's timeline and report; an answer for one opened before is dropped.
async function loadDetail() {
  const open = state.open
  if (!open) return draw()
  const q = new URLSearchParams(open.agent ? { session: open.session, agent: open.agent } : { session: open.session })
  let detail = null, detailError = null
  try {
    const res = await fetch(`/api/agents/agent?${q}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    detail = await res.json()
  } catch (e) {
    detailError = e.message
  }
  if (state.open !== open) return
  Object.assign(state, { detail, detailError })
  draw()
}

function readHash() {
  const m = /^#agent=([\w-]+)(?:\/([\w-]+))?$/.exec(location.hash)
  Object.assign(state, { open: m ? { session: m[1], agent: m[2] ?? null } : null, detail: null, detailError: null })
  draw()
  loadDetail()
}

i18n.onChange(draw)
window.addEventListener('hashchange', readHash)
subscribe({
  onHello: () => { load(); loadDetail() },
  onChange: (topics) => { if (topics.includes('agents.events')) { load(); loadDetail() } },
})
readHash()
