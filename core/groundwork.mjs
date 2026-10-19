#!/usr/bin/env node
// Starts the Groundwork core server for a project, with every module behind it.
//
//   node core/groundwork.mjs [--root DIR] [--port N] [--open]
//
//   --root DIR  the project folder (default: the current folder; also MINDMAP_DIR)
//   --port N    the port (default 4477; also PORT)
//   --open      open the start page in the browser
//
// Needs Node.js 20 or newer and nothing else: only Node's built-in modules.

import path from 'node:path'
import { spawn } from 'node:child_process'
import { startServer } from './server.mjs'
import { MODULES } from './modules.mjs'

const args = process.argv.slice(2)
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def }

const root = path.resolve(flag('--root', process.env.MINDMAP_DIR || process.cwd()))
const port = Number(flag('--port', process.env.PORT || 4477))

try {
  const { url } = await startServer({ root, modules: MODULES, port })
  console.log(`groundwork: ${url}  (project: ${root})`)
  for (const m of MODULES) console.log(`  ${m.name}: ${url}${m.id}/`)
  if (args.includes('--open')) openBrowser(url)
} catch (e) {
  console.error(e.code === 'EADDRINUSE' ? `groundwork: port ${port} is in use (try --port N)` : `groundwork: ${e.message}`)
  process.exit(1)
}

function openBrowser(url) {
  const [cmd, ...rest] = process.platform === 'win32' ? ['cmd', '/c', 'start', '""', url]
    : process.platform === 'darwin' ? ['open', url] : ['xdg-open', url]
  spawn(cmd, rest, { stdio: 'ignore', detached: true }).unref()
}
