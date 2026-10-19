// The status dock at the bottom (edit mode): the selected node's status and implementation.
//   dockView()  a lit-html template (chrome.mjs renders it)
//   COLORS, IMPL_COLORS  each status's and implementation level's colour (the legend uses them too)

import { html } from '/vendor/lit-html/lit-html.js'
import { STATUSES, IMPL } from '../node-types.mjs'
import { state } from './state.mjs'
import { ui } from './strings.mjs'
import { setMeta } from './map.mjs'

export const COLORS = { inferred: 'var(--inferred)', topic: 'var(--topic)', decision: 'var(--decision)', note: 'var(--gw-muted)', excluded: 'var(--gw-muted)', parked: 'var(--parked)', todo: 'var(--todo)' }
export const IMPL_COLORS = { done: 'var(--decision)', partial: 'var(--parked)', missing: 'var(--missing)' }

// A button for one value of a field; pressed when the node has it, a press again clears it.
// A narrow dock shows only the icons: the title says it.
function valueButton(n, field, key, mark, color, label, title) {
  const on = !!n && n.metadata?.[field] === key
  return html`<button type="button" class="gw-btn gw-btn--ghost gw-btn--sm" style="--c: ${color}" title=${title} aria-label=${title}
    aria-pressed=${String(on)} ?disabled=${!n || !n.parent} @click=${() => setMeta(field, on ? undefined : key)}>${mark}<span>${label}</span></button>`
}

export function dockView() {
  const n = state.mind?.currentNode?.nodeObj
  const hint = n ? (n.parent ? n.topic : ui('dock.root')) : ui('dock.hint')
  return html`<div id="dockbar"><div id="dock" class="gw-card gw-card--glass" role="toolbar" aria-label=${ui('dock.label')}>
    <span class="hint" title=${hint}>${hint}</span>
    ${Object.keys(STATUSES).map((key) => valueButton(n, 'status', key, html`<i style="--icon: var(--i-${key})"></i>`, COLORS[key],
      ui(`status.${key}`), ui('dock.statusTitle', { label: ui(`status.${key}`) })))}
    <span class="sep" aria-hidden="true"></span>
    ${IMPL.map((key) => valueButton(n, 'impl', key, html`<em></em>`, IMPL_COLORS[key],
      ui(`impl.${key}`), ui('dock.implTitle', { label: ui(`impl.${key}`) })))}
  </div></div>`
}
