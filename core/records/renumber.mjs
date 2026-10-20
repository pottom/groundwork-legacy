// @ts-check
// `groundwork record renumber`: fixes a number two branches both gave out (two C-2 files after a
// merge), only when a human starts it (d-rec-renumber). The newer record gets the next free number;
// the references to it are rewritten under docs/product/ and in the local tickets under .scratch/;
// GitHub tickets are never written, only listed.
//
//   const { moves } = renumber(store, { today?, github? })
//   moves: [{ from: 'C-2', to: 'C-3', fromFile, toFile, title, kept: { id, file, title },
//             rewritten: [{ file, line }], unsure: [{ file, line, text }], github: string[] | null }]
//
// Which is newer: the record whose file git added later (a descendant of the other's commit, else
// the later commit time); one not committed yet is the newest; without git, the later `created`
// history line, then the file name. The older keeps its number.
//
// Which references are the newer's: its own file (every mention), any mention of its file name
// (C-002-beta.md is unambiguous), and each line that mentions the id and that git blame shows was
// written on the newer record's side only (its commit descends from the commit that added the newer
// record and not from the one that added the older). A line both sides can have written (after the
// merge, not committed, not in git) or neither is not changed: it is listed in `unsure`, to fix by
// hand. The renumbered record keeps its history and gets one more line, `renumbered: C-2 → C-3`.
//
// `github(id)` lists the GitHub ticket lines that mention the id (`#12 Title: **Change:** C-2`), or
// null when it cannot (no GitHub remote, no gh): then the command says what to search for. The
// default asks `gh issue list`, read only.
//
// Writes go through renumberFiles (core/files.mjs): the one writer that may also write .scratch/,
// and nothing outside docs/product/ and .scratch/.

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { renumberFiles } from '../files.mjs'
import { readRecord, writeRecord, fileName, slugOf } from './format.mjs'
import { duplicateNumbers } from './check.mjs'

/** @typedef {import('./types.mjs').StoredRecord} StoredRecord */
/** @typedef {ReturnType<typeof import('./store.mjs').openRecords>} Store */
/**
 * @typedef {Object} Move
 * @property {string} from
 * @property {string} to
 * @property {string} fromFile
 * @property {string} toFile
 * @property {string} title
 * @property {{ id: string, file: string, title: string }} kept
 * @property {{ file: string, line: number }[]} rewritten
 * @property {{ file: string, line: number, text: string }[]} unsure
 * @property {string[] | null} github
 */

const SCAN = ['docs/product', '.scratch']
const WORK = 'work'   // a line not committed (or a file git does not track)
const MAX_FILE = 5 * 1024 * 1024

/** @param {string} s */
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** @param {string} id */
const mention = (id) => new RegExp(`(?<![A-Za-z0-9_])${escape(id)}(?![0-9A-Za-z_])`, 'g')

/**
 * @param {Store} store
 * @param {{ today?: string, github?: (id: string) => string[] | null }} [options]
 * @returns {{ moves: Move[] }}
 */
