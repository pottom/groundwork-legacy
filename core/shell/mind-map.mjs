// <gw-mind-map>: a read-only mind map, shared by the module pages (d-map-component, d-map-readonly).
// A Lit component on the vendored Mind Elixir, in the map theme the Plan uses (light or dark
// following the shell's theme). It draws a tree and never edits it: no drag, no rename, no node menu,
// no keys. Served at /shell/mind-map.mjs; the page needs Lit's import map in its <head>
// (core/vendor/README.md), and the component links its own styles (Mind Elixir's and mind-map.css).
//
//   import '/shell/mind-map.mjs'
//   html`<gw-mind-map .tree=${tree} .marks=${{ q1: 'new' }} .flash=${['q1']}></gw-mind-map>`
//   el.focusNode('q1')     scrolls the map to the node and highlights it for a moment
//
//   tree    { topic, children: [{ id, kind, text, recommended?, note?, link?, children }] }
//           (mind-map-tree.mjs); kind: thought, question, option, decision, constraint, excluded.
//           Each kind has its icon and colour; a recommended option is starred, a note shows on
//           hover, a link as `→ id`
//   marks   { [id]: 'new' | 'modified' | 'removed' }: marks set from outside (what changed since
//           the last commit); a removed node is struck through
//   flash   [id]: highlighted for as long as they are set (what the last write changed)
//
// It renders into the page (no shadow root), so the theme's tokens reach Mind Elixir's nodes; its
// height is the page's to give (CSS on gw-mind-map).

import { LitElement, html } from '/vendor/lit-element/lit-element.js'
import MindElixir from '/vendor/mind-elixir/MindElixir.js'
import { KINDS, ROOT_ID, toMindElixir, indexTree, iconUrl } from './mind-map-tree.mjs'

