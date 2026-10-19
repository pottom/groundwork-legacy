// The icons of Plan's page: the chrome's icons as lit-html templates (Lucide line icons,
// https://lucide.dev, ISC license), and the node icons as CSS masks for the map and the panel.

import { html, svg } from '/vendor/lit-html/lit-html.js'
import { STATUSES, SHAPES, COMPONENT_ICONS, iconUrl, maskUrl } from '../node-types.mjs'

// The node icons as CSS custom properties on :root: --i-<status>, --i-doc, --i-section, --i-c-<component type>.
export function installNodeIcons(root = document.documentElement) {
  const set = (name, url) => root.style.setProperty(name, url)
  for (const key of Object.keys(STATUSES)) set(`--i-${key}`, iconUrl(key))
  for (const [key, svg] of Object.entries(SHAPES)) set(`--i-${key}`, maskUrl(svg))
  for (const [key, svg] of Object.entries(COMPONENT_ICONS)) set(`--i-c-${key}`, maskUrl(svg))
}

const icon = (body, width = 2) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=${width} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICON = {
  copy: icon(svg`<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`),
  plus: icon(svg`<path d="M12 5v14M5 12h14"/>`),
  pen: icon(svg`<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>`),
  edit: icon(svg`<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>`),
  map: icon(svg`<circle cx="12" cy="12" r="2.6"/><circle cx="4.5" cy="6" r="1.8"/><circle cx="19.5" cy="6" r="1.8"/><circle cx="4.5" cy="18" r="1.8"/><circle cx="19.5" cy="18" r="1.8"/><path d="M6 7l3.9 3.2M18 7l-3.9 3.2M6 17l3.9-3.2M18 17l-3.9-3.2"/>`, 1.6),
  info: icon(svg`<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>`),
  alert: icon(svg`<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>`),
  chevron: icon(svg`<path d="m9 18 6-6-6-6"/>`, 2.4),
  // the views: the map, both side by side, the document
  viewMap: icon(svg`<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.5 12c4 0 3.5-6.5 7-6.5M8.5 12c4 0 3.5 6.5 7 6.5"/>`),
  viewSplit: icon(svg`<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M13 4v16"/>`),
  viewPrd: icon(svg`<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8M16 17H8M10 9H8"/>`),
}
