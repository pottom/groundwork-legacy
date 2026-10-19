// The Sketch page's entry: reads the sketch, shows it on the board, and saves it when the drawing
// changes (saver.mjs). It follows the file live: when the sketch changes on disk (Claude drew with
// `groundwork sketch apply`, topic sketch.files) it reads it again and merges it into the board
// (follow.mjs), so Claude's drawing appears at once and the developer's own drawing stays. The board
// follows the shell: light or dark from the OS, the UI language chosen in the shell's header. A
// failed read or save shows as a .gw-toast.
//
// A save sends the elements as Excalidraw keeps them, the deleted ones too (isDeleted: true), which
// its serializeAsJSON leaves out: the server merges the save with the file element by element
// (merge.mjs), and a deletion must reach the file as an edit to win there.
//
// This first version has one sketch, "main" (docs/product/sketches/main.excalidraw).

import { html, render } from '/vendor/lit-html/lit-html.js'
import { createI18n } from '/shell/i18n.mjs'
import { subscribe } from '/shell/live.mjs'
import { SKETCH_STRINGS } from '../ui-strings.mjs'
import { mountBoard } from './board.mjs'
import { createSaver } from './saver.mjs'
import { followDisk } from './follow.mjs'
import { followTheme } from './theme.mjs'

const NAME = 'main'
const API = `/api/sketch/scene?name=${encodeURIComponent(NAME)}`
const TOAST_MS = 4000

const i18n = createI18n(SKETCH_STRINGS)
i18n.apply(document)

let toasts = []
function toast(key) {
  const item = { key }
  toasts = [...toasts, item]
  showToasts()
  setTimeout(() => { toasts = toasts.filter((t) => t !== item); showToasts() }, TOAST_MS)
}
function showToasts() {
  render(toasts.map((t) => html`<div class="gw-toast gw-toast--bad" role="alert">${i18n.t(t.key)}</div>`), document.getElementById('toasts'))
}

async function readScene() {
  const res = await fetch(API)
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

async function save(elements, appState, files) {
  const body = JSON.stringify({
    type: 'excalidraw', version: 2, source: location.origin, elements,
    appState: { gridSize: appState.gridSize ?? null, viewBackgroundColor: appState.viewBackgroundColor }, files,
  })
  const res = await fetch(API, { method: 'PUT', headers: { 'content-type': 'application/json' }, body })
  if (!res.ok) {
    toast(res.status === 413 ? 'toast.tooLarge' : 'toast.saveFailed')
    throw new Error(`save: ${res.status}`)
  }
}

async function start() {
  let scene
  try {
    scene = await readScene()
  } catch {
    toast('toast.loadFailed')
    return
  }
  const saver = createSaver({ save })
  saver.loaded(scene.elements, scene.files)
  const board = mountBoard(document.getElementById('board'), { scene, onChange: saver.change })
  addEventListener('pagehide', () => saver.flush())

  // The file changed on disk: what it has is saved already; what is newer on the board stays.
  async function refresh() {
    const api = board.api
    if (!api) return
    let disk
    try { disk = await readScene() } catch { return }   // the next change reads it again
    saver.loaded(disk.elements, disk.files)
    const known = api.getFiles()
    const images = Object.values(disk.files ?? {}).filter((f) => !known[f.id])
    if (images.length) api.addFiles(images)
    const elements = followDisk(api.getSceneElementsIncludingDeleted(), disk.elements)
    if (elements) api.updateScene({ elements })
  }
  subscribe({
    onHello: refresh,
    onChange: (topics) => { if (topics.includes('sketch.files')) refresh() },
  })

  board.set({ lang: i18n.lang })
  followTheme((dark) => board.set({ dark }))
  i18n.onChange((lang) => {
    i18n.apply(document)
    showToasts()
    board.set({ lang })
  })
}

start()
