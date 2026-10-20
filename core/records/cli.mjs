// @ts-check
// `groundwork record <command>`: the record store from the command line, what Claude uses (the
// core runs this file for `groundwork record ...`).
//
//   groundwork record list [--type I]     every record (of one type), one per line: id, state, title
//   groundwork record show I-5            one record: id and file, its fields, its body, its history,
//                                         its links (resolved: `ideas: I-5 (idea: Title)`, a plain id
//                                         when no module declares the type), a change's proposed items,
//                                         and the records that refer to it (computed, not in the file)
//   groundwork record show core/tech      a Spec document: its sections and items, one per line with
//                                         their marks ([d-npm] topic (decision, done, C-1) — note),
//                                         and the lines that are not in the canonical form
//   groundwork record show d-npm          an item (or a section) of the Spec, and its document;
//   groundwork record show core           a part: its line in spec/parts.md and its documents
//   groundwork record add <type> --title T [--<field> value ...] [--body text]
//                                         a new record of the type (prefix C or name change) with the
//                                         next number, as Claude: prints `C-7 <file>`. A field of the
//                                         type is an option (`--ideas I-5,I-6 --milestone M-9`); without
//                                         --body a change starts as the spec skeleton
//   groundwork record check               the quality check (check.mjs), with no server: duplicate
//                                         numbers, references to ids that are not there, lines not in
//                                         the canonical form, one per line as `file:line: rule: what`;
//                                         exits 1 when it finds any (a pre-commit hook, a CI step)
//   groundwork record renumber            started by hand only (renumber.mjs): the newer of two records
//                                         with one number gets the next one; prints each move, the
//                                         lines it rewrote, the lines to fix by hand, and the GitHub
//                                         ticket lines to change (it never writes those)
//
// The project folder is --root, else MINDMAP_DIR, else the current folder. The record types are the
// ones the modules declare (core/modules.mjs) and the core's own (changes and milestones,
// changes.mjs). Other changes go through the module's command (`groundwork ideas move`). A wrong
// call prints a message and exits with 1.

import path from 'node:path'
import { MODULES } from '../modules.mjs'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'
import { checkRecords, formatFinding } from './check.mjs'
import { renumber } from './renumber.mjs'

const USAGE = [
  'usage: groundwork record list [--type <prefix>]',
  '       groundwork record show <id>',
  '       groundwork record add <type> --title <title> [--<field> <value> ...] [--body <text>]',
  '       groundwork record check',
  '       groundwork record renumber',
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
    if (!r) {
      const found = store.spec.find(words[0])
      if (!found) throw new Error(`no record ${words[0]}`)
      return console.log(showSpec(found, store.spec).join('\n'))
    }
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
  } else if (cmd === 'check') {
    only(opts, ['root'])
    if (words.length) throw new Error(`check takes no words: ${words.join(' ')}`)
    const { findings, counts } = checkRecords(store)
    if (!findings.length) return console.log(`groundwork record check: no errors (${counts.records} records, ${counts.documents} Spec documents).`)
    console.log([...findings.map(formatFinding), `${findings.length} error${findings.length === 1 ? '' : 's'}.`].join('\n'))
    process.exitCode = 1
  } else if (cmd === 'renumber') {
    only(opts, ['root'])
    if (words.length) throw new Error(`renumber takes no words: ${words.join(' ')}`)
    const { moves } = renumber(store)
    if (!moves.length) return console.log('groundwork record renumber: no duplicate numbers; nothing to change.')
    const out = []
    for (const m of moves) {
      out.push(`${m.from} ${m.fromFile} → ${m.to} ${m.toFile}`, `  (${m.kept.id} stays ${m.kept.file})`)
      for (const r of m.rewritten) out.push(`  rewrote ${r.file}:${r.line}`)
      for (const u of m.unsure) out.push(`  by hand (which ${m.from}?): ${u.file}:${u.line}: ${u.text.trim()}`)
      const means = `where it means "${m.title}" (${m.from} stays "${m.kept.title}")`
      if (m.github == null) out.push(`  GitHub tickets are not written: search them for ${m.from} and change it to ${m.to} ${means}.`)
      else if (m.github.length) out.push(`  GitHub tickets are not written: change ${m.from} to ${m.to} ${means}:`, ...m.github.map((l) => `    ${l}`))
      else out.push(`  GitHub tickets: none mentions ${m.from}.`)
    }
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
