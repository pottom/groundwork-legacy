// What `groundwork` does (groundwork.mjs loads this after the Node.js check):
//
//   groundwork [--root DIR] [--port N] [--no-open]   start the server for a project (start.mjs)
//   groundwork init [--root DIR] [--yes]             set the project up for Claude Code (init.mjs);
//                                                     `init` may stand anywhere among the options
//   groundwork record list|show <id>                 the record store (records/cli.mjs), what Claude
//                                                     reads records with
//   groundwork <module> ...                           a module's own command (its manifest's `cli`),
//                                                     e.g. `groundwork plan apply`, which its skill uses;
//                                                     only as the first argument, the rest is the module's
//
// The project folder is --root, else MINDMAP_DIR, else the current folder, for the server and
// for init alike. A wrong argument stops it with exit code 2 and a message.

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MODULES } from './modules.mjs'

const VALUED = { '--root': 'a folder', '--port': 'a number' }
const SWITCHES = new Set(['--no-open', '--yes', '-y'])

// The arguments of the server and of init: { command: 'start' | 'init', root, port, open, yes }.
function parse(args) {
  const opts = { command: 'start', open: true, yes: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (VALUED[a]) {
      const v = args[++i]
      if (v === undefined || v.startsWith('-')) throw new Error(`${a} needs ${VALUED[a]}`)
      opts[a.slice(2)] = v
    } else if (SWITCHES.has(a)) {
      if (a === '--no-open') opts.open = false
      else opts.yes = true
    } else if (a === 'init' && opts.command === 'start') opts.command = 'init'
    else throw new Error(`unknown argument: ${a} (see the top of core/groundwork.mjs)`)
  }
  opts.root = path.resolve(opts.root ?? (process.env.MINDMAP_DIR || process.cwd()))
  opts.port = Number(opts.port ?? (process.env.PORT || 4477))
  if (!Number.isInteger(opts.port) || opts.port < 0) throw new Error('--port needs a number')
  return opts
}

const args = process.argv.slice(2)
const mod = MODULES.find((m) => m.cli && m.id === args[0])

if (args[0] === 'record') {
  process.argv.splice(2, 1)   // the store's command sees its own arguments only
  await import('./records/cli.mjs')
} else if (mod) {
  process.argv.splice(2, 1)   // the module's command sees its own arguments only
  await import(pathToFileURL(mod.cli).href)
} else {
  let opts
  try { opts = parse(args) } catch (e) {
    console.error(`groundwork: ${e.message}`)
    process.exitCode = 2
  }
  if (opts?.command === 'init') {
    const { runInit } = await import('./init.mjs')
    process.exitCode = await runInit({ root: opts.root, modules: MODULES, yes: opts.yes })
  } else if (opts) {
    const { start } = await import('./start.mjs')
    await start(opts)
  }
}
