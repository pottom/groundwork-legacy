// The threads of a sketch (f-board-threads): short conversations pinned to its shapes, kept beside
// the drawing in docs/product/sketches/<name>.threads.json, so the .excalidraw file stays the standard
// one (d-board-threads-file). One thread per shape, keyed by the shape's element id:
//
//   { "threads": { "api": { "closed": false, "comments": [{ "author": "Ann", "at": "<ISO time>", "text": "…" }] } } }
//
// A thread has comments with author and time and can be closed when resolved (d-board-thread-fields).
// A shape deleted later keeps its thread: it is orphaned, not lost, and can still be answered.
//
//   const threads = openThreads(files, sketches)   files: the module's writer; sketches: the store
//                                                  (sketch-store.mjs), to know which shapes there are
//   threads.list(name)                     [{ element, closed, orphaned, comments }], in the order they were started
//   threads.comment(name, element, { text, author })   adds a comment, starting the thread on a shape
//                                          that is there; a comment on a closed thread opens it again
//   threads.close(name, element, closed = true)        closes (or reopens) a thread
//   threadsFile(name)                      the file's path in the project
//   threadsText(name, list, scene)         what `groundwork sketch threads` prints
//
// A rename of the sketch moves its threads file along (sketch-store.mjs).
//
// A wrong call throws SketchError: 400 (no text, too long, not a plain name), 404 (no such shape, no
// such thread); nothing is written then.

import { SketchError, DIR, isSketchName } from './sketch-store.mjs'

export const MAX_COMMENT = 4000

export const threadsFile = (name) => {
  if (!isSketchName(name)) throw new SketchError(`not a sketch name: ${JSON.stringify(name)}`)
  return `${DIR}/${name}.threads.json`
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

export function openThreads(files, sketches) {
  const load = (name) => {
    const rel = threadsFile(name)
    if (!files.exists(rel)) return {}
    try {
      const data = JSON.parse(files.read(rel))
      return isObject(data?.threads) ? data.threads : {}
    } catch {
      return {}
    }
  }
  const store = (name, threads) => files.write(threadsFile(name), JSON.stringify({ threads }, null, 2) + '\n')
  const live = (name) => new Set(sketches.read(name).elements.filter((e) => !e.isDeleted).map((e) => e.id))

  return {
    list(name) {
      const threads = load(name)
      const there = live(name)
      return Object.entries(threads).map(([element, t]) => ({
        element,
        closed: t.closed === true,
        orphaned: !there.has(element),
        comments: Array.isArray(t.comments) ? t.comments : [],
      }))
    },
    comment(name, element, { text, author }) {
      if (typeof element !== 'string' || !element) throw new SketchError('which shape? expected { element, text }')
      const said = typeof text === 'string' ? text.trim() : ''
      if (!said) throw new SketchError('a comment needs a text')
      if (said.length > MAX_COMMENT) throw new SketchError(`a comment may be at most ${MAX_COMMENT} characters`)
      const threads = load(name)
      if (!threads[element] && !live(name).has(element)) throw new SketchError(`no shape ${element} in the sketch ${name}`, 404)
      const thread = threads[element] ?? { closed: false, comments: [] }
      thread.closed = false
      thread.comments = [...(thread.comments ?? []), { author: String(author || 'someone'), at: new Date().toISOString(), text: said }]
      threads[element] = thread
      store(name, threads)
      return thread
    },
    close(name, element, closed = true) {
      const threads = load(name)
      if (!threads[element]) throw new SketchError(`no thread on ${element} in the sketch ${name}`, 404)
      threads[element].closed = closed !== false
      store(name, threads)
      return threads[element]
    },
  }
}

// What `groundwork sketch threads` prints: every thread, the shape it is pinned to, its comments.
//
//   Threads on main: 1 open, 1 closed
//   api "API" (open)
//     Ann, 2026-10-19 10:00: Should this be a queue?
//   db (closed, orphaned: the shape was deleted)
//     …
const pad = (n) => String(n).padStart(2, '0')
const when = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso ?? '')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function threadsText(name, threads, scene) {
  if (!threads.length) return `Sketch ${name}: no threads yet. Start one with \`groundwork sketch comment ${name} <id> "<text>"\`.`
  const elements = scene.elements ?? []
  const labelOf = (id) => {   // a deleted shape's label too, for its orphaned thread
    const labels = elements.filter((t) => t.type === 'text' && t.containerId === id)
    return (labels.find((t) => !t.isDeleted) ?? labels[0])?.text
  }
  const open = threads.filter((t) => !t.closed).length
  const out = [`Threads on ${name}: ${open} open, ${threads.length - open} closed`]
  for (const t of threads) {
    const label = labelOf(t.element)
    const state = (t.closed ? 'closed' : 'open') + (t.orphaned ? ', orphaned: the shape was deleted' : '')
    out.push(`${t.element}${label ? ` ${JSON.stringify(label)}` : ''} (${state})`)
    for (const c of t.comments) out.push(`  ${c.author}, ${when(c.at)}: ${String(c.text).replace(/\n/g, '\n    ')}`)
  }
  return out.join('\n')
}