const FOCUS_MS = 1600
const MIN_SCALE = 0.7   // a fitted map never smaller than readable
const css = (/** @type {string} */ name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Plan's map theme (modules/plan/map-theme.mjs), kept here until the Plan goes (C-10, d-plan-dissolves)
const PALETTES = {
  light: ['#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ef4444'],
  dark: ['#60a5fa', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#f87171'],
}

// The lines run from the right edge of a node to the left edge of its child, at mid-height.
/** @param {any} b */
function mainBranch({ pT, pL, pW, pH, cT, cL, cH }) {
  const x1 = pL + pW, y1 = pT + pH / 2, x2 = cL, y2 = cT + cH / 2, mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
}
/** @this {any} @param {any} b */
function subBranch({ pT, pL, pW, pH, cT, cL, cH, isFirst }) {
  const gap = parseInt(this.container.style.getPropertyValue('--node-gap-x')) || 0
  const x1 = pL + pW - (isFirst ? 0 : gap), y1 = pT + pH / 2, x2 = cL + gap, y2 = cT + cH / 2, mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`
}

/** @param {boolean} dark */
function theme(dark) {
  const type = dark ? 'dark' : 'light'
  return {
    name: `gw-map-${type}`,
    type,
    palette: PALETTES[type],
    cssVar: {
      '--bgcolor': 'transparent',
      '--color': css('--gw-fg'),
      '--main-color': css('--gw-fg'),
      '--main-bgcolor': css('--gw-surface'),
      '--main-bgcolor-transparent': 'transparent',
      '--root-color': css('--gw-accent-fg'),
      '--root-bgcolor': css('--gw-accent'),
      '--root-border-color': 'transparent',
      '--root-radius': '999px',
      '--main-radius': '999px',
      '--topic-padding': '6px 12px',
      '--node-gap-x': '44px',
      '--node-gap-y': '8px',
      '--main-gap-x': '56px',
      '--main-gap-y': '16px',
      '--selected': css('--gw-accent'),
      '--accent-color': css('--gw-accent'),
      '--panel-color': css('--gw-fg'),
      '--panel-bgcolor': css('--gw-surface'),
      '--panel-border-color': css('--gw-line'),
      '--map-padding': '40px 60px',
    },
  }
}

export class MindMap extends LitElement {
  static properties = { tree: { attribute: false }, marks: { attribute: false }, flash: { attribute: false } }

  constructor() {
    super()
    /** @type {import('./mind-map-tree.mjs').Tree | null} */
    this.tree = null
    /** @type {Record<string, string> | null} */
    this.marks = null
    /** @type {string[] | Set<string> | null} */
    this.flash = null
    /** @type {any} */
    this.mind = null
    /** @type {Map<string, { node: any, path: string[] }>} */
    this.index = new Map()
    this.drawn = ''
    this.focused = ''
    this.focusTimer = 0
    this.creating = false
    /** @type {ResizeObserver | null} */
    this.resized = null
  }

  createRenderRoot() { return this }

  connectedCallback() {
    super.connectedCallback()
    for (const kind of Object.keys(KINDS)) this.style.setProperty(`--gw-mm-i-${kind}`, iconUrl(kind))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this.resized?.disconnect()
    this.mind?.destroy?.()
    this.mind = null
    this.drawn = ''
  }

  render() {
    return html`<link rel="stylesheet" href="/vendor/mind-elixir/MindElixir.css"><link rel="stylesheet" href="/shell/mind-map.css">
      <div class="gw-mind-map__canvas"></div>`
  }

  /** @param {Map<string, unknown>} changed */
  updated(changed) {
    if (!this.mind) { if (!this.creating) this.create() }
    else if (changed.has('tree')) this.draw()
    else this.decorate()
  }

  // Mind Elixir draws its lines for the sizes the nodes have then: so it starts once the styles are
  // in, and draws them again when the nodes change size (a font, a badge) or the box does
  async create() {
    const el = /** @type {HTMLDivElement | null} */ (this.querySelector('.gw-mind-map__canvas'))
    if (!el) return
    this.creating = true
    await Promise.all([...this.querySelectorAll('link[rel="stylesheet"]')].map((l) => /** @type {HTMLLinkElement} */ (l).sheet ? null
      : new Promise((done) => { l.addEventListener('load', done, { once: true }); l.addEventListener('error', done, { once: true }) })))
    this.creating = false
    if (!this.isConnected || this.mind) return
    const themes = /** @type {any} */ (window).groundworkTheme
    const dark = themes ? themes.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    this.mind = new MindElixir({
      el,
      direction: MindElixir.RIGHT,
      editable: false,
      contextMenu: false,
      toolBar: true,
      keypress: false,
      allowUndo: false,
      theme: theme(dark),
      generateMainBranch: mainBranch,
      generateSubBranch: subBranch,
    })
    this.mind.bus.addListener('linkDiv', () => this.decorate())
    let timer = 0
    const relink = () => { clearTimeout(timer); timer = window.setTimeout(() => this.mind?.linkDiv()) }
    this.resized = typeof ResizeObserver === 'function' ? new ResizeObserver(relink) : null
    this.resized?.observe(this)
    document.fonts?.ready.then(relink)
    themes?.onChange?.((/** @type {string} */ now) => { this.mind?.changeTheme(theme(now === 'dark')); this.decorate() })
    this.draw()
  }

  // the tree drawn again, only when it differs from the one on the map
  draw() {
    const data = toMindElixir(this.tree)
    const key = JSON.stringify(data)
    this.index = indexTree(this.tree)
    if (key === this.drawn) { this.decorate(); return }
    const first = !this.drawn
    this.drawn = key
    if (first) this.mind.init(data)
    else this.mind.refresh(data)
    if (first) requestAnimationFrame(() => this.fit())
  }

  // the whole map in view, but never smaller than readable
  fit() {
    const mind = this.mind
    if (!mind) return
    mind.scaleFit()
    if (mind.scaleVal >= MIN_SCALE) return
    // too big to fit readable: readable, with the root at the left edge (the map grows to the right)
    mind.scale(MIN_SCALE)
    mind.toCenter()
    const root = mind.map.querySelector('me-root')
    if (root) mind.move(mind.container.getBoundingClientRect().left + 24 - root.getBoundingClientRect().left, 0)
  }

  // each node's kind, marks and badges, set on Mind Elixir's node after every drawing
  decorate() {
    if (!this.mind) return
    const flash = new Set(this.flash ?? [])
    for (const tpc of /** @type {NodeListOf<any>} */ (this.mind.container.querySelectorAll('me-tpc'))) {
      const id = tpc.nodeObj?.id
      if (!id) continue
      const n = this.index.get(id)?.node
      /** @param {string} k @param {string | null | undefined} v */
      const set = (k, v) => { if (v == null) delete tpc.dataset[k]; else if (tpc.dataset[k] !== v) tpc.dataset[k] = v }
      set('kind', id === ROOT_ID ? null : n?.kind ?? 'thought')
      set('recommended', n?.recommended ? '' : null)
      set('mark', this.marks?.[id] ?? null)
      set('flash', flash.has(id) ? '' : null)
      set('focus', this.focused === id ? '' : null)
      if (n?.note) tpc.title = n.note; else tpc.removeAttribute('title')
      let badge = tpc.querySelector(':scope > .gw-mind-map__link')
      if (!n?.link) badge?.remove()
      else {
        if (!badge) { badge = document.createElement('span'); badge.className = 'gw-tag gw-mind-map__link'; tpc.appendChild(badge) }
        if (badge.textContent !== `→ ${n.link}`) badge.textContent = `→ ${n.link}`
      }
    }
  }

  /** Scrolls the map to a node and highlights it for a moment. @param {string} id */
  focusNode(id) {
    const el = this.mind?.findEle?.(id)
    if (!el) return false
    this.mind.selectNode(el)
    this.focused = id
    this.decorate()
    clearTimeout(this.focusTimer)
    this.focusTimer = window.setTimeout(() => { this.focused = ''; this.decorate() }, FOCUS_MS)
    return true
  }
}

if (!customElements.get('gw-mind-map')) customElements.define('gw-mind-map', MindMap)
