// The project's name, resolved once, for the shell's header and the modules: the first heading
// of README.md, else the "name" of package.json (without an npm scope), else the folder's name.
//
//   projectName(root)   'Groundwork'

import fs from 'node:fs'
import path from 'node:path'

const read = (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return null } }

// The text of a Markdown heading, without its markup: images dropped, links and code kept as text.
const plain = (md) => md
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[`*_~]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

function readmeHeading(root) {
  const text = read(path.join(root, 'README.md'))
  if (!text) return null
  let fenced = false
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue }
    const m = !fenced && /^#\s+(.+?)\s*#*\s*$/.exec(line)
    if (m) return plain(m[1]) || null
  }
  return null
}

function packageName(root) {
  try {
    const name = JSON.parse(read(path.join(root, 'package.json')) ?? 'null')?.name
    return typeof name === 'string' && name.trim() ? name.trim().replace(/^@[^/]+\//, '') : null
  } catch { return null }
}

export function projectName(root) {
  const dir = path.resolve(root)
  return readmeHeading(dir) ?? packageName(dir) ?? path.basename(dir)
}
