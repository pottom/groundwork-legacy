// What a sketch or one of its shapes links to: an idea, a map node, a ticket or another sketch.
// One plain form for all of them, groundwork://<kind>/<ref>, kept in the sketch's links and in an
// Excalidraw element's own `link`; the shell's address that opens it is made only when clicked.
// Shared by the page and the server (sketch-store.mjs, links-store.mjs).
//
//   target(kind, ref)        'groundwork://idea/I-12', or null when ref is not one of that kind
//                            idea: I-12, i-012 or 12; node: a map id; ticket: #34 or "core 3"
//                            (as Build labels it); sketch: a plain sketch name
//   parseTarget(uri)         { kind, ref } of such a link, or null
//   shellLink(uri, renamed)  the shell's address that opens it: Ideas on the idea, Plan on the
//                            node, Build on the ticket, Sketch on the sketch (renamed: old name →
//                            new); an address of the shell (/?module=…) as it is; else null

import { isSketchName } from './sketches.mjs'

export const KINDS = ['idea', 'node', 'ticket', 'sketch']
const PREFIX = 'groundwork://'
const MAP_ID = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u

const CLEAN = {
  idea: (s) => { const m = /^(?:I-)?0*(\d+)$/i.exec(s); return m ? `I-${m[1] || 0}` : null },
  node: (s) => (s.length <= 120 && MAP_ID.test(s) ? s : null),
  ticket: (s) => { const t = s.replace(/\s+/g, ' '); return t && t.length <= 80 ? t : null },
  sketch: (s) => (isSketchName(s) ? s : null),
}

function clean(kind, ref) {
  if (!Object.hasOwn(CLEAN, kind) || typeof ref !== 'string') return null
  return CLEAN[kind](ref.trim())
}

export function target(kind, ref) {
  const r = clean(kind, ref)
  return r == null ? null : PREFIX + kind + '/' + encodeURIComponent(r)
}

export function parseTarget(uri) {
  if (typeof uri !== 'string' || !uri.startsWith(PREFIX)) return null
  const m = /^([a-z]+)\/(.+)$/.exec(uri.slice(PREFIX.length))
  if (!m) return null
  let ref
  try { ref = decodeURIComponent(m[2]) } catch { return null }
  const r = clean(m[1], ref)
  return r == null ? null : { kind: m[1], ref: r }
}

const OPEN = { idea: ['ideas', 'idea'], node: ['plan', 'node'], ticket: ['build', 'ticket'], sketch: ['sketch', 'sketch'] }

export function shellLink(uri, renamed = {}) {
  if (typeof uri === 'string' && uri.startsWith('/?module=')) return uri
  const t = parseTarget(uri)
  if (!t) return null
  const ref = t.kind === 'sketch' && Object.hasOwn(renamed, t.ref) ? renamed[t.ref] : t.ref
  const [module, key] = OPEN[t.kind]
  return `/?module=${module}&${key}=${encodeURIComponent(ref)}`
}
