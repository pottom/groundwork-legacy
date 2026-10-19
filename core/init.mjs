// `groundwork init`: puts what Claude Code needs into a project, from the module manifests
// (modules/README.md, `claude`):
//   - each module's skills, copied to .claude/skills/<skill>/, which then mirrors the packaged
//     folder (a file the skill no longer has is removed); in their Markdown files {{groundwork}}
//     becomes the command that runs this version of Groundwork (RUNNER, core/version.mjs);
//   - each module's hooks, `<RUNNER> <run>`, in .claude/settings.json (everything else in it is
//     kept); a hook for the same command in another form (an older version, the unscoped
//     `npx groundwork`, `node .../modules/plan/plan.mjs hook` in a checkout) is replaced, not
//     added beside it;
//   - the .groundwork/ folder (the modules' local state), added to .gitignore.
// It first lists what it will change and asks; it writes only after a yes. Run again, it changes
// only what is missing or out of date, so nothing is ever added twice.
//
//   groundwork init [--root DIR] [--yes]
//
//   --root DIR  the project folder (default: MINDMAP_DIR, else the current folder)
//   --yes, -y   apply without asking (for scripts; without it, no answer means no)
//
//   const plan = planInit({ root, modules })   plan.changes: [{ file, action, detail }]
//   plan.write()                                 makes them

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { RUNNER } from './version.mjs'

const SETTINGS = '.claude/settings.json'
const GITIGNORE = '.gitignore'
const ignoredLines = new Set(['.groundwork', '.groundwork/', '/.groundwork', '/.groundwork/'])

// The files of a folder, relative to it and "/"-separated, sorted.
function filesOf(dir, sub = '') {
  return fs.readdirSync(path.join(dir, sub), { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesOf(dir, path.posix.join(sub, e.name)) : [path.posix.join(sub, e.name)]))
    .sort()
}

const readIf = (file) => (fs.existsSync(file) ? fs.readFileSync(file) : null)

// A skill file as it is installed: Markdown with {{groundwork}} filled in, anything else as is.
const installed = (file) => (file.endsWith('.md')
  ? Buffer.from(fs.readFileSync(file, 'utf8').replaceAll('{{groundwork}}', RUNNER))
  : fs.readFileSync(file))

// Removes the folders under dir that are left empty (not dir itself).
function pruneEmpty(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const sub = path.join(dir, e.name)
    pruneEmpty(sub)
    if (!fs.readdirSync(sub).length) fs.rmdirSync(sub)
  }
}

function skillChanges(root, modules) {
  const out = []
  for (const m of modules) {
    for (const src of m.claude?.skills ?? []) {
      const rel = `.claude/skills/${path.basename(src)}`
      const dest = path.join(root, rel)
      const files = filesOf(src)
      const stale = files.filter((f) => !readIf(path.join(dest, f))?.equals(installed(path.join(src, f))))
      const dropped = fs.existsSync(dest) ? filesOf(dest).filter((f) => !files.includes(f)) : []
      if (!stale.length && !dropped.length) continue
      const what = [stale.join(', '), dropped.length ? `remove ${dropped.join(', ')}` : ''].filter(Boolean).join('; ')
      out.push({
        file: rel + '/',
        action: fs.existsSync(dest) ? 'update' : 'create',
        detail: `the ${m.name} module's skill: ${what}`,
        write: () => {
          for (const f of stale) {
            fs.mkdirSync(path.dirname(path.join(dest, f)), { recursive: true })
            fs.writeFileSync(path.join(dest, f), installed(path.join(src, f)))
          }
          for (const f of dropped) fs.rmSync(path.join(dest, f))
          pruneEmpty(dest)
        },
      })
    }
  }
  return out
}

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Whether a hook command runs `groundwork <run>` in some form: through npx (any version, scoped
// or not), the bin, or in a checkout the module's own script (`node .../modules/plan/plan.mjs hook`).
function sameHook(run) {
  const [id, ...rest] = run.trim().split(/\s+/).map(escapeRe)
  const tail = rest.map((w) => String.raw`\s+` + w).join('')
  const runner = String.raw`groundwork(?:@[^\s"']*)?(?:\.mjs)?["']?\s+${id}`
  const script = String.raw`[\\/]modules[\\/]${id}[\\/][^\s"']+\.mjs["']?`
  const re = new RegExp(`(?:${runner}|${script})${tail}\\s*$`)
  return (command) => typeof command === 'string' && re.test(command)
}

function settingsChange(root, modules) {
  const file = path.join(root, SETTINGS)
  const text = readIf(file)?.toString('utf8')
  let settings
  try { settings = text?.trim() ? JSON.parse(text) : {} } catch (e) { throw new Error(`${SETTINGS} is not valid JSON (${e.message}); fix it and run init again`) }
  const edits = []
  for (const m of modules) {
    for (const { event, run } of m.claude?.hooks ?? []) {
      const command = `${RUNNER} ${run}`
      const same = sameHook(run)
      const found = (settings.hooks?.[event] ?? []).flatMap((g) => (g.hooks ?? []).filter((h) => same(h.command)))
      if (found.length === 1 && found[0].command === command) continue
      edits.push({
        event, command, found,
        detail: found.length
          ? `replace the ${m.name} module's ${event} hook (${found.map((h) => h.command).join(', ')}) with: ${command}`
          : `add the ${m.name} module's ${event} hook: ${command}`,
      })
    }
  }
  if (!edits.length) return []
  return [{
    file: SETTINGS,
    action: text == null ? 'create' : 'update',
    detail: edits.map((e) => e.detail).join('; '),
    write: () => {
      settings.hooks ??= {}
      for (const { event, command, found } of edits) {
        if (!found.length) { (settings.hooks[event] ??= []).push({ hooks: [{ type: 'command', command }] }); continue }
        // The first becomes this hook, in its place; the others go, and so does a group left empty.
        found[0].command = command
        const extra = new Set(found.slice(1))
        settings.hooks[event] = settings.hooks[event]
          .map((g) => (g.hooks ? { ...g, hooks: g.hooks.filter((h) => !extra.has(h)) } : g))
          .filter((g) => !g.hooks || g.hooks.length)
      }
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n')
    },
  }]
}

function gitignoreChange(root) {
  const file = path.join(root, GITIGNORE)
  const text = readIf(file)?.toString('utf8')
  if (text != null && text.split(/\r?\n/).some((l) => ignoredLines.has(l.trim()))) return []
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
export async function runInit({ root, modules, yes = false, input = process.stdin, output = process.stdout, errors = process.stderr }) {
  let plan
  try { plan = planInit({ root, modules }) } catch (e) { errors.write(`groundwork init: ${e.message}\n`); return 1 }
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
