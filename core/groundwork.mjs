#!/usr/bin/env node
// The command: `npx groundwork` (this file is the package's bin), or `node core/groundwork.mjs`.
// It checks the Node.js version, then runs the command (commands.mjs): by default it starts the
// core server (start.mjs) for a project.
//
//   groundwork [--root DIR] [--port N] [--no-open]
//   groundwork init [--root DIR] [--yes]   set the project up for Claude Code (init.mjs)
//   groundwork plan <command>              the Plan module's command (modules/plan/plan.mjs)
//
//   --root DIR  the project folder (default: the current folder; also MINDMAP_DIR)
//   --port N    the port (default 4477; also PORT; 0 picks a free one)
//   --no-open   do not open the start page in the browser (it opens by default)
//
// Needs Node.js 20 or newer and nothing else: only Node's built-in modules. This file is
// written so that an older Node can still run it far enough to say so (no newer syntax here;
// the rest is loaded only after the check).

var MIN_NODE = 20
var major = Number(String(process.versions.node).split('.')[0])

if (!(major >= MIN_NODE)) {
  console.error('groundwork: needs Node.js ' + MIN_NODE + ' or newer; this is Node.js ' + process.versions.node + '.')
  console.error('Install a newer Node.js from https://nodejs.org/ and run it again.')
  process.exitCode = 1
} else {
  import('./commands.mjs')
}
