// @ts-check
// `groundwork record <command>`: the record store from the command line, what Claude uses (the
// core runs this file for `groundwork record ...`).
//
//   groundwork record list [--type I]     every record (of one type), one per line: id, state, title
//   groundwork record show I-5            one record: id and file, its fields, its body, its history,
//                                         and the records that refer to it (computed, not in the file)
//   groundwork record show core/tech      a Spec document: its sections and items, one per line with
//                                         their marks ([d-npm] topic (decision, done, C-1) — note),
//                                         and the lines that are not in the canonical form
//   groundwork record show d-npm          an item (or a section) of the Spec, and its document;
//   groundwork record show core           a part: its line in spec/parts.md and its documents
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
    if (!r) {
      const found = store.spec.find(words[0])
      if (!found) throw new Error(`no record ${words[0]}`)
      return console.log(showSpec(found, store.spec).join('\n'))
    }
    const out = [`${r.id} ${r.file}`]
    for (const [k, v] of Object.entries(r.fields)) out.push(`${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    if (r.body) out.push('', r.body)
    if (r.history.length) out.push('', 'History:', ...r.history.map((h) => `  ${h}`))
    out.push('', `Linked from: ${r.linkedFrom.join(', ') || 'nothing'}`)
    console.log(out.join('\n'))
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

/** @typedef {import('./spec-format.mjs').SpecItem} SpecItem */
/** @typedef {import('./spec-format.mjs').SpecSection} SpecSection */

// One item and its children, one per line: [id] topic (status, implementation, origin) — note
/** @param {SpecItem} it @param {number} depth @returns {string[]} */
function itemOutline(it, depth) {
  const marks = [it.status === 'topic' ? 'group' : it.status, it.impl, it.origin.join(', '), it.supersededBy && `superseded by ${it.supersededBy}`, ...(it.extra ?? [])].filter(Boolean)
  const note = it.note ? ` — ${it.note.replace(/\n+/g, ' ')}` : ''
  const link = it.link ? ` <${it.link}>` : ''
  return [`${'  '.repeat(depth)}${it.id ? `[${it.id}] ` : ''}${it.topic}${marks.length ? ` (${marks.join(', ')})` : ''}${note}${link}`, ...it.items.flatMap((c) => itemOutline(c, depth + 1))]
}

/** @param {SpecSection} s @returns {string[]} */
const sectionOutline = (s) => [`${s.id ? `[${s.id}] ` : ''}${s.title}${s.done ? ' (done)' : ''}`, ...s.items.flatMap((it) => itemOutline(it, 1))]

/**
 * What `record show` prints for an id of the Spec.
 * @param {import('./spec-store.mjs').Found} found
 * @param {ReturnType<typeof import('./spec-store.mjs').openSpec>} spec
 * @returns {string[]}
 */
function showSpec(found, spec) {
  if (found.kind === 'part') {
    const p = found.part
    return [`${found.id} ${p ? `${p.name} (${[p.type, p.active ? 'active' : 'retired'].filter(Boolean).join(', ')})${p.description ? ` — ${p.description}` : ''}` : '(not in spec/parts.md)'}`,
      `documents: ${found.documents.join(', ') || 'none'}`]
  }
  if (found.kind === 'item' || found.kind === 'section') {
    const doc = spec.doc(found.document)
    const lines = found.kind === 'item' ? itemOutline(found.item, 0) : sectionOutline(found.section)
    return [...lines, `in ${found.document} ${doc?.file ?? ''}`.trimEnd()]
  }
  const d = found.doc
  const out = [`${d.id} ${d.file}`, `title: ${d.title}`, `kind: ${d.kind}${d.part ? ` · part: ${d.part}` : ''} · language: ${d.lang}`]
  if (d.items.length) out.push('', ...d.items.flatMap((it) => itemOutline(it, 0)))
  for (const s of d.sections) out.push('', ...sectionOutline(s))
  if (d.problems.length) out.push('', 'Not canonical:', ...d.problems.map((p) => `  ${p.line}: ${p.why}: ${p.text}`))
  return out
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork record: ${/** @type {Error} */ (e).message}\n${USAGE}`)
  process.exitCode = 1
}