export function renumber(store, { today = new Date().toISOString().slice(0, 10), github } = {}) {
  const root = store.root
  const groups = duplicateNumbers(store)
  if (!groups.length) return { moves: [] }
  const git = gitOf(root)
  const lookup = github ?? ((/** @type {string} */ id) => githubLines(root, git, id))

  // Who keeps the number, who gets a new one.
  /** @type {{ rec: StoredRecord, added: string | null, keep: StoredRecord, members: { rec: StoredRecord, added: string | null }[] }[]} */
  const plans = []
  for (const { records } of groups) {
    const members = records.map((rec) => ({ rec, added: git.added(rec.file) }))
    members.sort((a, b) => (newer(git, a, b) ? 1 : -1))
    for (const m of members.slice(1)) plans.push({ ...m, keep: members[0].rec, members })
  }

  // The new numbers: above everything the store knows, one after the other per prefix.
  /** @type {Map<string, number>} */
  const nextOf = new Map()
  const moves = plans.map((p) => {
    const n = nextOf.get(p.rec.type) ?? store.next(p.rec.type)
    nextOf.set(p.rec.type, n + 1)
    const to = `${p.rec.type}-${n}`
    const toFile = `${path.posix.dirname(p.rec.file)}/${fileName(p.rec.type, n, slugFromFile(p.rec))}`
    return { plan: p, move: /** @type {Move} */ ({ from: p.rec.id, to, fromFile: p.rec.file, toFile, title: String(p.rec.fields.title ?? ''),
      kept: { id: p.keep.id, file: p.keep.file, title: String(p.keep.fields.title ?? '') }, rewritten: [], unsure: [], github: null }) }
  })
  const memberFiles = new Set(plans.flatMap((p) => p.members.map((m) => m.rec.file)))

  // Every other file that mentions an id or a file name: which lines change, which are unsure.
  /** @type {Map<string, Map<number, [RegExp, string][]>>} */
  const edits = new Map()
  for (const file of textFiles(root)) {
    if (memberFiles.has(file)) continue
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
    /** @type {Map<number, string> | null} */
    let blame = null
    for (const { plan, move } of moves) {
      const byName = new RegExp(escape(path.posix.basename(move.fromFile)), 'g')
      const byId = mention(move.from)
      lines.forEach((line, i) => {
        /** @type {[RegExp, string][]} */
        const swaps = []
        const rest = line.replace(byName, '')
        if (rest !== line) swaps.push([byName, path.posix.basename(move.toFile)])
        if (rest.replace(byId, '') !== rest) {
          blame ??= git.blame(file)
          const commit = blame.get(i + 1) ?? WORK
          const owners = plan.members.filter((m) => git.descends(m.added, commit))
          if (owners.length === 1 && owners[0].rec === plan.rec) swaps.push([byId, move.to])
          else if (owners.length !== 1) move.unsure.push({ file, line: i + 1, text: line })
        }
        if (!swaps.length) return
        const at = edits.get(file) ?? new Map()
        at.set(i, [...(at.get(i) ?? []), ...swaps])
        edits.set(file, at)
        move.rewritten.push({ file, line: i + 1 })
      })
    }
  }

  // Write: the other files, line by line; then each renumbered record under its new name.
  const files = renumberFiles(root)
  for (const [file, at] of edits) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
    for (const [i, swaps] of at) for (const [re, to] of swaps) lines[i] = lines[i].replace(re, to)
    files.write(file, lines.join('\n'))
  }
  for (const { plan, move } of moves) {
    const t = store.types().find((x) => x.prefix === plan.rec.type)
    if (!t) continue
    let text = fs.readFileSync(path.join(root, move.fromFile), 'utf8')
    text = text.replace(new RegExp(escape(path.posix.basename(move.fromFile)), 'g'), path.posix.basename(move.toFile)).replace(mention(move.from), move.to)
    const rec = readRecord(text, t)
    rec.id = move.to
    rec.history = [...rec.history, `${today} · claude · renumbered: ${move.from} → ${move.to}`]
    files.write(move.toFile, writeRecord(rec, t))
    files.remove(move.fromFile)
    move.github = lookup(move.from)
  }
  return { moves: moves.map((m) => m.move) }
}

// The slug part of a record's file name (C-002-beta.md -> beta), else one from its title.
/** @param {StoredRecord} rec */
function slugFromFile(rec) {
  const m = /^[A-Z]+-\d+-(.+)\.md$/.exec(path.posix.basename(rec.file))
  return m ? m[1] : slugOf(String(rec.fields.title ?? ''))
}

// The text files under docs/product/ and .scratch/, '/'-separated.
/** @param {string} root @returns {string[]} */
function textFiles(root) {
  /** @type {string[]} */
  const out = []
  /** @param {string} rel */
  const walk = (rel) => {
    /** @type {fs.Dirent[]} */
    let entries = []
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const sub = `${rel}/${e.name}`
      if (e.isDirectory()) walk(sub)
      else if (e.isFile()) {
        const st = fs.statSync(path.join(root, sub))
        if (st.size > MAX_FILE) continue
        if (fs.readFileSync(path.join(root, sub)).includes(0)) continue
        out.push(sub)
      }
    }
  }
  for (const dir of SCAN) walk(dir)
  return out.sort()
}

