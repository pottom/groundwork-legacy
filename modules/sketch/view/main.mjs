// The Sketch page's entry: chooses the sketch (sketches.mjs), reads it, shows it on the board, and
// saves it when the drawing changes (saver.mjs). The board follows the shell: light or dark from the
// OS, the UI language chosen in the shell's header. A failed read or save shows as a .gw-toast.
//
// Which sketch: the deep link's (/?module=sketch&sketch=<name>, which the shell hands this frame as
// ?sketch=<name>), else the one opened last in this browser, else the first, else "main". The bar
// above the board opens another, makes a new one or renames this one; each reloads the page on the
// sketch it lands on, after the drawing is saved.

import { html, render } from '/vendor/lit-html/lit-html.js'
import { createI18n } from '/shell/i18n.mjs'
import { SKETCH_STRINGS } from '../ui-strings.mjs'
import { mountBoard } from './board.mjs'
import { createSaver } from './saver.mjs'
import { followTheme } from './theme.mjs'
import { chooseSketch, mountSketchBar, postSketch } from './sketches.mjs'

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

async function save(elements, appState, files) {
  const body = window.ExcalidrawLib.serializeAsJSON(elements, appState, files, 'local')
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
    const res = await fetch(api())
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
    board.set({ lang })
  })
}

start()
