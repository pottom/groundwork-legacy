// `groundwork ideas <command>`: the Ideas module's command line (the core runs this file).
//
//   groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>]
//                                  [--kind product|engineering]   writes the next I-<n>-<slug>.md
//   groundwork ideas list                                          every idea, one per line
//   groundwork ideas move I-12 new|considering                     moves it between those two columns
//
// To develop and Rejected are not the command's to set: only a human decides them, in the browser
// (d-ideas-ai-limits). `move` refuses them with a message saying so.
//
// The project folder is --root, else MINDMAP_DIR, else the current folder. Every write goes through
// the core's writer (core/files.mjs), so it lands only under docs/product/ideas/items/.
// A wrong call prints a message and exits with 1.

import path from 'node:path'
import { moduleFiles } from '../../core/files.mjs'
import ideasModule from './module.mjs'
import { openIdeas } from './store.mjs'
import { CLI_STATUSES, STATUSES } from './fields.mjs'

const USAGE = 'usage: groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>] [--kind product|engineering]\n' +
  '       groundwork ideas list\n' +
  `       groundwork ideas move I-<n> ${CLI_STATUSES.join('|')}`
const VALUED = ['--body', '--author', '--source', '--kind', '--root']

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
  const store = openIdeas(root, moduleFiles(root, ideasModule))
  if (cmd === 'add') {
    if (words.length !== 1) throw new Error('add needs one title, in quotes')
    const idea = store.add({ title: words[0], body: opts.body, author: opts.author, source: opts.source, kind: opts.kind })
    console.log(`${idea.id} ${idea.file}`)
  } else if (cmd === 'list') {
    if (words.length) throw new Error(`list takes no words: ${words.join(' ')}`)
    for (const i of store.list()) console.log(`${i.id.padEnd(6)} ${i.status.padEnd(11)} ${i.title}  (${[i.author, i.source].filter(Boolean).join(', ')})`)
  } else if (cmd === 'move') {
    const [id, status] = words
    if (words.length !== 2 || !/^I-\d+$/.test(id)) throw new Error('move needs an idea and a column: move I-12 considering')
    if (STATUSES.includes(status) && !CLI_STATUSES.includes(status)) {
      throw new Error(`only a human moves an idea to ${status}, in the browser (the Ideas board); this command moves only between ${CLI_STATUSES.join(' and ')}`)
    }
    if (!CLI_STATUSES.includes(status)) throw new Error(`the column must be one of ${CLI_STATUSES.join(', ')}, not ${status}`)
    const now = store.list().find((i) => i.id === id)
    if (!now) throw new Error(`no idea ${id}`)
    if (!CLI_STATUSES.includes(now.status)) throw new Error(`${id} is in ${now.status}: only a human takes it out, in the browser (the Ideas board)`)
    const idea = store.update(id, { status }, { base: now.version })
    console.log(`${idea.id} ${idea.status}`)
  } else throw new Error(cmd ? `unknown command: ${cmd}` : 'which command?')
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork ideas: ${e.message}\n${USAGE}`)
  process.exitCode = 1
}
