// @ts-check
// A Spec document as one Markdown file, the source, in git: docs/product/spec/<part>/<KIND>.md
// (spec/SYSTEM.md is the whole system's), and the list of parts, docs/product/spec/parts.md. The
// structure is in readable marks, in one canonical form that the store writes and reads back:
//
//   # Mag: Műszaki terv                          the title
//
//   _Műszaki terv_                               the kind's subtitle, in the document language
//
//   ## Technológiai stack {#t-stack .done}       a section: its id, and .done once it is settled
//
//   Node, függőség nélkül.                       the section's prose (Claude's; no list, no heading)
//
//   <!-- human: hp-1 -->                         a paragraph of the human's own, kept as written
//   Az ember bekezdése.
//   <!-- /human -->
//
//   - npm-csomag · `d-npm` · döntés · kész · C-1    an item: topic, id, status, implementation, origin
//     npx-szel fut.                                its note, below
//     [core/groundwork.mjs](../../../../core/groundwork.mjs)   its link (from the project root)
//   - **Felület** · `g-ui` · C-1                   a group: bold, no status
//     - React · `d-react` · döntés · C-1 · felváltotta: C-9   a superseded item stays, marked
//
// An item line ends in its id between backticks, then its marks, each after ` · `: the status
// (decision, note, excluded, parked, inferred, todo; a group has none), the implementation (done,
// partial, missing), the changes it comes from (C-1, C-7: its origin and the later ones) and the
// change that superseded it (felváltotta: C-9). The words are the document language's
// (doc-strings.mjs marks and impl): Hungarian and English documents, read in either. So the id
// stands next to its line, and `grep d-npm` finds it. Nothing computed (section numbers,
// progress counts, cross-section lists) is in the file: the views compute it.
//
//   writeSpecDoc(doc)                -> text
//   readSpecDoc(text, { file, lang? }) -> { doc, problems }
//   writeParts({ lang, parts, human }) -> text
//   readParts(text, { lang? })        -> { lang, parts, human, problems }
//   docIdOf(file)                    -> { id, part, kind } | null     'core/tech', 'system'
//   docFile(id)                      -> the file of a document id     'docs/product/spec/core/TECH.md'
//   itemTextOf(text)                 -> { topic, status, impl?, marked }   a proposed item's text
//                                       (`Topic · döntés · hiányzik`) as an item's words
//
// The writer has one canonical form, and the reader reads it back exactly: read(write(x)) = x and
// write(read(write(x))) = write(x), byte for byte. The reader is patient: whatever does not fit the
// canonical form is kept, as the human's text where it has no other place (a free paragraph, git
// conflict markers with all between them, an unclosed human block, lines before the title), or as
// it is (a heading or an item line whose mark was deleted is a section or an item without an id;
// an unknown mark stays on its line). The next write only normalizes the form and drops nothing.
// `problems` lists every line of the text that is not canonical: { line (from 1), text, why }, why
// one of 'stray' (kept as human text), 'conflict' (git conflict markers and what is between them),
// 'unclosed' (a human block without its end), 'no-mark' (a section or item without an id),
// 'no-status' (an item without a status: read as a decision), 'unknown-mark', 'duplicate' (an id
// twice in the document), 'form' (written differently: order, language, indentation, spacing).

import { DOC_STRINGS, DEFAULT_DOC_LANG, KINDS } from './doc-strings.mjs'

/**
 * A paragraph the human wrote; Claude never edits it.
 * @typedef {{ id?: string, text: string }} HumanText
 */
/**
 * An item of a section: a decision, a fact, a group of items...
 * @typedef {Object} SpecItem
 * @property {string} id                 'd-npm'; '' when its line has no mark
 * @property {string} topic
 * @property {string} status             decision | note | excluded | parked | inferred | todo | topic (a group); '' without a mark
 * @property {string} [impl]             done | partial | missing
 * @property {string[]} origin           the changes it comes from: ['C-1', 'C-7']
 * @property {string} [supersededBy]     'C-9': the change that superseded it (it stays, marked)
 * @property {string} [note]
 * @property {string} [link]             relative to the project root, or a URL
 * @property {string[]} [extra]          marks the reader did not know, kept on the line
 * @property {SpecItem[]} items          its children
 */
