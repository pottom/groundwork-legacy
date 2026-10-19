// The Agents page: the entry module index.html loads. It reads the sessions and their agents
// (GET /api/agents/list) and draws them (list.mjs); it reads them again when the shell says the
// event log changed (topic "agents.events") or the connection came back. While something runs, a
// clock redraws the page each second so the running durations count up; it never asks the server.
// The language follows the shell (strings.mjs).

import { html, render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n } from './strings.mjs'
import { agentList } from './list.mjs'
import { worktreeList } from './worktrees.mjs'

const root = document.getElementById('agents')
// The session or agent a link asked for (Build's "being worked on": ?agent=<id>), shown once it is read.
let focus = null
try { focus = new URLSearchParams(location.search).get('agent') } catch { /* no query */ }
const state = { sessions: null, error: null, focus, worktrees: null, copied: null }
let ticker = null

function draw() {
  render(html`${agentList(state, Date.now())}${worktreeList(state, copy)}`, root)
  document.body.dataset.state = state.error ? 'error' : state.sessions ? 'ready' : 'loading'
  const asked = focus && document.getElementById('agent-' + focus)
  if (asked) { asked.scrollIntoView({ block: 'center' }); focus = null }
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
subscribe({
  onHello: () => { load(); loadWorktrees() },
  onChange: (topics) => {
    if (topics.includes('agents.events')) load()
    if (topics.includes('agents.git') || topics.includes('agents.events')) loadWorktrees()
  },
})
draw()
