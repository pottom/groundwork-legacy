// `groundwork init`: puts what Claude Code needs into a project, from the module manifests
// (modules/README.md, `claude`):
//   - each module's skills, copied to .claude/skills/<skill>/;
//   - each module's hooks, added to .claude/settings.json (everything else in it is kept);
//   - the .groundwork/ folder (the modules' local state), added to .gitignore.
// It first lists what it will change and asks; it writes only after a yes. Run again, it changes
// only what is missing or out of date, so nothing is ever added twice.
//
//   groundwork init [--root DIR] [--yes]
//
//   --root DIR  the project folder (default: the current folder)
//   --yes, -y   apply without asking (for scripts; without it, no answer means no)
//
//   const plan = planInit({ root, modules })   plan.changes: [{ file, action, detail }]
//   plan.write()                                 makes them

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const SETTINGS = '.claude/settings.json'
const GITIGNORE = '.gitignore'
const IGNORED = new Set(['.groundwork', '.groundwork/', '/.groundwork', '/.groundwork/'])

// The files of a folder, relative to it and "/"-separated, sorted.
function filesOf(dir, sub = '') {
  return fs.readdirSync(path.join(dir, sub), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesOf(dir, path.posix.join(sub, e.name)) : [path.posix.join(sub, e.name)]))
    .sort()
}

const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file) : null)

function skillChanges(root, modules) {
  const out = []
  for (const m of modules) {
    for (const src of m.claude?.skills ?? []) {
      const rel = `.claude/skills/${path.basename(src)}`
      const dest = path.join(root, rel)
      const files = filesOf(src)
      const stale = files.filter((f) => !readIf(path.join(dest, f))?.equals(fs.readFileSync(path.join(src, f))))
      if (!stale.length) continue
      out.push({
        file: rel + '/',
        action: fs.existsSync(dest) ? 'update' : 'create',
        detail: `the ${m.name} module's skill: ${stale.join(', ')}`,
        write: () => {
          for (const f of stale) {
            fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true })
            fs.copyFileSync(path.join(src, f), path.join(dest, f))
          }
        },
      })
    }
  }
  return out
}

function settingsChange(root, modules) {
  const file = path.join(root, SETTINGS)
  const text = readIf(file)?.toString('utf8')
  let settings
  try { settings = text?.trim() ? JSON.parse(text) : {} } catch (e) { throw new Error(`${SETTINGS} is not valid JSON (${e.message}); fix it and run init again`) }
  const has = (event, command) => (settings.hooks?.[event] ?? []).some((g) => (g.hooks ?? []).some((h) => h.command === command))
  const missing = modules.flatMap((m) => (m.claude?.hooks ?? []).map((h) => ({ ...h, module: m.name }))).filter((h) => !has(h.event, h.command))
  if (!missing.length) return []
  return [{
    file: SETTINGS,
    action: text == null ? 'create' : 'update',
    detail: missing.map((h) => `add the ${h.module} module's ${h.event} hook: ${h.command}`).join('; '),
    write: () => {
      settings.hooks ??= {}
      for (const h of missing) (settings.hooks[h.event] ??= []).push({ hooks: [{ type: 'command', command: h.command }] })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n')
    },
  }]
}

function gitignoreChange(root) {
  const file = path.join(root, GITIGNORE)
  const text = readIf(file)?.toString('utf8')
  if (text != null && text.split(/\r?\n/).some((l) => IGNORED.has(l.trim()))) return []
  return [{
    file: GITIGNORE,
    action: text == null ? 'create' : 'update',
    detail: 'add .groundwork/, the modules\' local state',
    write: () => {
      const sep = text && !text.endsWith('\n') ? '\n' : ''
      fs.writeFileSync(file, (text ?? '') + sep + '# local state of the Groundwork modules\n.groundwork/\n')
    },
  }]
}

export function planInit({ root, modules }) {
  // Settings first: when they cannot be read, nothing is planned (and so nothing written).
  const settings = settingsChange(root, modules)
  const changes = [...skillChanges(root, modules), ...settings, ...gitignoreChange(root)]
  return {
    changes: changes.map(({ file, action, detail }) => ({ file, action, detail })),
    write: () => { for (const c of changes) c.write() },
  }
}

// Asks a yes/no question on input; no answer (input closed) is no.
function ask(question, input, output) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output, terminal: false })
    let answered = false
    output.write(question)
    rl.once('line', (line) => { answered = true; rl.close(); resolve(/^\s*y(es)?\s*$/i.test(line)) })
    rl.once('close', () => { if (!answered) { output.write('\n'); resolve(false) } })
  })
}

// The command: 0 when the project is set up (or already was), 1 when nothing was written.
export async function runInit({ root, modules, yes = false, input = process.stdin, output = process.stdout }) {
  let plan
  try { plan = planInit({ root, modules }) } catch (e) { console.error(`groundwork init: ${e.message}`); return 1 }
  if (!plan.changes.length) {
    output.write(`groundwork init: ${root} is already set up; nothing to change.\n`)
    return 0
  }
  output.write(`groundwork init will change these files in ${root}:\n`)
  for (const c of plan.changes) output.write(`  ${c.action.padEnd(6)}  ${c.file}  (${c.detail})\n`)
  if (!yes && !(await ask('Apply these changes? [y/N] ', input, output))) {
    output.write('Nothing was changed.\n')
    return 1
  }
  plan.write()
  output.write('Done. Restart Claude Code in this project so it loads the skills and the hook.\n')
  return 0
}
