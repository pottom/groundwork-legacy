// A running `groundwork` command, for the tests: starts it, waits until it prints its address,
// and stops it again (the whole process tree, so nothing keeps listening after a test).
//
//   const gw = await startCommand(process.execPath, ['core/groundwork.mjs', '--port', '0', '--no-open'], { cwd })
//   gw.url      'http://localhost:<port>/'
//   gw.output   what it printed so far
//   await gw.stop()

import { spawn, execFileSync } from 'node:child_process'

export function startCommand(cmd, args, { timeoutMs = 20000, ...opts } = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const stop = () => new Promise((resolve) => {
    if (p.exitCode !== null || p.signalCode !== null) return resolve()
    p.once('exit', () => resolve())
    // With a shell between (npx on Windows), killing the shell would leave the server running.
    if (process.platform === 'win32') {
      try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { p.kill() }
    } else p.kill()
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error(`no address within ${timeoutMs} ms:\n${output}`)) }, timeoutMs)
    const read = (c) => {
      output += c
      const m = /http:\/\/localhost:\d+\//.exec(output)
      if (m) { clearTimeout(timer); resolve({ url: m[0], get output() { return output }, stop }) }
    }
    p.stdout.on('data', read)
    p.stderr.on('data', (c) => (output += c))
    p.on('error', (e) => { clearTimeout(timer); reject(e) })
    p.on('exit', (code) => { clearTimeout(timer); reject(new Error(`exited with ${code} before listening:\n${output}`)) })
  })
}