/**
 * @typedef {Object} SpecSection
 * @property {string} id                 't-stack'; '' when its heading has no mark
 * @property {string} title
 * @property {boolean} done              Claude considers it settled
 * @property {string} prose              Claude's text
 * @property {HumanText[]} human
 * @property {SpecItem[]} items
 */
/**
 * @typedef {Object} SpecDoc
 * @property {string} id                 'core/tech', 'system'
 * @property {string | null} part        'core'; null for the system document
 * @property {string} kind               'tech' (doc-strings.mjs KINDS)
 * @property {string} file               relative to the project, '/'-separated
 * @property {string} lang               the document language: 'hu', 'en'
 * @property {string} title
 * @property {string} prose              text before the first section
 * @property {HumanText[]} human
 * @property {SpecItem[]} items          items before the first section
 * @property {SpecSection[]} sections
 */
/**
 * A line of a file that is not in the canonical form.
 * @typedef {{ line: number, text: string, why: string }} Problem
 */
/**
 * @typedef {Object} SpecPart
 * @property {string} name
 * @property {string} slug               'core': the folder spec/<slug>/ and the part's id
 * @property {string} type               software | service | infra | shared
 * @property {string} description        one sentence
 * @property {boolean} active            false once retired
 */

export const SPEC_DIR = 'docs/product/spec'
export const PARTS_FILE = `${SPEC_DIR}/parts.md`

/** @type {Record<string, any>} */
const STRINGS = DOC_STRINGS
const LANGS = Object.keys(STRINGS)
/** @param {string} lang */
const strings = (lang) => STRINGS[lang] ?? STRINGS[DEFAULT_DOC_LANG]
/** @param {string} first */
const langOrder = (first) => [first, ...LANGS.filter((l) => l !== first)]

/** @param {string} kind @param {string} lang @returns {string} */
const subtitleOf = (kind, lang) => strings(lang).kinds[kind]?.subtitle ?? kind

// ---------- ids and files ----------

/** @param {string} file @returns {{ id: string, part: string | null, kind: string } | null} */
export function docIdOf(file) {
  const rel = file.startsWith(SPEC_DIR + '/') ? file.slice(SPEC_DIR.length + 1) : null
  if (!rel) return null
  const parts = rel.split('/')
  const kindOf = (/** @type {string} */ name) => {
    if (!/^[A-Z][A-Z0-9_-]*\.md$/.test(name)) return null
    const k = Object.entries(KINDS).find(([, v]) => v.file === name)
    return k ? k[0] : name.slice(0, -3).toLowerCase()
  }
  if (parts.length === 1) return parts[0] === KINDS.system.file ? { id: 'system', part: null, kind: 'system' } : null
  if (parts.length !== 2 || !/^[a-z0-9][a-z0-9-]*$/.test(parts[0])) return null
  const kind = kindOf(parts[1])
  return kind ? { id: `${parts[0]}/${kind}`, part: parts[0], kind } : null
}

/** @param {string} id @returns {string} */
export function docFile(id) {
  if (id === 'system') return `${SPEC_DIR}/${KINDS.system.file}`
  const [part, kind] = id.split('/')
  /** @type {Record<string, { file: string }>} */
  const kinds = KINDS
  return `${SPEC_DIR}/${part}/${kinds[kind]?.file ?? `${kind.toUpperCase()}.md`}`
}

