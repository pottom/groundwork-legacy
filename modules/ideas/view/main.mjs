// The Ideas page: the entry module index.html loads. It reads the ideas from /api/ideas/list,
// draws the board (board.mjs) and reads them again when the shell says an idea file changed
// (topic "ideas.items") or the connection came back. An idea that arrives live is marked for a
// moment. The language follows the shell (strings.mjs).

import { render } from '/vendor/lit-html/lit-html.js'
import { subscribe } from '/shell/live.mjs'
import { i18n } from './strings.mjs'
import { board } from './board.mjs'

const root = document.getElementById('board')
const state = { ideas: null, error: null, fresh: new Set() }
let known = null   // the ids seen so far; null before the first read
let freshTimer

const draw = () => render(board(state), root)

async function read() {
  try {
    const res = await fetch('/api/ideas/list', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { ideas } = await res.json()
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
}

document.documentElement.lang = i18n.lang
i18n.onChange(() => { document.documentElement.lang = i18n.lang; draw() })
subscribe({
  onHello: read,
  onChange: (topics) => { if (topics.includes('ideas.items')) read() },
})
