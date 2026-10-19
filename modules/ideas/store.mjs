// The ideas on disk. Each idea is one Markdown file under docs/product/ideas/items/, named
// I-012-<slug>.md: its fields in a front matter of flat `key: value` lines, its description below.
// It is in git, so the team sees it and decisions can be traced.
//
//   const store = openIdeas(root, files)   // files: the core's writer for this module (core/files.mjs)
//   store.list()          [{ id: 'I-12', n: 12, file, version, title, body, author, source, kind, status,
//                            created, impact?, effort?, rationale?, reason?, links: ['I-3', '#42'] }]
//                         in number order; [] without the folder
//   store.add({ title, body?, author?, source?, kind?, impact?, effort?, rationale?, links? })
//                         the new idea, as list() gives it. impact and effort: low|medium|high, with a
//                         one-line rationale; links: numbers of existing ideas it is similar to.
//   store.update(id, { title?, body?, source?, kind?, impact?, effort?, rationale?, status?, reason?, links? }, { base? })
//                         the changed idea; throws on an unknown value, on Rejected without a reason,
//                         on an unknown id (code 'missing') and, when `base` is not the file's current
//                         `version`, without writing (code 'stale'): someone else saved in between
//
// The next number is the highest one in the folder plus one: numbers are never reused, as an idea
// is never deleted (a rejected one stays, in the Rejected column).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { STATUSES, AUTHORS, KINDS, LEVELS, ideaId, fileName } from './fields.mjs'

export const ITEMS = 'docs/product/ideas/items'
const NUMBERED = /^I-(\d+)-.*\.md$/
// The fields in the order they are written; the description is the body, not a field.
const ORDER = ['title', 'author', 'source', 'kind', 'impact', 'effort', 'rationale', 'links', 'status', 'reason', 'created']
// What an edit may change: everything but the number, the author and the date.
const EDITABLE = ['title', 'source', 'kind', 'impact', 'effort', 'rationale', 'links', 'status', 'reason']
// A value as one line: whitespace and line breaks collapse to single spaces.
const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()

// "Gyors tabváltás!" -> "gyors-tabvaltas": ASCII, short, safe in a file name.
export function slugOf(title) {
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '')
  return slug || 'idea'
}

// A value as one front-matter line: plain when it reads back the same, else a JSON string.
const PLAIN = /^[^\s"'[\]{}#&*!|>%@`,-][^\n]*$/
function value(v) {
  const s = String(v)
  return PLAIN.test(s) && !/\s$/.test(s) && !/: |\s#/.test(s) ? s : JSON.stringify(s)
}

export function serialize(fields, body) {
  const text = (v) => (Array.isArray(v) ? v.join(', ') : v)
  const lines = ORDER.filter((k) => fields[k] != null && text(fields[k]) !== '').map((k) => `${k}: ${value(text(fields[k]))}`)
  return `---\n${lines.join('\n')}\n---\n${body ? `\n${body.trim()}\n` : ''}`
}

export function parse(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text)
  if (!m) return { fields: {}, body: text.trim() }
  const fields = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line)
    if (!kv) continue
    let v = kv[2].trim()
    if (v.startsWith('"')) { try { v = JSON.parse(v) } catch { /* kept as written */ } }
    fields[kv[1]] = v
  }
  return { fields, body: m[2].trim() }
}

function check(name, v, allowed) {
  if (!allowed.includes(v)) throw new Error(`${name} must be one of ${allowed.join(', ')}, not ${v}`)
}

export function openIdeas(root, files) {
  const dir = path.join(root, ITEMS)
  const names = () => {
    try { return fs.readdirSync(dir).filter((f) => NUMBERED.test(f)) } catch { return [] }
  }

  const read = (f) => {
    const n = Number(NUMBERED.exec(f)[1])
    const text = files.read(`${ITEMS}/${f}`)
    const { fields, body } = parse(text)
    const version = crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)
    const links = String(fields.links ?? '').split(',').map((l) => l.trim()).filter(Boolean)
    return { ...fields, id: ideaId(n), n, file: `${ITEMS}/${f}`, version, title: fields.title || f, status: STATUSES.includes(fields.status) ? fields.status : 'new', links, body }
  }

  function list() {
    return names().map(read).sort((a, b) => a.n - b.n)
  }

  // The file of I-<n>, or null.
  const fileOf = (id) => {
    const m = /^I-(\d+)$/.exec(String(id))
    return m ? names().find((f) => Number(NUMBERED.exec(f)[1]) === Number(m[1])) ?? null : null
  }

  function update(id, changes = {}, { base } = {}) {
    const f = fileOf(id)
    if (!f) throw Object.assign(new Error(`no idea ${id}`), { code: 'missing' })
    const { id: _id, n: _n, file: _file, version, body: oldBody, ...old } = read(f)
    if (base != null && base !== version) throw Object.assign(new Error(`${id} changed since it was read`), { code: 'stale' })
    const next = { ...old }
    for (const k of EDITABLE) if (changes[k] !== undefined) next[k] = changes[k]
    for (const k of ['title', 'source', 'rationale', 'reason', 'impact', 'effort']) next[k] = line(next[k])
    if (!next.title) throw new Error('an idea needs a title')
    check('status', next.status, STATUSES)
    if (next.kind) check('kind', next.kind, KINDS)
    for (const k of ['impact', 'effort']) if (next[k]) check(k, next[k], LEVELS)
    if (!Array.isArray(next.links)) throw new Error('links must be a list')
    next.links = next.links.map((l) => String(l).replace(/,/g, ' ').trim()).filter(Boolean)
    if (next.status === 'rejected' && !next.reason) throw new Error('rejecting an idea needs a reason')
    if (next.status !== 'rejected') delete next.reason
    const body = changes.body !== undefined ? String(changes.body) : oldBody
    files.write(`${ITEMS}/${f}`, serialize(next, body))
    return read(f)
  }

  function add({ title, body = '', author = 'human', source = '', kind = 'product', impact, effort, rationale, links = [] } = {}) {
    title = line(title)
    if (!title) throw new Error('an idea needs a title')
    check('author', author, AUTHORS)
    check('kind', kind, KINDS)
    if (impact != null) check('impact', impact, LEVELS)
    if (effort != null) check('effort', effort, LEVELS)
    const known = new Set(list().map((i) => i.id))
    for (const id of links) if (!known.has(id)) throw new Error(`no idea ${id} to link to`)
    const n = Math.max(0, ...names().map((f) => Number(NUMBERED.exec(f)[1]))) + 1
    const file = `${ITEMS}/${fileName(n, slugOf(title))}`
    const fields = { title, author, source: line(source), kind, impact, effort, rationale: line(rationale), links: links.length ? [...links] : undefined, status: 'new', created: new Date().toISOString().slice(0, 10) }
    files.write(file, serialize(fields, String(body)))
    return read(path.posix.basename(file))
  }

  return { list, add, update }
}
