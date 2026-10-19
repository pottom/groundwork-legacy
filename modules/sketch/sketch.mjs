// `groundwork sketch <command>`: the Sketch module's command line (the core runs this file), how
// Claude reads and draws on a sketch (d-board-cli).
//
//   groundwork sketch show <name>           the sketch as text: ids, kinds, labels, places, arrows (digest.mjs)
//   groundwork sketch apply <name> [ops]    draws: a JSON array of ops (ops.mjs), as an argument or on stdin
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

const USAGE = 'usage: groundwork sketch show <name>\n' +
  '       groundwork sketch apply <name> \'[{"op":"add","type":"rectangle","x":0,"y":0,"label":"API"}, ...]\'   (or the ops on stdin)'

function run(args) {
  const words = []
  let root
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') {
      root = args[++i]
      if (root === undefined) throw new Error('--root needs a folder')
    } else if (args[i].startsWith('--')) throw new Error(`unknown option: ${args[i]}`)
    else words.push(args[i])
  }
  const [cmd, name = 'main', ops] = words
  const dir = path.resolve(root ?? (process.env.MINDMAP_DIR || process.cwd()))
  const store = openSketches(moduleFiles(dir, sketchModule))
  if (cmd === 'show') {
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
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork sketch: ${e.message}\n${USAGE}`)
  process.exitCode = 1
}
