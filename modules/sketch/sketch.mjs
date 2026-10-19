// `groundwork sketch <command>`: the Sketch module's command line (the core runs this file), how
// Claude reads and draws on a sketch (d-board-cli).
//
//   groundwork sketch list                  the sketches' names, one per line
//   groundwork sketch show <name>          the sketch as text: ids, kinds, labels, places, arrows (digest.mjs)
//   groundwork sketch apply <name> [ops]    draws: a JSON array of ops (ops.mjs), as an argument or on stdin
//   groundwork sketch threads <name>        the threads pinned to its shapes, with their comments (threads.mjs)
//   groundwork sketch comment <name> <id> [text] [--author <who>]
//                                           a comment on the shape's thread, starting it; the text as an
//                                           argument or on stdin; the author is Claude unless --author says
//   groundwork sketch close <name> <id>     closes the thread when it is resolved; reopen opens it again
//
// <name> is the sketch's file name, docs/product/sketches/<name>.excalidraw ("main" by default).
// The project folder is --root, else MINDMAP_DIR, else the current folder. An apply merges with the
// file as it is at the moment of writing (sketch-store.mjs), so what the page saved meanwhile stays;
// the open page shows the drawing at once (the server's watch). A wrong call or op prints a message,
// writes nothing and exits with 1.

import fs from 'node:fs'
import path from 'node:path'
import { moduleFiles } from '../../core/files.mjs'
import sketchModule from './module.mjs'
import { openSketches } from './sketch-store.mjs'
import { applyOps } from './ops.mjs'
import { digest } from './digest.mjs'
import { openThreads, threadsText } from './threads.mjs'

const USAGE = 'usage: groundwork sketch list\n' +
  '       groundwork sketch show <name>\n' +
  '       groundwork sketch apply <name> \'[{"op":"add","type":"rectangle","x":0,"y":0,"label":"API"}, ...]\'   (or the ops on stdin)\n' +
  '       groundwork sketch threads <name>\n' +
  '       groundwork sketch comment <name> <id> "<text>" [--author <who>]   (or the text on stdin)\n' +
  '       groundwork sketch close | reopen <name> <id>'

function run(args) {
  const words = []
  let root
  let author = 'Claude'
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      root = args[++i]
      if (root === undefined) throw new Error('--root needs a folder')
    } else if (args[i] === '--author') {
      author = args[++i]
      if (!author) throw new Error('--author needs a name')
    } else if (args[i].startsWith('--')) throw new Error(`unknown option: ${args[i]}`)
    else words.push(args[i])
  }
  const [cmd, name = 'main', ops] = words
  const dir = path.resolve(root ?? (process.env.MINDMAP_DIR || process.cwd()))
  const files = moduleFiles(dir, sketchModule)
  const store = openSketches(files, dir)
  const threads = () => openThreads(files, store)
  if (cmd === 'list') {
    if (words.length > 1) throw new Error('list takes no name')
    const names = store.list()
    console.log(names.length ? names.join('\n') : 'No sketches yet.')
  } else if (cmd === 'show') {
    if (words.length > 2) throw new Error('show takes one name')
    console.log(digest(name, store.read(name)))
  } else if (cmd === 'apply') {
    if (words.length > 3) throw new Error('apply takes a name and the ops, in quotes')
    const text = (ops ?? fs.readFileSync(0, 'utf8')).replace(/^﻿/, '')
    let parsed
    try { parsed = JSON.parse(text) } catch (e) { throw new Error(`the ops are not JSON (${e.message}): expected an array of ops`) }
    if (!Array.isArray(parsed)) parsed = [parsed]
    const scene = store.read(name)
    const elements = applyOps(scene.elements, parsed)
    store.save(name, { ...scene, elements })
    console.log(digest(name, store.read(name)))
  } else if (cmd === 'threads') {
    if (words.length > 2) throw new Error('threads takes one name')
    console.log(threadsText(name, threads().list(name), store.read(name)))
  } else if (cmd === 'comment') {
    const [, , id, text] = words
    if (!id) throw new Error('comment needs the sketch\'s name and the shape\'s id')
    if (words.length > 4) throw new Error('comment takes a name, an id and the text, in quotes')
    threads().comment(name, id, { text: text ?? fs.readFileSync(0, 'utf8').replace(/^﻿/, ''), author })
    console.log(threadsText(name, threads().list(name).filter((t) => t.element === id), store.read(name)))
  } else if (cmd === 'close' || cmd === 'reopen') {
    const [, , id] = words
    if (!id || words.length > 3) throw new Error(`${cmd} takes the sketch's name and the shape's id`)
    threads().close(name, id, cmd === 'close')
    console.log(`The thread on ${id} is ${cmd === 'close' ? 'closed' : 'open again'}.`)
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork sketch: ${e.message}\n${USAGE}`)
  process.exitCode = 1
}
