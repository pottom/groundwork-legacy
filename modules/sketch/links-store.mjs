// The sketches' links, in one file beside them in git: docs/product/sketches/links.json.
//
//   { "links":   { "<sketch>": ["groundwork://idea/I-12", ...] },   what each sketch links to
//     "renamed": { "<old name>": "<its name now>" } }                so a link to an old name
//                                                                    (a ticket's **Sketch:** line,
//                                                                    a shape) still finds it
//
//   const links = openLinks(files)   files: the module's writer (core/files.mjs)
//   links.add(name, target)          target: groundwork://<kind>/<ref> (view/targets.mjs); once
//   links.remove(name, target)
//   links.renamed(from, to)          after a rename: its links move along, links to it follow, and
//                                    the old name (and every older one) leads to the new
//   links.created(name)              a new sketch takes its name back from an old one
//   links.index()                    what GET /api/sketch/links answers:
//                                    { sketches: { name: [target] },
//                                      linked: { idea|node|ticket|sketch: { ref: [sketch names] } },
//                                      renamed: { old: new } }
//
// Bad input throws SketchError (400). The file is written only when something changed.

import { SketchError, isSketchName, DIR, dict } from './sketch-store.mjs'
import { KINDS, target as makeTarget, parseTarget } from './view/targets.mjs'

export const LINKS_FILE = `${DIR}/links.json`

// Without a prototype, so a sketch named "constructor" or "toString" is only a key (sketch-store.mjs).
const empty = () => ({ links: dict(), renamed: dict() })
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b, 'en')))

export function openLinks(files) {
  function read() {
    if (!files.exists(LINKS_FILE)) return empty()
    try {
      const d = JSON.parse(files.read(LINKS_FILE))
      return { links: dict(d.links), renamed: dict(d.renamed) }
    } catch {
      return empty()
    }
  }
  function write(d) {
    for (const [k, v] of Object.entries(d.links)) if (!v.length) delete d.links[k]
    files.write(LINKS_FILE, JSON.stringify({ links: sorted(d.links), renamed: sorted(d.renamed) }, null, 2) + '\n')
  }
  const check = (name, target) => {
    if (!isSketchName(name)) throw new SketchError(`not a sketch name: ${JSON.stringify(name)}`)
    const t = parseTarget(target)
    if (!t) throw new SketchError(`not a link: ${JSON.stringify(target)}; expected groundwork://idea|node|ticket|sketch/<ref>`)
    return makeTarget(t.kind, t.ref)
  }

  return {
    add(name, target) {
      const t = check(name, target)
      const d = read()
      const list = Array.isArray(d.links[name]) ? d.links[name] : []
      if (list.includes(t)) return
      d.links[name] = [...list, t]
      write(d)
    },
    remove(name, target) {
      const t = check(name, target)
      const d = read()
      if (!d.links[name]?.includes(t)) return
      d.links[name] = d.links[name].filter((x) => x !== t)
      write(d)
    },
    renamed(from, to) {
      if (from === to || !isSketchName(from) || !isSketchName(to)) return
      const d = read()
      if (d.links[from]) { d.links[to] = d.links[from]; delete d.links[from] }
      const [was, now] = [makeTarget('sketch', from), makeTarget('sketch', to)]
      for (const [k, list] of Object.entries(d.links)) d.links[k] = [...new Set(list.map((x) => (x === was ? now : x)))]
      for (const [old, name] of Object.entries(d.renamed)) if (name === from) d.renamed[old] = to
      delete d.renamed[to]
      d.renamed[from] = to
      write(d)
    },
    created(name) {
      const d = read()
      if (!Object.hasOwn(d.renamed, name)) return
      delete d.renamed[name]
      write(d)
    },
    index() {
      const d = read()
      const linked = Object.fromEntries(KINDS.map((k) => [k, dict()]))
      for (const [name, list] of Object.entries(d.links)) {
        if (!Array.isArray(list)) continue
        for (const uri of list) {
          const t = parseTarget(uri)
          if (!t) continue
          const ref = t.kind === 'sketch' ? d.renamed[t.ref] ?? t.ref : t.ref
          ;(linked[t.kind][ref] ??= []).includes(name) || linked[t.kind][ref].push(name)
        }
      }
      return { sketches: d.links, linked, renamed: d.renamed }
    },
  }
}
