// The Sketch page's entry: chooses the sketch (sketches.mjs), reads it, shows it on the board, and
// saves it when the drawing changes (saver.mjs). It follows the file live: when the sketch changes
// on disk (Claude drew with `groundwork sketch apply`, topic sketch.files) it reads it again and
// merges it into the board (follow.mjs), so Claude's drawing appears at once and the developer's own
// drawing stays. The threads pinned to its shapes (thread-panel.mjs) are read with it and again on
// every sketch.files, so a comment from Claude (`groundwork sketch comment`) shows at once. The board follows the shell: light or dark from the OS, the UI language chosen in
// the shell's header. A failed read or save shows as a .gw-toast.
//
// A save sends the elements as Excalidraw keeps them, the deleted ones too (isDeleted: true), which
// its serializeAsJSON leaves out: the server merges the save with the file element by element
// (merge.mjs), and a deletion must reach the file as an edit to win there.
//
// Which sketch: the deep link's (/?module=sketch&sketch=<name>, which the shell hands this frame as
// ?sketch=<name>), else the one opened last in this browser, else the first, else "main". The bar
// above the board opens another, makes a new one or renames this one; each reloads the page on the
// sketch it lands on, after the drawing is saved.

import { html, render } from '/vendor/lit-html/lit-html.js'
import { createI18n } from '/shell/i18n.mjs'
import { subscribe } from '/shell/live.mjs'
import { SKETCH_STRINGS } from '../ui-strings.mjs'
import { mountBoard } from './board.mjs'
import { createSaver } from './saver.mjs'
import { followDisk } from './follow.mjs'
import { followTheme } from './theme.mjs'
import { chooseSketch, mountSketchBar, postSketch } from './sketches.mjs'
import { readThreads, commentOn, closeThread } from './pins.mjs'
import { mountPins } from './thread-panel.mjs'

const LAST_KEY = 'groundwork-sketch:last'
const TOAST_MS = 4000

const recall = () => { try { return localStorage.getItem(LAST_KEY) } catch { return null } }
const remember = (name) => { try { localStorage.setItem(LAST_KEY, name) } catch {} }

let current = null
const api = () => `/api/sketch/scene?name=${encodeURIComponent(current)}`

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
  const res = await fetch(api())
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

async function save(elements, appState, files) {
  const body = JSON.stringify({
    type: 'excalidraw', version: 2, source: location.origin, elements,
    appState: { gridSize: appState.gridSize ?? null, viewBackgroundColor: appState.viewBackgroundColor }, files,
  })
  const res = await fetch(api(), { method: 'PUT', headers: { 'content-type': 'application/json' }, body })
  if (!res.ok) {
    toast(res.status === 413 ? 'toast.tooLarge' : 'toast.saveFailed')
    throw new Error(`save: ${res.status}`)
  }
}

// The shell's address names the sketch shown, so a reload or a copied link opens it again.
function showInAddress(name) {
  try {
    if (window.top === window) return
    const url = new URL(window.top.location.href)
    if (url.searchParams.get('module') !== 'sketch' || url.searchParams.get('sketch') === name) return
    url.searchParams.set('sketch', name)
    window.top.history.replaceState(window.top.history.state, '', url)
  } catch {}
}

async function names() {
  try {
    const res = await fetch('/api/sketch/list', { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    return (await res.json()).sketches.map((s) => s.name)
  } catch {
    toast('toast.listFailed')
    return []
  }
}

async function start() {
  const list = await names()
  current = chooseSketch({ asked: new URLSearchParams(location.search).get('sketch'), remembered: recall(), names: list })
  remember(current)
  showInAddress(current)

  let scene
  try {
    scene = await readScene()
  } catch {
    toast('toast.loadFailed')
    return
  }
  const saver = createSaver({ save })
  saver.loaded(scene.elements, scene.files)

  // The threads pinned to its shapes: read with the sketch, again on every change of the files.
  // A comment saves the drawing first, so a shape drawn a moment ago is on disk to pin it to.
  const fail = (key) => (e) => { toast(key); throw e }
  const pins = mountPins({
    layer: document.getElementById('pins'),
    panel: document.getElementById('thread'),
    toggle: document.getElementById('thread-toggle'),
    i18n,
    onComment: (element, text) => saver.flush().then(() => commentOn(current, element, text)).then(refreshThreads, fail('toast.commentFailed')),
    onClose: (element, closed) => closeThread(current, element, closed).then(refreshThreads, fail('toast.commentFailed')),
  })
  async function refreshThreads() {
    try { pins.setThreads(await readThreads(current)) } catch { toast('toast.threadsFailed') }
  }

  const onChange = (elements, appState, files) => {
    saver.change(elements, appState, files)
    pins.setView(elements, appState)
  }
  const board = mountBoard(document.getElementById('board'), { scene, onChange })
  addEventListener('pagehide', () => saver.flush())
  refreshThreads()

  // The file changed on disk: what it has is saved already; what is newer on the board stays.
  async function refresh() {
    const excalidraw = board.api
    if (!excalidraw) return
    let disk
    try { disk = await readScene() } catch { return }   // the next change reads it again
    saver.loaded(disk.elements, disk.files)
    const known = excalidraw.getFiles()
    const images = Object.values(disk.files ?? {}).filter((f) => !known[f.id])
    if (images.length) excalidraw.addFiles(images)
    const elements = followDisk(excalidraw.getSceneElementsIncludingDeleted(), disk.elements)
    if (elements) excalidraw.updateScene({ elements })
  }
  subscribe({
    onHello: () => { refresh(); refreshThreads() },
    onChange: (topics) => { if (topics.includes('sketch.files')) { refresh(); refreshThreads() } },
  })

  // Leaves for another sketch once this one is saved; a save still to come goes to the new name.
  const go = async (name, change) => {
    await saver.flush()
    if (change) await change()
    current = name
    remember(name)
    showInAddress(name)
    location.replace('?' + new URLSearchParams({ sketch: name }))
  }
  const bar = mountSketchBar(document.getElementById('sketches'), {
    current, names: list, i18n,
    onOpen: (name) => go(name),
    onCreate: (name) => go(name, () => postSketch('create', { name })),
    onRename: (to) => go(to, () => postSketch('rename', { from: current, to })),
  })

  board.set({ lang: i18n.lang })
  followTheme((dark) => board.set({ dark }))
  i18n.onChange((lang) => {
    i18n.apply(document)
    showToasts()
    bar.redraw()
    pins.redraw()
    board.set({ lang })
  })
}

start()
