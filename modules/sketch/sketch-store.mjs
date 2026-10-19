// The sketches on disk: each one a standard .excalidraw file under docs/product/sketches/, the
// file excalidraw.com saves and opens (type "excalidraw", version 2, elements, appState, files).
//
//   const store = openSketches(files, root)   files: the module's writer (core/files.mjs);
//                                             root: the project, to list the sketches
//   store.list()                         the sketches' names, in name order
//   store.read(name)                     the scene, or an empty one when it is not drawn yet
//   store.save(name, scene)              merges it with the file on disk and writes the result, which
//                                        it returns; throws SketchError (status 400 or 413)
//   store.create(name)                   a new empty sketch; SketchError 409 when the name is taken
//   store.rename(from, to)               moves the file, and its <name>.threads.json (threads.mjs);
//                                        409 when `to` is taken; a sketch not drawn
//                                        yet (read() gives the empty scene) becomes an empty `to`
//   isSketchName(name)                   a plain name: letters, digits, "-" and "_"
//
// A save merges element by element with what is on disk (merge.mjs), so a save of the page and a
// write of `groundwork sketch apply` at the same time both survive; a deleted element stays in the
// file (isDeleted: true) for that. Embedded images are merged by id. A save keeps only what the
// drawing is: the elements, the embedded images, and the two settings of the canvas (background, grid). Zoom, scroll and selection are the viewer's, not the sketch's, and
// would only make noise in git. An embedded image may be at most MAX_IMAGE_BYTES (as its data URL).

import fs from 'node:fs'
import path from 'node:path'
import { isSketchName } from './view/sketches.mjs'   // one rule for a name, here and in the page
import { mergeElements } from './merge.mjs'

export const DIR = 'docs/product/sketches'
const EXT = '.excalidraw'
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const SOURCE = 'groundwork'

export class SketchError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export { isSketchName }

const fileOf = (name) => {
  if (!isSketchName(name)) throw new SketchError(`not a sketch name: ${JSON.stringify(name)}`)
  return `${DIR}/${name}${EXT}`
}

const threadsOf = (name) => `${DIR}/${name}.threads.json`

const emptyScene =() => ({ type: 'excalidraw', version: 2, source: SOURCE, elements: [], appState: { gridSize: null, viewBackgroundColor: '#ffffff' }, files: {} })

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// The scene as it is stored: the standard file, without the viewer's state.
function normalise(scene) {
  if (!isObject(scene) || scene.type !== 'excalidraw' || !Array.isArray(scene.elements) || !scene.elements.every(isObject)) {
    throw new SketchError('not an Excalidraw scene: expected { type: "excalidraw", elements: [...] }')
  }
  const files = isObject(scene.files) ? scene.files : {}
  for (const [id, f] of Object.entries(files)) {
    const size = typeof f?.dataURL === 'string' ? f.dataURL.length : 0
    if (size > MAX_IMAGE_BYTES) throw new SketchError(`the image ${id} is ${Math.ceil(size / 1024)} KB; an embedded image may be at most ${MAX_IMAGE_BYTES / 1024} KB`, 413)
  }
  const app = isObject(scene.appState) ? scene.appState : {}
  return {
    type: 'excalidraw',
    version: 2,
    source: SOURCE,
    elements: scene.elements,
    appState: { gridSize: app.gridSize ?? null, viewBackgroundColor: app.viewBackgroundColor ?? '#ffffff' },
    files,
  }
}

const json = (scene) => JSON.stringify(scene, null, 2) + '\n'

export function openSketches(files, root) {
  const taken = (name) => {
    if (files.exists(fileOf(name))) throw new SketchError(`a sketch named ${name} already exists`, 409)
  }
  return {
    list() {
      let entries = []
      try { entries = fs.readdirSync(path.join(root, DIR), { withFileTypes: true }) } catch {}
      return entries
        .filter((e) => e.isFile() && e.name.endsWith(EXT))
        .map((e) => e.name.slice(0, -EXT.length))
        .filter(isSketchName)
        .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    },
    create(name) {
      taken(name)
      files.write(fileOf(name), json(emptyScene()))
    },
    rename(from, to) {
      const [src, dest] = [fileOf(from), fileOf(to)]
      if (from === to) return
      // Only the case changes: on Windows and macOS that is the same file, so it is not taken, and
      // it must go before the new name is written (or writing it would overwrite the drawing).
      const caseOnly = from.toLowerCase() === to.toLowerCase()
      if (caseOnly ? this.list().includes(to) : files.exists(dest)) taken(to)
      const move = (src, dest, text) => {
        if (caseOnly && files.exists(src)) files.remove(src)
        files.write(dest, text)
        if (!caseOnly && files.exists(src)) files.remove(src)
      }
      move(src, dest, files.exists(src) ? files.read(src) : json(emptyScene()))
      // Its threads (threads.mjs) go along, so no comment is left behind on the old name.
      const [tsrc, tdest] = [threadsOf(from), threadsOf(to)]
      if (files.exists(tsrc)) move(tsrc, tdest, files.read(tsrc))
    },
    read(name) {
      const rel = fileOf(name)
      return files.exists(rel) ? JSON.parse(files.read(rel)) : emptyScene()
    },
    save(name, scene) {
      const rel = fileOf(name)
      const stored = normalise(scene)
      if (files.exists(rel)) {
        const disk = JSON.parse(files.read(rel))
        stored.elements = mergeElements(Array.isArray(disk.elements) ? disk.elements : [], stored.elements)
        stored.files = { ...(isObject(disk.files) ? disk.files : {}), ...stored.files }
      }
      files.write(rel, JSON.stringify(stored, null, 2) + '\n')
      return stored
    },
  }
}