/** @param {StoredRecord} rec */
const createdOf = (rec) => rec.history.map((h) => /^(\d{4}-\d\d-\d\d) · \S+ · created$/.exec(h)?.[1]).find(Boolean) ?? ''

// Whether a was made after b.
/**
 * @param {ReturnType<typeof gitOf>} git
 * @param {{ rec: StoredRecord, added: string | null }} a
 * @param {{ rec: StoredRecord, added: string | null }} b
 */
function newer(git, a, b) {
  const byText = () => (createdOf(a.rec) !== createdOf(b.rec) ? createdOf(a.rec) > createdOf(b.rec) : a.rec.file > b.rec.file)
  if (!a.added && !b.added) return byText()
  if (!a.added || !b.added) return !a.added
  if (a.added === b.added) return byText()
  if (git.ancestor(b.added, a.added)) return true
  if (git.ancestor(a.added, b.added)) return false
  const ta = git.time(a.added), tb = git.time(b.added)
  return ta !== tb ? ta > tb : byText()
}

// git, read only; every answer is "unknown" without git.
/** @param {string} root */
function gitOf(root) {
  /** @param {string[]} args */
  const run = (args) => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000, maxBuffer: 64 * 1024 * 1024 }) } catch { return null }
  }
  const head = run(['rev-parse', '--verify', '-q', 'HEAD'])?.trim() || null
  /** @type {Map<string, boolean>} */
  const known = new Map()
  /** @param {string} a @param {string} b */
  const ancestor = (a, b) => {
    const key = `${a} ${b}`
    if (!known.has(key)) {
      let yes = a === b
      if (!yes) { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: root, stdio: 'ignore', timeout: 20000 }); yes = true } catch { yes = false } }
      known.set(key, yes)
    }
    return /** @type {boolean} */ (known.get(key))
  }
  return {
    /** The commit that first added the file, or null. @param {string} file */
    added: (file) => run(['log', '--diff-filter=A', '--format=%H', '--', file])?.trim().split('\n').filter(Boolean).at(-1) ?? null,
    /** @param {string} commit */
    time: (commit) => Number(run(['show', '-s', '--format=%ct', commit])?.trim() ?? 0),
    ancestor,
    /**
     * Whether a line written in `commit` can be from the side of a record added in `added`.
     * @param {string | null} added @param {string} commit
     */
    descends: (added, commit) => {
      if (commit === WORK) return !added || (head != null && ancestor(added, head))
      return added != null && ancestor(added, commit)
    },
    /** The commit of each line (1-based), WORK for lines not committed. @param {string} file @returns {Map<number, string>} */
    blame: (file) => {
      /** @type {Map<number, string>} */
      const out = new Map()
      const text = head ? run(['blame', '--porcelain', '--', file]) : null
      for (const l of (text ?? '').split('\n')) {
        const m = /^([0-9a-f]{40}) \d+ (\d+)/.exec(l)
        if (m) out.set(Number(m[2]), /^0+$/.test(m[1]) ? WORK : m[1])
      }
      return out
    },
    /** The URL of the origin remote, or ''. */
    origin: () => run(['remote', 'get-url', 'origin'])?.trim() ?? '',
  }
}

// The lines of GitHub tickets that mention the id, read with gh; null when there is no GitHub
// remote or gh cannot answer.
/** @param {string} root @param {ReturnType<typeof gitOf>} git @param {string} id @returns {string[] | null} */
function githubLines(root, git, id) {
  if (!/github\.com/i.test(git.origin())) return null
  let text
  try {
    text = execFileSync('gh', ['issue', 'list', '--state', 'all', '--search', `"${id}" in:body`, '--json', 'number,title,body', '--limit', '200'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 })
  } catch { return null }
  /** @type {{ number: number, title: string, body: string }[]} */
  let issues
  try { issues = JSON.parse(text) } catch { return null }
  const re = mention(id)
  return issues.flatMap((i) => String(i.body ?? '').split(/\r?\n/).filter((l) => new RegExp(re.source).test(l)).map((l) => `#${i.number} ${i.title}: ${l.trim()}`))
}
