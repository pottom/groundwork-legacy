// `groundwork ideas <command>`: the Ideas module's command line (the core runs this file).
//
//   groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>]
//                                  [--kind product|engineering]   writes the next I-<n>-<slug>.md
//                                  [--impact low|medium|high] [--effort low|medium|high]
//                                  [--rationale <one line>] [--links I-3,I-7]
//                                  --author claude needs --source, --impact, --effort, --rationale
//   groundwork ideas similar "<text>"                              the likely duplicates, with a score
//   groundwork ideas list                                          every idea, one per line
//   groundwork ideas move I-12 new|considering                     moves it between those two columns
//
// The command is Claude: it moves an idea only between New and Considering. Accepted, Rejected,
// Snoozed and Duplicate are the human's decision, made in the browser (d-ideas-ai-limits); the
// core's record store refuses them for the command, with a message saying so.
//
// The project folder is --root, else MINDMAP_DIR, else the current folder. Every write goes through
// the core's record store, opened as the server opens it (core/records/project.mjs: every type, so a
// link to a change or a milestone is known) and as Ideas gets it (forModule: it writes ideas only),
// so it lands only under docs/product/ideas/.
// A wrong call prints a message and exits with 1.

import path from 'node:path'
import { openProjectRecords } from '../../core/records/project.mjs'
import manifest from './module.mjs'
import { openIdeas } from './store.mjs'
import { similar } from './similar.mjs'
import { CLI_STATUSES } from './fields.mjs'

const USAGE = 'usage: groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>] [--kind product|engineering]\n' +
  '         [--impact low|medium|high] [--effort low|medium|high] [--rationale <one line>] [--links I-3,I-7]\n' +
  '       groundwork ideas similar "<text>"\n' +
  '       groundwork ideas list\n' +
  `       groundwork ideas move I-<n> ${CLI_STATUSES.join('|')}`
const VALUED = ['--body', '--author', '--source', '--kind', '--impact', '--effort', '--rationale', '--links', '--root']

// The arguments after the command: { words: [...], opts: { body, author, ... } }.
function parse(args) {
  const words = [], opts = {}
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

function run([cmd, ...rest]) {
  const { words, opts } = parse(rest)
  const root = path.resolve(opts.root ?? (process.env.MINDMAP_DIR || process.cwd()))
  const store = openIdeas(openProjectRecords(root).forModule(manifest))
  const by = 'claude'
  if (cmd === 'add') {
    if (words.length !== 1) throw new Error('add needs one title, in quotes')
    // Claude's own idea always says where it came from and what it is worth (d-ideas-who, f-ideas-assist).
    if (opts.author === 'claude') {
      const missing = ['source', 'impact', 'effort', 'rationale'].filter((k) => !opts[k]?.trim())
      if (missing.length) throw new Error(`an idea by claude needs ${missing.map((k) => '--' + k).join(', ')}`)
    }
    const links = (opts.links ?? '').split(/[\s,]+/).filter(Boolean).map((s) => s.toUpperCase())
    const idea = store.add({ title: words[0], body: opts.body, author: opts.author, source: opts.source, kind: opts.kind,
      impact: opts.impact, effort: opts.effort, rationale: opts.rationale, links }, { by })
    console.log(`${idea.id} ${idea.file}`)
  } else if (cmd === 'similar') {
    if (words.length !== 1) throw new Error('similar needs one text, in quotes')
    const found = similar(words[0], store.list())
    if (!found.length) console.log('No similar ideas.')
    for (const { idea: i, score } of found) console.log(`${i.id.padEnd(6)} ${score.toFixed(2)}  ${i.status.padEnd(11)} ${i.title}`)
  } else if (cmd === 'list') {
    if (words.length) throw new Error(`list takes no words: ${words.join(' ')}`)
    for (const i of store.list()) {
      const estimate = i.impact || i.effort ? `  impact ${i.impact ?? '?'}, effort ${i.effort ?? '?'}` : ''
      const links = i.links?.length ? `  ~ ${i.links.join(', ')}` : ''
      console.log(`${i.id.padEnd(6)} ${i.status.padEnd(11)} ${i.title}  (${[i.author, i.source].filter(Boolean).join(', ')})${estimate}${links}`)
    }
  } else if (cmd === 'move') {
    const [id, status] = words
    if (words.length !== 2 || !/^I-\d+$/.test(id)) throw new Error('move needs an idea and a column: move I-12 considering')
    // The store decides what Claude may do: it refuses a move outside New and Considering.
    const idea = store.update(id, { status }, { by })
    console.log(`${idea.id} ${idea.status}`)
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork ideas: ${e.message}\n${USAGE}`)
  process.exitCode = 1
}
