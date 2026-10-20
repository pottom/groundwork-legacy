// @ts-check
// A case record (an idea, later a change or a milestone) as one Markdown file: the source, in git.
//
//   ---
//   id: I-5                     the id stands here too, so renaming the file breaks nothing
//   title: Record model         the type's fields, in the type's order, then any other key
//   links: I-3, t-pipe          a list field: comma separated
//   ---
//
//   The body: free Markdown.
//
//   ## Történet                 the history: one line per lifecycle or link change, appended by the store
//
//   - 2026-10-20 · claude · created
//
//   writeRecord(record, type)  -> text      record: { id, fields, body, history: [line] }
//   readRecord(text, type)     -> record    id null when the front matter has none
//   fileName(prefix, n, slug)  'I-005-<slug>.md': the number padded to three digits
//   slugOf(title)              an ASCII slug, at most 48 characters
//   HISTORY_HEADING            'Történet'; the reader also takes 'History'
//
// The writer has one canonical form, and the reader reads it back exactly: read(write(x)) = x and
// write(read(write(x))) = write(x), byte for byte. The reader is patient with hand-edited files:
// CRLF, unknown keys and front-matter lines that are not `key: value` are kept (written back after
// the known fields), a file without front matter is all body. A value that would not read back the
// same as a plain line (a colon and space, a leading quote or dash, a line break, blanks at its
// ends) is written as a JSON string. The history heading is always written, last, so a body may
// even hold a heading of the same name: the last one starts the history.

/** @typedef {import('./types.mjs').RecordText} RecordText */
/** @typedef {import('./types.mjs').RecordFormat} RecordFormat */

export const HISTORY_HEADING = 'Történet'
const HISTORY_LINE = /^##\s+(Történet|History)\s*$/
const KEY_LINE = /^([A-Za-z][\w-]*):\s?(.*)$/
// A value written as it is: it reads back the same.
const PLAIN = /^[^\s"'[\]{}#&*!|>%@`,-][^\n]*$/

/** @param {string} s */
function value(s) {
  return PLAIN.test(s) && !/\s$/.test(s) && !/: |\s#/.test(s) ? s : JSON.stringify(s)
}

/** @param {string} raw */
function unquote(raw) {
  const v = raw.trim()
  if (!v.startsWith('"')) return v
  try { const s = JSON.parse(v); return typeof s === 'string' ? s : v } catch { return v }
}

/**
 * @param {RecordText} record
 * @param {RecordFormat} type
 * @returns {string}
 */
export function writeRecord(record, type) {
  const { fields = {}, body = '', history = [], stray = [] } = record
  const order = [...type.fields, ...Object.keys(fields).filter((k) => !type.fields.includes(k))]
  const lines = record.id ? [`id: ${record.id}`] : []
  for (const k of order) {
    const v = fields[k]
    if (v == null) continue
    const text = Array.isArray(v) ? v.join(', ') : String(v)
    if (text === '') continue
    lines.push(`${k}: ${value(text)}`)
  }
  lines.push(...stray)
  const parts = [`---\n${lines.join('\n')}\n---\n`]
  if (body.trim()) parts.push(`\n${body.trim()}\n`)
  parts.push(`\n## ${HISTORY_HEADING}\n`)
  if (history.length) parts.push(`\n${history.map((h) => `- ${h}`).join('\n')}\n`)
  return parts.join('')
}

/**
 * @param {string} text
 * @param {RecordFormat} type
 * @returns {RecordText}
 */
export function readRecord(text, type) {
  const lists = new Set(type.lists ?? [])
  text = text.replace(/\r\n/g, '\n')
  const m = /^---\n(?:([\s\S]*?)\n)?---[ \t]*(?:\n|$)([\s\S]*)$/.exec(text)
  /** @type {RecordText} */
  const record = { id: null, fields: {}, body: '', history: [] }
  const rest = m ? m[2] : text
  if (m) {
    /** @type {string[]} */
    const stray = []
    for (const line of (m[1] ?? '').split('\n')) {
      const kv = KEY_LINE.exec(line)
      if (!kv) { if (line.trim()) stray.push(line); continue }
      const v = unquote(kv[2])
      if (kv[1] === 'id' && record.id == null) record.id = v
      else record.fields[kv[1]] = lists.has(kv[1]) ? v.split(',').map((s) => s.trim()).filter(Boolean) : v
    }
    if (stray.length) record.stray = stray
  }
  const lines = rest.split('\n')
  let at = -1
  for (let i = lines.length - 1; i >= 0; i--) if (HISTORY_LINE.test(lines[i])) { at = i; break }
  record.body = (at < 0 ? rest : lines.slice(0, at).join('\n')).trim()
  if (at >= 0) record.history = lines.slice(at + 1).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[-*]\s+/, ''))
  return record
}

/** @param {string} prefix @param {number} n @param {string} slug */
export const fileName = (prefix, n, slug) => `${prefix}-${String(n).padStart(3, '0')}-${slug}.md`

/** "Gyors tabváltás!" -> "gyors-tabvaltas": ASCII, short, safe in a file name. @param {string} title */
export function slugOf(title) {
  const slug = String(title ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  return slug || 'record'
}
