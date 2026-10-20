// @ts-check
// `groundwork record <command>`: the record store from the command line, what Claude uses (the
// core runs this file for `groundwork record ...`).
//
//   groundwork record list [--type I]     every record (of one type), one per line: id, state, title
//   groundwork record show I-5            one record: id and file, its fields, its body, its history,
//                                         and the records that refer to it (computed, not in the file)
//
// The project folder is --root, else MINDMAP_DIR, else the current folder. The record types are the
// ones the modules declare (core/modules.mjs). Read only: records change through their module's
// command (`groundwork ideas move`). A wrong call prints a message and exits with 1.

import path from 'node:path'
import { MODULES } from '../modules.mjs'
import { openRecords } from './store.mjs'

const USAGE = 'usage: groundwork record list [--type <prefix>]\n       groundwork record show <id>'
const VALUED = ['--type', '--root']

/** @param {string[]} args */
function parse(args) {
  /** @type {string[]} */
  const words = []
  /** @type {Record<string, string>} */
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (VALUED.includes(a)) {
      if (i + 1 >= args.length) throw new Error(`${a} needs a value`)
      opts[a.slice(2)] = args[++i]
    } else if (a.startsWith('--')) throw new Error(`unknown option: ${a}`)
    else words.push(a)
  }
  return { words, opts }
}

/** @param {string[]} argv */
function run([cmd, ...rest]) {
  const { words, opts } = parse(rest)
  const root = path.resolve(opts.root ?? (process.env.MINDMAP_DIR || process.cwd()))
  const store = openRecords(root, MODULES)
  const stateOf = (/** @type {import('./types.mjs').StoredRecord} */ r) => {
    const t = store.types().find((x) => x.prefix === r.type)
    return String((t && r.fields[t.lifecycle.field]) ?? '')
  }
  if (cmd === 'list') {
    if (words.length) throw new Error(`list takes no words: ${words.join(' ')}`)
    for (const r of store.list(opts.type)) {
      if (opts.type && r.type !== opts.type) continue
      console.log(`${r.id.padEnd(6)} ${stateOf(r).padEnd(11)} ${r.fields.title ?? ''}`.trimEnd())
    }
  } else if (cmd === 'show') {
    if (words.length !== 1) throw new Error('show needs one id: show I-5')
    const r = store.show(words[0])
    if (!r) throw new Error(`no record ${words[0]}`)
    const out = [`${r.id} ${r.file}`]
    for (const [k, v] of Object.entries(r.fields)) out.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    if (r.body) out.push('', r.body)
    if (r.history.length) out.push('', 'History:', ...r.history.map((h) => `  ${h}`))
    out.push('', `Linked from: ${r.linkedFrom.join(', ') || 'nothing'}`)
    console.log(out.join('\n'))
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork record: ${/** @type {Error} */ (e).message}\n${USAGE}`)
  process.exitCode = 1
}