// A link on an item is relative to the project root; in the file it is relative to the file.
/** @param {string} link @param {string} file */
function relLink(link, file) {
  if (/^[a-z]+:|^#|^\//i.test(link)) return link
  return '../'.repeat(file.split('/').length - 1) + link
}

// ---------- writing ----------

/** @param {HumanText} h @returns {string[]} */
const humanLines = (h) => [`<!-- human${h.id ? `: ${h.id}` : ''} -->`, ...(h.text ? h.text.split('\n') : []), '<!-- /human -->']

/** @param {SpecItem} it @param {number} depth @param {string} file @param {any} t @returns {string[]} */
function itemLines(it, depth, file, t) {
  const indent = '  '.repeat(depth)
  if (!it.id) {
    return [`${indent}- ${it.topic}`, ...contLines(it, indent, file), ...it.items.flatMap((c) => itemLines(c, depth + 1, file, t))]
  }
  const marks = []
  if (it.status && it.status !== 'topic') marks.push(t.marks.status[it.status] ?? it.status)
  if (it.impl) marks.push(t.impl[it.impl] ?? it.impl)
  if (it.origin.length) marks.push(it.origin.join(', '))
  if (it.supersededBy) marks.push(`${t.marks.superseded}: ${it.supersededBy}`)
  marks.push(...(it.extra ?? []))
  const topic = it.status === 'topic' ? `**${it.topic}**` : it.topic
  return [
    `${indent}- ${topic} · \`${it.id}\`${marks.map((m) => ` · ${m}`).join('')}`,
    ...contLines(it, indent, file),
    ...it.items.flatMap((c) => itemLines(c, depth + 1, file, t)),
  ]
}

/** @param {SpecItem} it @param {string} indent @param {string} file */
function contLines(it, indent, file) {
  const out = it.note ? it.note.split('\n').map((l) => (l ? `${indent}  ${l}` : '')) : []
  if (it.link) out.push(`${indent}  [${it.link}](${relLink(it.link, file)})`)
  return out
}

/** @param {{ prose: string, human: HumanText[], items: SpecItem[] }} body @param {string} file @param {any} t @returns {string[]} */
function bodyLines(body, file, t) {
  const out = []
  if (body.prose) out.push(...body.prose.split('\n'), '')
  for (const h of body.human) out.push(...humanLines(h), '')
  if (body.items.length) out.push(...body.items.flatMap((it) => itemLines(it, 0, file, t)), '')
  return out
}

/** @param {SpecDoc} doc @returns {string} */
export function writeSpecDoc(doc) {
  const t = strings(doc.lang)
  const out = [`# ${doc.title}`, '', `_${subtitleOf(doc.kind, doc.lang)}_`, '', ...bodyLines(doc, doc.file, t)]
  for (const s of doc.sections) {
    out.push(`## ${s.title}${s.id ? ` {#${s.id}${s.done ? ' .done' : ''}}` : ''}`, '', ...bodyLines(s, doc.file, t))
  }
  return out.join('\n').replace(/\n*$/, '\n')
}

// ---------- reading ----------

const H1 = /^# (.*)$/
const H2 = /^## (.*)$/
const SECTION_MARK = /^(.*?) \{#([^\s{}]+)( \.done)?\}$/
const HUMAN_START = /^<!-- human(?:: (\S+))? -->$/
const HUMAN_END = /^<!-- \/human -->$/
const CONFLICT_START = /^<{7}(?: |$)/
const CONFLICT_END = /^>{7}(?: |$)/
const BULLET = /^( *)[-*+] (.*)$/
const MARKED = /^(.*) · `([^`\s]+)`((?: · [^`]*)?)$/
const ORIGIN = /^C-\d+(?:, C-\d+)*$/
const LINK = /^\[(.+)\]\((.+)\)$/

/**
 * What a mark word means, in any language: [kind, key, lang].
 * @param {string} word
 * @returns {[string, string, string] | null}
 */
function markOf(word) {
  for (const lang of LANGS) {
    const t = STRINGS[lang]
    for (const [k, v] of Object.entries(t.marks.status)) if (v === word) return ['status', k, lang]
    for (const [k, v] of Object.entries(t.impl)) if (v === word) return ['impl', k, lang]
    const sup = new RegExp(`^${t.marks.superseded}: (C-\\d+)$`).exec(word)
    if (sup) return ['superseded', sup[1], lang]
  }
  return ORIGIN.test(word) ? ['origin', word, ''] : null
}

/**
 * @typedef {{ prose: string, human: HumanText[], items: SpecItem[] }} Body
 * @typedef {{ item: SpecItem, indent: number, cont: string[], blanks: number }} Open
 */

/**
 * @param {string} text
 * @param {{ file: string, lang?: string }} opts
 * @returns {{ doc: SpecDoc, problems: Problem[] }}
 */
