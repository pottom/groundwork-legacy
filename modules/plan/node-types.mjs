// Shared by the server (plan.mjs) and the browser (index.html).
// The map holds outcomes only (topics, decisions, facts), never the questions
// that led to them. The data stores just the status; index.html styles it.
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

// A CSS url() for the icon, usable as a mask so it can take any color.
export function iconUrl(status) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${STATUSES[status].svg}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

// Sets the status on a node object in place (and drops any old inline look).
export function setStatus(node, status) {
  node.metadata = { ...(node.metadata || {}), status }
  delete node.style
  delete node.tags
  return node
}
