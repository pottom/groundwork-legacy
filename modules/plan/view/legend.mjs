// The legend: what the icons and colours on the map mean, in a .gw-popover under the toolbar.
//   legendView()        a lit-html template (chrome.mjs renders it)
//   closeLegendOutside(close)  Escape or a click outside closes it

import { html } from '/vendor/lit-html/lit-html.js'
import { STATUSES, IMPL } from '../node-types.mjs'
import { COMPONENT_TYPES } from '../documents.mjs'
import { state } from './state.mjs'
import { ui } from './strings.mjs'
import { COLORS, IMPL_COLORS } from './dock.mjs'

const row = (icon, color, label) => html`<li class="gw-popover__item"><i style="--icon: var(${icon}); --c: ${color}"></i>${label}</li>`
const dot = (color, label) => html`<li class="gw-popover__item"><em style="--c: ${color}"></em>${label}</li>`

export function legendView() {
  const groups = state.legendOpen ? [
    ['legend.status', Object.keys(STATUSES).map((k) => row(`--i-${k}`, COLORS[k], ui(`status.${k}`)))],
    ['legend.impl', IMPL.map((k) => dot(IMPL_COLORS[k], ui(`impl.${k}`)))],
    ['legend.structure', [row('--i-doc', 'var(--gw-accent)', ui('legend.doc')), row('--i-section', 'var(--gw-accent)', ui('legend.section'))]],
    ['legend.components', COMPONENT_TYPES.map((k) => row(`--i-c-${k}`, 'var(--gw-fg-2)', ui(`component.${k}`)))],
  ] : []
  return html`<div id="legend" class="gw-popover" role="dialog" aria-label=${ui('legend.title')} ?hidden=${!state.legendOpen}>
    ${groups.map(([title, rows]) => html`<h3 class="gw-popover__title">${ui(title)}</h3><ul class="gw-popover__list" style="--gw-popover-cols: 2">${rows}</ul>`)}
  </div>`
}

export function closeLegendOutside(close) {
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.legendOpen) close() })
  document.addEventListener('pointerdown', (e) => {
    if (!state.legendOpen) return
    const legend = document.getElementById('legend'), button = document.getElementById('legend-btn')
    if (!legend.contains(e.target) && !button.contains(e.target)) close()
  }, true)
}