export function readSpecDoc(text, { file, lang: fallback = DEFAULT_DOC_LANG }) {
  const where = docIdOf(file) ?? { id: '', part: null, kind: 'prd' }
  const lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
  /** @type {Map<number, string>} */
  const why = new Map()
  /** @type {Record<string, number>} */
  const votes = {}
  /** @type {SpecDoc} */
  const doc = { id: where.id, part: where.part, kind: where.kind, file, lang: fallback, title: '', prose: '', human: [], items: [], sections: [] }
  /** @type {Body & { id?: string }} */
  let body = doc
  let phase = 'pre'          // pre (before the title) | prose | after (past prose: free text is stray)
  /** @type {string[]} */
  let prose = []
  /** @type {string[]} */
  let stray = []
  /** @type {Open[]} */
  let open = []
  let subtitleLang = ''

  const flushProse = () => {
    const p = prose.join('\n').trim()
    if (p) body.prose = body.prose ? `${body.prose}\n\n${p}` : p
    prose = []
  }
  const flushStray = () => {
    const s = stray.join('\n').trim()
    if (s) body.human.push({ text: s })
    stray = []
  }
  const closeItems = () => {
    for (const o of open) finishItem(o)
    open = []
  }
  /** @param {Open} o */
  const finishItem = (o) => {
    const cont = o.cont
    while (cont.length && !cont[cont.length - 1]) cont.pop()
    const last = cont.length ? LINK.exec(cont[cont.length - 1]) : null
    if (last && last[2] === relLink(last[1], file)) { o.item.link = last[1]; cont.pop() }
    while (cont.length && !cont[cont.length - 1]) cont.pop()
    if (cont.length) o.item.note = cont.join('\n')
  }
  const structural = () => { flushProse(); flushStray(); closeItems() }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (CONFLICT_START.test(line)) {
      structural()
      const start = i
      while (i < lines.length - 1 && !CONFLICT_END.test(lines[i])) i++
      for (let k = start; k <= i; k++) why.set(k, 'conflict')
      body.human.push({ text: lines.slice(start, i + 1).join('\n') })
      if (phase !== 'pre') phase = 'after'
      continue
    }
    const h1 = phase === 'pre' && doc.sections.length === 0 ? H1.exec(line) : null
    if (h1) {
      structural()
      doc.title = h1[1].trim()
      phase = 'prose'
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      const sub = /^_(.+)_$/.exec(lines[j] ?? '')
      const sl = sub ? langOrder(fallback).find((l) => subtitleOf(where.kind, l) === sub[1]) : null
      if (sl) { subtitleLang = sl; i = j }
      continue
    }
    const h2 = H2.exec(line)
    if (h2) {
      structural()
      const m = SECTION_MARK.exec(h2[1])
      /** @type {SpecSection} */
      const s = m ? { id: m[2], title: m[1].trim(), done: !!m[3], prose: '', human: [], items: [] } : { id: '', title: h2[1].trim(), done: false, prose: '', human: [], items: [] }
      if (!m) why.set(i, 'no-mark')
      doc.sections.push(s)
      body = s
      phase = 'prose'
      continue
    }
    const hs = HUMAN_START.exec(line)
    if (hs) {
      structural()
      const start = i
      const inner = []
      let closed = false
      while (i + 1 < lines.length) {
        if (HUMAN_END.test(lines[i + 1])) { i++; closed = true; break }
        if (H2.test(lines[i + 1])) break
        inner.push(lines[++i])
      }
      if (!closed) for (let k = start; k <= i; k++) if (lines[k].trim()) why.set(k, 'unclosed')
      /** @type {HumanText} */
      const h = { text: inner.join('\n').trim() }
      if (hs[1]) h.id = hs[1]
      body.human.push(h)
      if (phase !== 'pre') phase = 'after'
      continue
    }
    const b = BULLET.exec(line)
    if (b && phase !== 'pre' && (b[1].length === 0 || open.length)) {
      flushProse(); flushStray()
      const indent = b[1].length
      while (open.length && open[open.length - 1].indent >= indent) finishItem(/** @type {Open} */ (open.pop()))
      const item = parseItem(b[2], i, why, votes)
      const parent = open.length ? open[open.length - 1].item.items : body.items
      parent.push(item)
      open.push({ item, indent, cont: [], blanks: 0 })
      phase = 'after'
      continue
    }
    if (!line.trim()) {
      if (open.length) open[open.length - 1].blanks++
      else if (stray.length) stray.push('')
      else if (phase === 'prose') prose.push('')
      continue
    }
    const top = open[open.length - 1]
    const lead = line.length - line.trimStart().length
    if (top && lead >= top.indent + 2) {
      for (; top.blanks; top.blanks--) top.cont.push('')
      top.cont.push(line.slice(top.indent + 2))
      continue
    }
    closeItems()
    if (phase === 'prose' && !stray.length) { prose.push(line); continue }
    why.set(i, 'stray')
    stray.push(line)
  }
  structural()

  const voted = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0]
  doc.lang = subtitleLang || voted || fallback
  markDuplicates(doc, lines, why)
  return { doc, problems: problemsOf(lines, writeSpecDoc(doc), why) }
}

