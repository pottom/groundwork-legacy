// Shared by the server (plan.mjs) and the browser (the page, view/).
// The map holds outcomes only (topics, decisions, facts), never the questions
// that led to them. The data stores just the status; the page styles it (view/map.css).
// The labels are UI text, translated in ui-strings.mjs (status.<key>, impl.<key>).
//
// `svg` is the inner markup of a 24×24 Lucide icon (https://lucide.dev, ISC license).

export const STATUSES = {
  topic: {
    svg: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  },
  decision: {
    svg: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  },
  note: {
    svg: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  },
  excluded: {
    svg: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  },
  parked: {
    svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  },
  todo: {
    svg: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  },
  // read from an existing codebase or document, waiting for the human to confirm
  inferred: {
    svg: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 12.5-2 2.5 2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/>',
  },
}

// Implementation layer, independent of the status: how far the code is.
export const IMPL = ['done', 'partial', 'missing']

// The icons of the map's structure, in the same family: a document layer, a section of a
// document, and one per component type (COMPONENT_TYPES in documents.mjs).
export const SHAPES = {
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  section: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
}
export const COMPONENT_ICONS = {
  software: '<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>',
  service: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  infra: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
  shared: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
}

// A CSS url() of an icon's inner markup, usable as a mask so it can take any color.
export function maskUrl(inner) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// The mask url() of a status's icon.
export const iconUrl = (status) => maskUrl(STATUSES[status].svg)

// Sets the status on a node object in place (and drops any old inline look).
export function setStatus(node, status) {
  node.metadata = { ...(node.metadata || {}), status }
  delete node.style
  delete node.tags
  return node
}
