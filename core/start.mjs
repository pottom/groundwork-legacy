// Starts the Groundwork core server for a project, with every module behind it, and opens the
// start page in the browser. Run through groundwork.mjs and commands.mjs, which check the
// Node.js version and read the options (listed in groundwork.mjs).
//
//   await start({ root, port, open })

import { spawn } from 'node:child_process'
import { startServer } from './server.mjs'
import { MODULES } from './modules.mjs'
import { VERSION } from './version.mjs'

export async function start({ root, port, open = true }) {
  try {
    const { url } = await startServer({ root, modules: MODULES, port })
    console.log(`groundwork ${VERSION}: ${url}  (project: ${root})`)
    for (const m of MODULES) if (m.view) console.log(`  ${m.name}: ${url}${m.id}/`)
    console.log('Stop it with Ctrl+C.')
    if (open) openBrowser(url)
  } catch (e) {
    console.error(e.code === 'EADDRINUSE' ? `groundwork: port ${port} is in use (try --port N)` : `groundwork: ${e.message}`)
    process.exit(1)
  }
}

// The system's way to open a URL in the default browser. Without one (a server with no desktop),
// the server keeps running and the address above is all there is.
function openBrowser(url) {
  const [cmd, rest, opts] = process.platform === 'win32'
    // `start` is built into cmd; its first quoted argument is a window title, hence the "".
    ? ['cmd', ['/d', '/s', '/c', `start "" "${url}"`], { windowsVerbatimArguments: true }]
    : process.platform === 'darwin' ? ['open', [url], {}] : ['xdg-open', [url], {}]
  const child = spawn(cmd, rest, { ...opts, stdio: 'ignore', detached: true })
  child.on('error', () => console.log(`(could not open a browser: open ${url} yourself)`))
  child.unref()
}