/**
 * @param {string} text  the line after its bullet
 * @param {number} i
 * @param {Map<number, string>} why
 * @param {Record<string, number>} votes
 * @returns {SpecItem}
 */
function parseItem(text, i, why, votes) {
  const m = MARKED.exec(text)
  if (!m) {
    why.set(i, 'no-mark')
    return { id: '', topic: text, status: '', origin: [], items: [] }
  }
  /** @type {SpecItem} */
  const item = { id: m[2], topic: m[1], status: '', origin: [], items: [] }
  const words = m[3] ? m[3].slice(3).split(' · ') : []
  for (const w of words) {
    const mark = markOf(w)
    if (mark && mark[2]) votes[mark[2]] = (votes[mark[2]] ?? 0) + 1
    if (mark?.[0] === 'status' && !item.status) item.status = mark[1]
    else if (mark?.[0] === 'impl' && !item.impl) item.impl = mark[1]
    else if (mark?.[0] === 'origin' && !item.origin.length) item.origin = mark[1].split(', ')
    else if (mark?.[0] === 'superseded' && !item.supersededBy) item.supersededBy = mark[1]
    else { (item.extra ??= []).push(w); why.set(i, 'unknown-mark') }
  }
  if (!item.status) {
    const bold = /^\*\*(.+)\*\*$/.exec(item.topic)
    if (bold) { item.status = 'topic'; item.topic = bold[1] }
    else { item.status = 'decision'; if (!why.has(i)) why.set(i, 'no-status') }
  }
  return item
}

/**
 * The words of a proposed item's text (a change's `— Topic · döntés · hiányzik`) as an item's: the
 * status and implementation marks at its end, in any language, and the topic before them (a bold
 * topic is a group). Without a status mark an item is a decision; `marked` says whether it had any
 * mark (a section's title has none).
 * @param {string} text
 * @returns {{ topic: string, status: string, impl?: string, marked: boolean }}
 */
export function itemTextOf(text) {
  const words = String(text ?? '').trim().split(' · ')
  /** @type {{ topic: string, status: string, impl?: string, marked: boolean }} */
  const out = { topic: '', status: '', marked: false }
  while (words.length > 1) {
    const mark = markOf(words[words.length - 1])
    if (mark?.[0] === 'impl' && !out.impl && !out.status) { out.impl = mark[1]; out.marked = true }
    else if (mark?.[0] === 'status' && !out.status) { out.status = mark[1]; out.marked = true }
    else break
    words.pop()
  }
  out.topic = words.join(' · ')
  const bold = /^\*\*(.+)\*\*$/.exec(out.topic)
  if (bold) { out.topic = bold[1]; out.status = 'topic'; out.marked = true }
  else if (!out.status) out.status = 'decision'
  return out
}

// An id twice in a document: the later line is reported.
/** @param {SpecDoc} doc @param {string[]} lines @param {Map<number, string>} why */
function markDuplicates(doc, lines, why) {
  const seen = new Set()
  /** @param {string} id */
  const mark = (id) => {
    if (!id) return
    if (!seen.has(id)) { seen.add(id); return }
    const pattern = new RegExp(`\`${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\`|\\{#${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ }]`)
    let n = 0
    for (let i = 0; i < lines.length; i++) if (pattern.test(lines[i]) && ++n > 1) why.set(i, 'duplicate')
  }
  /** @param {SpecItem[]} items */
  const walk = (items) => { for (const it of items) { mark(it.id); walk(it.items) } }
  walk(doc.items)
  for (const s of doc.sections) { mark(s.id); walk(s.items) }
}

// Every line of the text that the canonical form does not hold as it is, with the reader's reason
// or 'form'; and every line the reader had a reason for, though written the same. The lines with a
// reason are reported anyway, and blank ones never, so both are left out of the match: what moved
// is the stray text, not the canonical lines around it.
/** @param {string[]} lines @param {string} canonical @param {Map<number, string>} why @returns {Problem[]} */
function problemsOf(lines, canonical, why) {
  const out = canonical.replace(/\n$/, '').split('\n')
  const kept = commonLines(lines.map((l, i) => (why.has(i) || !l.trim() ? null : l)), out)
  /** @type {Problem[]} */
  const problems = []
  for (let i = 0; i < lines.length; i++) {
    if (kept[i] && !why.has(i)) continue
    if (!lines[i].trim() && !why.has(i)) continue
    problems.push({ line: i + 1, text: lines[i], why: why.get(i) ?? 'form' })
  }
  return problems
}

