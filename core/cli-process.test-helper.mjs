// Commands as processes, for the tests (not in the npm package: *.test*.mjs).
//
//   const gw = await startCommand(process.execPath, ['core/groundwork.mjs', '--port', '0', '--no-open'], { cwd })
//   gw.url      'http://localhost:<port>/'
//   gw.output   what it printed so far
//   await gw.stop()   stops the whole process tree, so nothing keeps listening after a test
//
//   const r = await runCommand(process.execPath, [BIN, 'init'], { cwd, input: 'y\n' })
//   r.code, r.stdout, r.stderr   (still running after timeoutMs, 10 s by default, it is killed)
//
//   npm(args, opts), npx(args, opts)   runCommand for npm and npx (npm.cmd and npx.cmd on Windows,
//   startNpx(args, opts)               which run only through a shell); startNpx is startCommand's

import { spawn, execFileSync } from 'node:child_process'

const WIN = process.platform === 'win32'

export function startCommand(cmd, args, { timeoutMs = 20000, ...opts } = {}) {
  const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  const stop = () => new Promise((resolve) => {
    if (p.exitCode !== null || p.signalCode !== null) return resolve()
    p.once('exit', () => resolve())
    // With a shell between (npx on Windows), killing the shell would leave the server running.
    if (WIN) {
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

// Asynchronous on purpose: a test may serve something (a registry) from its own process meanwhile.
export function runCommand(cmd, args, { input = '', timeoutMs = 10000, ...opts } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { ...opts, stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => (WIN ? execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' }) : p.kill()), timeoutMs)
    let stdout = '', stderr = ''
    p.stdout.on('data', (c) => (stdout += c))
    p.stderr.on('data', (c) => (stderr += c))
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: null, stdout, stderr: stderr + e.message }) })
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
    p.stdin.on('error', () => {})   // it may exit before reading its input
    p.stdin.end(input)
  })
}

// Through a shell on Windows, so an argument with a space is quoted there.
const viaShell = (run, bin) => (args, opts = {}) => WIN
  ? run([`${bin}.cmd`, ...args.map((a) => (/[\s&|<>^]/.test(a) ? `"${a}"` : a))].join(' '), [], { ...opts, shell: true })
  : run(bin, args, opts)
export const npm = viaShell(runCommand, 'npm')
export const npx = viaShell(runCommand, 'npx')
export const startNpx = viaShell(startCommand, 'npx')
