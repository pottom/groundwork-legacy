// The Sketch page's entry: reads the sketch, shows it on the board, and saves it when the drawing
// changes (saver.mjs). The board follows the shell: light or dark from the OS, the UI language
// chosen in the shell's header. A failed read or save shows as a .gw-toast.
//
// This first version has one sketch, "main" (docs/product/sketches/main.excalidraw).

import { html, render } from '/vendor/lit-html/lit-html.js'
import { createI18n } from '/shell/i18n.mjs'
import { SKETCH_STRINGS } from '../ui-strings.mjs'
import { mountBoard } from './board.mjs'
import { createSaver } from './saver.mjs'
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

async function save(elements, appState, files) {
  const body = window.ExcalidrawLib.serializeAsJSON(elements, appState, files, 'local')
  const res = await fetch(API, { method: 'PUT', headers: { 'content-type': 'application/json' }, body })
  if (!res.ok) {
    toast(res.status === 413 ? 'toast.tooLarge' : 'toast.saveFailed')
    throw new Error(`save: ${res.status}`)
  }
}

async function start() {
  let scene
  try {
    const res = await fetch(API)
    if (!res.ok) throw new Error(String(res.status))
    scene = await res.json()
  } catch {
    toast('toast.loadFailed')
    return
  }
  const saver = createSaver({ save })
  saver.loaded(scene.elements, scene.files)
  const board = mountBoard(document.getElementById('board'), { scene, onChange: saver.change })
  addEventListener('pagehide', () => saver.flush())

  board.set({ lang: i18n.lang })
  followTheme((dark) => board.set({ dark }))
  i18n.onChange((lang) => {
    i18n.apply(document)
    showToasts()
    board.set({ lang })
  })
}

start()
