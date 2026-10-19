// File access the core hands to a module. A module gets no general file system access:
// it reads and writes the project only through this object, and can write only under
// the folders its manifest names (`writes`). A forbidden write is never made: the path
// is checked before anything touches the disk.
//
//   const files = moduleFiles(root, manifest)   // what the core passes as api({ root, files })
//   files.exists(rel)  files.read(rel)           anywhere inside the project
//   files.write(rel, text)                       atomic, creates missing folders
//   files.append(rel, text)  files.remove(rel)
//
// Paths are relative to the project. A write fails when its path is absolute, leaves its
// folder with `..`, or reaches outside through a symlink or junction. The folders
// themselves must lie under docs/product/ or .groundwork/: nothing else is writable.

import fs from 'node:fs'
import path from 'node:path'

export const WRITABLE = ['docs/product', '.groundwork']

// `p` is `base` or inside it (both absolute, same form).
const within = (base, p) => {
  const r = path.relative(base, p)
  return r === '' || (r !== '..' && !r.startsWith('..' + path.sep) && !path.isAbsolute(r))
}
const inside = (base, p) => p !== base && within(base, p)

export function projectFiles(root, writes = []) {
  return open(root, writes).files
}

function open(root, writes) {
  root = path.resolve(root)
  const folders = writes.map((f) => {
    const abs = typeof f === 'string' && !path.isAbsolute(f) && path.resolve(root, f)
    if (!abs || !WRITABLE.some((w) => within(path.join(root, w), abs))) {
      throw new Error(`a module may not write to ${f}: writes are limited to docs/product/ and .groundwork/`)
    }
    return path.relative(root, abs)
  })
  let realRoot // resolved on the first write, so a writer can exist before its project does
  const deny = (rel) => new Error(`may not write ${rel}: allowed are ${folders.map((f) => f.replaceAll('\\', '/') + '/').join(', ') || 'no folders'}`)

  // The absolute path to write `rel` to, or an error. `self` also allows the folder itself.
  function target(rel, self = false) {
    if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) throw deny(rel)
    const abs = path.resolve(root, rel)
    const folder = folders.find((f) => (self ? within : inside)(path.join(root, f), abs))
    if (folder === undefined) throw deny(rel)
    // Follow links: resolve the deepest part that exists, then check the real path again.
    realRoot ??= fs.realpathSync.native(root)
    const rest = []
    let cur = abs
    for (;;) {
      let exists = true
      try { fs.lstatSync(cur) } catch { exists = false }
      if (exists) {
        let real
        try { real = fs.realpathSync.native(cur) } catch { throw deny(rel) } // a dangling link
        if (!within(path.join(realRoot, folder), path.join(real, ...rest))) throw deny(rel)
        return abs
      }
      rest.unshift(path.basename(cur))
      cur = path.dirname(cur)
    }
  }

  function readable(rel) {
    const abs = path.resolve(root, rel)
    if (!within(root, abs)) throw new Error(`may not read ${rel}: it is outside the project`)
    return abs
  }

  let tmpCount = 0
  const files = {
    exists: (rel) => fs.existsSync(readable(rel)),
    read: (rel) => fs.readFileSync(readable(rel), 'utf8'),
    write(rel, text) {
      const abs = target(rel)
      const tmp = target(`${rel}.${process.pid}.${++tmpCount}.tmp`) // unique: two writes of one file never share it
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(tmp, text)
      fs.renameSync(tmp, abs)
    },
    append(rel, text) {
      const abs = target(rel)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.appendFileSync(abs, text)
    },
    remove: (rel) => fs.unlinkSync(target(rel)),
  }
  return { files, target }
}

// The writer for one module, after moving its state out of any older folders the
// manifest lists (`moves: { '.old': '.groundwork/<id>' }`).
//
// The move is the only file operation outside a module's folders, so it is done here in
// the core rather than by the module, and kept narrow: the source must be a real folder
// (not a link) at the top of the project, and the destination one the module may write.
// When the destination exists too, the old folder is merged in without overwriting newer
// state: logs (.jsonl) are appended, other files are copied only where missing.
export function moduleFiles(root, manifest) {
  const { files, target } = open(root, manifest.writes || [])
  for (const [from, to] of Object.entries(manifest.moves || {})) {
    if (!/^[^/\\]+$/.test(from) || from === '.' || from === '..') throw new Error(`${from}: a move starts from a top-level folder of the project`)
    const dest = target(to, true)
    const src = path.join(path.resolve(root), from)
    let st
    try { st = fs.lstatSync(src) } catch { continue }
    if (!st.isDirectory()) continue
    if (fs.existsSync(dest)) mergeInto(src, dest)
    else {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      try {
        fs.renameSync(src, dest)
      } catch { // e.g. a file in it is open on Windows: copy, then drop the old folder
        fs.cpSync(src, dest, { recursive: true })
      }
    }
    fs.rmSync(src, { recursive: true, force: true })
  }
  return files
}

function mergeInto(src, dest) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, e.name), to = path.join(dest, e.name)
    if (e.isDirectory()) { fs.mkdirSync(to, { recursive: true }); mergeInto(from, to) }
    else if (!e.isFile()) continue // links are not followed
    else if (!fs.existsSync(to)) fs.copyFileSync(from, to)
    else if (e.name.endsWith('.jsonl')) fs.appendFileSync(to, fs.readFileSync(from))
  }
}
