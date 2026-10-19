// The ideas on disk. Each idea is one Markdown file under docs/product/ideas/items/, named
// I-012-<slug>.md: its fields in a front matter of flat `key: value` lines, its description below.
// It is in git, so the team sees it and decisions can be traced.
//
//   const store = openIdeas(root, files)   // files: the core's writer for this module (core/files.mjs)
//   store.list()          [{ id: 'I-12', n: 12, file, title, body, author, source, kind, status, created,
//                            impact?, effort?, rationale?, links? ['I-3'] }]
//                         in number order; [] without the folder
//   store.add({ title, body?, author?, source?, kind?, impact?, effort?, rationale?, links? })
//                         the new idea, as list() gives it. impact and effort: low|medium|high, with a
//                         one-line rationale; links: numbers of existing ideas it is similar to.
//
// The next number is the highest one in the folder plus one: numbers are never reused, as an idea
// is never deleted (a rejected one stays, in the Rejected column).

import fs from 'node:fs'
import path from 'node:path'
import { STATUSES, AUTHORS, KINDS, LEVELS, ideaId, fileName } from './fields.mjs'

export const ITEMS = 'docs/product/ideas/items'
const NUMBERED = /^I-(\d+)-.*\.md$/
// The fields in the order they are written; the description is the body, not a field.
const ORDER = ['title', 'author', 'source', 'kind', 'impact', 'effort', 'rationale', 'links', 'status', 'created']

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

  function list() {
    return names().map((f) => {
      const n = Number(NUMBERED.exec(f)[1])
      const { fields, body } = parse(files.read(`${ITEMS}/${f}`))
      if (fields.links != null) fields.links = fields.links.split(',').map((s) => s.trim()).filter(Boolean)
      return { ...fields, id: ideaId(n), n, file: `${ITEMS}/${f}`, title: fields.title || f, status: STATUSES.includes(fields.status) ? fields.status : 'new', body }
    }).sort((a, b) => a.n - b.n)
  }

  function add({ title, body = '', author = 'human', source = '', kind = 'product', impact, effort, rationale, links = [] } = {}) {
    title = String(title ?? '').replace(/\s+/g, ' ').trim()
    if (!title) throw new Error('an idea needs a title')
    check('author', author, AUTHORS)
    check('kind', kind, KINDS)
    if (impact != null) check('impact', impact, LEVELS)
    if (effort != null) check('effort', effort, LEVELS)
    const known = new Set(list().map((i) => i.id))
    for (const id of links) if (!known.has(id)) throw new Error(`no idea ${id} to link to`)
    const n = Math.max(0, ...names().map((f) => Number(NUMBERED.exec(f)[1]))) + 1
    const file = `${ITEMS}/${fileName(n, slugOf(title))}`
    const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
    const fields = { title, author, source: line(source), kind, impact, effort, rationale: line(rationale), links: links.length ? [...links] : undefined, status: 'new', created: new Date().toISOString().slice(0, 10) }
    files.write(file, serialize(fields, String(body)))
    return { ...fields, id: ideaId(n), n, file, body: String(body).trim() }
  }

  return { list, add }
}
