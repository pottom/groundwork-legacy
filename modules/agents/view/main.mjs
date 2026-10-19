// The Agents page: the entry module index.html loads. It reads the sessions and their agents
// (GET /api/agents/list) and draws them (list.mjs). The open agent or session is in the address
// (#agent=<session>/<agent>, #agent=<session>; Build's link: ?agent=<session>/<agent>, address.mjs);
// its timeline and report come from
// GET /api/agents/agent. Both are read again when the shell says the event log changed (topic
// "agents.events") or the connection came back. While something runs, a clock redraws the page
// each second so the running durations count up; it never asks the server. Below, the worktrees
// and branches (GET /api/agents/worktrees, worktrees.mjs), read again on "agents.git" and "agents.events";
// an agent's branch links to its row there (#branch=<name>), which keeps the open agent open.
// The language follows the shell (strings.mjs).

import { html, render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n } from './strings.mjs'
import { agentList } from './list.mjs'
import { worktreeList } from './worktrees.mjs'
import { readAddress } from './address.mjs'

const root = document.getElementById('agents')
// The session or agent a link asked for (Build's "being worked on": ?agent=<session>/<agent>),
// marked, and scrolled to once it is read; a branch row a link points to (#branch=<name>) too.
const { focus } = readAddress(location)
const state = { sessions: null, error: null, focus, open: null, detail: null, detailError: null, worktrees: null, copied: null, branch: null }
let scrollTo = focus && 'agent-' + focus
let ticker = null

function draw() {
  render(html`${agentList(state, Date.now())}${worktreeList(state, copy)}`, root)
  document.body.dataset.state = state.error ? 'error' : state.sessions ? 'ready' : 'loading'
  const asked = scrollTo && document.getElementById(scrollTo)
  if (asked) { asked.scrollIntoView({ block: 'center' }); scrollTo = null }
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
  const { open, branch } = readAddress(location)
  state.branch = branch
  if (branch) scrollTo = 'branch-' + branch
  if (open === undefined) return draw()
  Object.assign(state, { open, detail: null, detailError: null })
  draw()
  loadDetail()
}

// The worktrees and branches (worktrees.mjs), read again when a ref changes (topic "agents.git")
// and when the log does (an agent's edit may have changed a worktree); one read at a time.
let reading = null, again = false
async function loadWorktrees() {
  if (reading) { again = true; return }
  reading = fetch('/api/agents/worktrees', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null)).catch(() => null)
    .then((answer) => { state.worktrees = answer; draw() })
  await reading
  reading = null
  if (again) { again = false; loadWorktrees() }
}

function copy(key, text) {
  navigator.clipboard?.writeText(text).then(() => {
    state.copied = key
    draw()
    setTimeout(() => { if (state.copied === key) { state.copied = null; draw() } }, 1500)
  }, () => {})
}

i18n.onChange(draw)
window.addEventListener('hashchange', readHash)
subscribe({
  onHello: () => { load(); loadDetail(); loadWorktrees() },
  onChange: (topics) => {
    if (topics.includes('agents.events')) { load(); loadDetail() }
    if (topics.includes('agents.git') || topics.includes('agents.events')) loadWorktrees()
  },
})
readHash()
