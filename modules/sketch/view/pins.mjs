// The threads on the board, without the DOM: where a pin goes, which shape is selected, and the
// API the page reads and writes them through. Plain functions, so they are tested in Node; the
// pins and the panel themselves are thread-panel.mjs.
//
//   pinPlaces(threads, elements, appState)   [{ element, left, top, closed, count }]: a pin per thread
//                                            whose shape is on the board, at the shape's top right
//                                            corner in the board's pixels; an orphaned thread has none
//   selectedShape(elements, appState)        the one selected shape's id (a label stands for its shape), else null
//   shapeLabel(elements, id)                 the shape's label or text, else its id
//   readThreads(name)                        GET /api/sketch/threads?name=<name> -> the threads
//   commentOn(name, element, text)           POST /api/sketch/comment?name=<name>, as JSON (the server
//                                            names the developer as its author)
//   closeThread(name, element, closed)       POST /api/sketch/close?name=<name>; closed: false reopens
//   both reject with { status } when the server refuses (api.mjs)

import { getJson, postJson } from './api.mjs'

export function pinPlaces(threads, elements, appState) {
  const live = new Map(elements.filter((e) => !e.isDeleted).map((e) => [e.id, e]))
  const zoom = appState.zoom?.value ?? 1
  const out = []
  for (const t of threads) {
    const e = live.get(t.element)
    if (!e) continue
    out.push({
      element: t.element,
      left: (e.x + Math.max(e.width, 0) + appState.scrollX) * zoom,
      top: (e.y + appState.scrollY) * zoom,
      closed: t.closed,
      count: t.comments.length,
    })
  }
  return out
}

export function selectedShape(elements, appState) {
  const ids = Object.keys(appState.selectedElementIds ?? {}).filter((id) => appState.selectedElementIds[id])
  const live = elements.filter((e) => !e.isDeleted && ids.includes(e.id))
  const shapes = new Set(live.map((e) => (e.type === 'text' && e.containerId ? e.containerId : e.id)))
  return shapes.size === 1 ? [...shapes][0] : null
}

export function shapeLabel(elements, id) {
  const e = elements.find((x) => x.id === id)
  const labels = elements.filter((t) => t.type === 'text' && t.containerId === id)
  const label = (labels.find((t) => !t.isDeleted) ?? labels[0])?.text   // a deleted shape's, for its orphaned thread
  return label || (e?.type === 'text' ? e.text : null) || id
}

export const readThreads = async (name) => (await getJson(`/api/sketch/threads?name=${encodeURIComponent(name)}`)).threads

export const commentOn = (name, element, text) => postJson(`/api/sketch/comment?name=${encodeURIComponent(name)}`, { element, text })
export const closeThread = (name, element, closed) => postJson(`/api/sketch/close?name=${encodeURIComponent(name)}`, { element, closed })
