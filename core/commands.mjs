// What `groundwork` does, by its first argument (groundwork.mjs loads this after the Node.js check):
//
//   groundwork [--root DIR] [--port N] [--no-open]   start the server for a project (start.mjs)
//   groundwork init [--root DIR] [--yes]             set the project up for Claude Code (init.mjs)
//   groundwork <module> ...                           a module's own command (its manifest's `cli`),
//                                                     e.g. `groundwork plan apply`, which its skill uses

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MODULES } from './modules.mjs'

const args = process.argv.slice(2)
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }
const mod = MODULES.find((m) => m.cli && m.id === args[0])

if (args[0] === 'init') {
  const { runInit } = await import('./init.mjs')
  const root = path.resolve(flag('--root', process.cwd()))
  process.exitCode = await runInit({ root, modules: MODULES, yes: args.includes('--yes') || args.includes('-y') })
} else if (mod) {
  process.argv.splice(2, 1)   // the module's command sees its own arguments only
  await import(pathToFileURL(mod.cli).href)
} else {
  await import('./start.mjs')
}
