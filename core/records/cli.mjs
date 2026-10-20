// @ts-check
// `groundwork record <command>`: the record store from the command line, what Claude uses (the
// core runs this file for `groundwork record ...`).
//
//   groundwork record list [--type I]     every record (of one type), one per line: id, state, title
//   groundwork record show I-5            one record: id and file, its fields, its body, its history,
//                                         its links (resolved: `ideas: I-5 (idea: Title)`, a plain id
//                                         when no module declares the type), a change's proposed items,
//                                         and the records that refer to it (computed, not in the file)
//   groundwork record add <type> --title T [--<field> value ...] [--body text]
//                                         a new record of the type (prefix C or name change) with the
//                                         next number, as Claude: prints `C-7 <file>`. A field of the
//                                         type is an option (`--ideas I-5,I-6 --milestone M-9`); without
//                                         --body a change starts as the spec skeleton
//
// The project folder is --root, else MINDMAP_DIR, else the current folder. The record types are the
// ones the modules declare (core/modules.mjs) and the core's own (changes and milestones,
// changes.mjs). Other changes go through the module's command (`groundwork ideas move`). A wrong
// call prints a message and exits with 1.

import path from 'node:path'
import { MODULES } from '../modules.mjs'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'

const USAGE = [
  'usage: groundwork record list [--type <prefix>]',
  '       groundwork record show <id>',
  '       groundwork record add <type> --title <title> [--<field> <value> ...] [--body <text>]',
].join('\n')

/** @param {string[]} args */
function parse(args) {
  /** @type {string[]} */
  const words = []
  /** @type {Record<string, string>} */
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      if (i + 1 >= args.length) throw new Error(`${a} needs a value`)
      opts[a.slice(2)] = args[++i]
    } else words.push(a)
  }
  return { words, opts }
}

/** @param {Record<string, string>} opts @param {string[]} allowed */
function only(opts, allowed) {
  for (const k of Object.keys(opts)) if (!allowed.includes(k)) throw new Error(`unknown option: --${k}`)
}

/** @param {string[]} argv */
function run([cmd, ...rest]) {
  const { words, opts } = parse(rest)
  const root = path.resolve(opts.root ?? (process.env.MINDMAP_DIR || process.cwd()))
  const store = openRecords(root, [...MODULES, CORE_RECORDS])
  const stateOf = (/** @type {import('./types.mjs').StoredRecord} */ r) => {
    const t = store.types().find((x) => x.prefix === r.type)
    return String((t && r.fields[t.lifecycle.field]) ?? '')
  }
  if (cmd === 'list') {
    only(opts, ['type', 'root'])
    if (words.length) throw new Error(`list takes no words: ${words.join(' ')}`)
    for (const r of store.list(opts.type)) {
      if (opts.type && r.type !== opts.type) continue
      console.log(`${r.id.padEnd(6)} ${stateOf(r).padEnd(11)} ${r.fields.title ?? ''}`.trimEnd())
    }
  } else if (cmd === 'show') {
    only(opts, ['root'])
    if (words.length !== 1) throw new Error('show needs one id: show I-5')
    const r = store.show(words[0])
    if (!r) throw new Error(`no record ${words[0]}`)
    const out = [`${r.id} ${r.file}`]
    for (const [k, v] of Object.entries(r.fields)) out.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    if (r.body) out.push('', r.body)
    if (r.links.length) {
      out.push('', 'Links:')
      for (const l of r.links) out.push(`  ${l.field}: ${l.id}${l.name ? ` (${l.name}${l.title ? `: ${l.title}` : ''})` : ''}`)
    }
    const items = /** @type {{ items?: import('./types.mjs').ProposedItem[] } | undefined} */ (r.outline)?.items
    if (items?.length) out.push('', 'Proposed items:', ...items.map((i) => `  ${i.op} ${i.id} → ${i.target}${i.text ? ` — ${i.text}` : ''}`))
    if (r.history.length) out.push('', 'History:', ...r.history.map((h) => `  ${h}`))
    out.push('', `Linked from: ${r.linkedFrom.join(', ') || 'nothing'}`)
    console.log(out.join('\n'))
  } else if (cmd === 'add') {
    if (words.length !== 1) throw new Error('add needs one type: add C (or add change)')
    const t = store.types().find((x) => x.prefix === words[0] || x.name === words[0])
    if (!t) throw new Error(`no record type ${words[0]}: ${store.types().map((x) => `${x.prefix} (${x.name})`).join(', ')}`)
    only(opts, ['root', 'body', ...t.fields])
    /** @type {import('./types.mjs').Fields} */
    const fields = {}
    for (const k of t.fields) {
      if (opts[k] == null) continue
      fields[k] = (t.lists ?? []).includes(k) ? opts[k].split(',').map((s) => s.trim()).filter(Boolean) : opts[k]
    }
    const made = store.create(t.prefix, { fields, body: opts.body ?? '' }, { by: 'claude' })
    console.log(`${made.id} ${made.file}`)
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork record: ${/** @type {Error} */ (e).message}\n${USAGE}`)
  process.exitCode = 1
}