// Which lines of a are kept in b, in order (a longest common subsequence).
/** @param {Array<string | null>} a @param {string[]} b @returns {boolean[]} */
function commonLines(a, b) {
  const n = a.length, m = b.length
  const w = m + 1
  const dp = new Int32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1])
    }
  }
  const kept = new Array(n).fill(false)
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { kept[i] = true; i++; j++ }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++
    else j++
  }
  return kept
}

// ---------- spec/parts.md ----------

const PART_LINE = /^- (.*?) · `([^`\s]+)`((?: · .*)?)$/

/** @param {{ lang: string, parts: SpecPart[], human: HumanText[] }} list @returns {string} */
export function writeParts({ lang, parts, human }) {
  const t = strings(lang)
  const out = [`# ${t.marks.parts}`, '']
  if (parts.length) {
    for (const p of parts) {
      const marks = [p.type, p.description, p.active ? t.marks.part.active : t.marks.part.retired].filter(Boolean)
      out.push(`- ${p.name} · \`${p.slug}\`${marks.map((m) => ` · ${m}`).join('')}`)
    }
    out.push('')
  }
  for (const h of human) out.push(...humanLines(h), '')
  return out.join('\n').replace(/\n*$/, '\n')
}

/**
 * @param {string} text
 * @param {{ lang?: string }} [opts]
 * @returns {{ lang: string, parts: SpecPart[], human: HumanText[], problems: Problem[] }}
 */
export function readParts(text, { lang: fallback = DEFAULT_DOC_LANG } = {}) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
  /** @type {Map<number, string>} */
  const why = new Map()
  /** @type {SpecPart[]} */
  const parts = []
  /** @type {HumanText[]} */
  const human = []
  let lang = ''
  /** @type {string[]} */
  let stray = []
  const flush = () => { const s = stray.join('\n').trim(); if (s) human.push({ text: s }); stray = [] }
  /** @param {string} word @returns {[boolean, string] | null} */
  const stateOf = (word) => {
    for (const l of langOrder(fallback)) {
      const p = STRINGS[l].marks.part
      if (word === p.active) return [true, l]
      if (word === p.retired) return [false, l]
    }
    return null
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const title = H1.exec(line)
    if (title && !parts.length && !lang) {
      const l = langOrder(fallback).find((x) => STRINGS[x].marks.parts === title[1].trim())
      if (l) { lang = l; continue }
    }
    if (CONFLICT_START.test(line)) {
      flush()
      const start = i
      while (i < lines.length - 1 && !CONFLICT_END.test(lines[i])) i++
      for (let k = start; k <= i; k++) why.set(k, 'conflict')
      human.push({ text: lines.slice(start, i + 1).join('\n') })
      continue
    }
    const hs = HUMAN_START.exec(line)
    if (hs) {
      flush()
      const start = i
      const inner = []
      let closed = false
      while (i + 1 < lines.length) {
        if (HUMAN_END.test(lines[i + 1])) { i++; closed = true; break }
        inner.push(lines[++i])
      }
      if (!closed) for (let k = start; k <= i; k++) if (lines[k].trim()) why.set(k, 'unclosed')
      /** @type {HumanText} */
      const h = { text: inner.join('\n').trim() }
      if (hs[1]) h.id = hs[1]
      human.push(h)
      continue
    }
    const m = PART_LINE.exec(line)
    if (m) {
      flush()
      const words = m[3] ? m[3].slice(3).split(' · ') : []
      const state = words.length ? stateOf(words[words.length - 1]) : null
      if (state) { words.pop(); if (!lang) lang = state[1] } else why.set(i, 'no-status')
      parts.push({ name: m[1], slug: m[2], type: words.shift() ?? '', description: words.join(' · '), active: state ? state[0] : true })
      continue
    }
    if (!line.trim()) { if (stray.length) stray.push(''); continue }
    why.set(i, 'stray')
    stray.push(line)
  }
  flush()
  lang ||= fallback
  return { lang, parts, human, problems: problemsOf(lines, writeParts({ lang, parts, human }), why) }
}
