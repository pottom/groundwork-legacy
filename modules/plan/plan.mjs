#!/usr/bin/env node
// Plan module: a live, human-editable mind map for grilling sessions that
// writes a PRD (PRD.md) as the interview goes. Its Claude skill is groundwork-prd-maker.
//
//   node modules/plan/plan.mjs init "<title>"   create mindmap.json in the current dir
//   node modules/plan/plan.mjs apply '<ops>'    apply a JSON op array (or pipe it on stdin)
//   node modules/plan/plan.mjs show             print the outline + pending human edits
//   node modules/plan/plan.mjs serve [--port N] serve the editor (default 4477)
//   node modules/plan/plan.mjs hook             UserPromptSubmit hook (reads hook JSON on stdin)
//
// The map lives in <dir>/docs/product/mindmap.json (Mind Elixir format). Edits made in the
// browser are diffed against the version the browser loaded, merged onto the
// current file, and logged to <dir>/.prd-maker/edits.jsonl until Claude reads them.
// Every write also regenerates the documents under <dir>/docs/product/ (see documents.mjs).

import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { setStatus, STATUSES } from './node-types.mjs'
import { buildPrd, toMarkdown, isGenerated, BASE_DIR, KINDS, COMPONENT_TYPES, listDocs, isSection } from './documents.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

function paths(dir) {
  return {
    base: path.join(dir, BASE_DIR),
    map: path.join(dir, BASE_DIR, 'mindmap.json'),
    doc: (file) => path.join(dir, BASE_DIR, file),
    glossary: path.join(dir, 'GLOSSARY.md'), // owned by domain-modeling: read and link only
    state: path.join(dir, '.prd-maker'),
    edits: path.join(dir, '.prd-maker', 'edits.jsonl'),
    history: path.join(dir, '.prd-maker', 'edits-history.jsonl'),
    written: path.join(dir, '.prd-maker', 'written.json'),
  }
}

// ---------- tree helpers ----------

function walk(node, fn, parent = null) {
  fn(node, parent)
  for (const c of node.children || []) walk(c, fn, node)
}

function index(data) {
  const m = new Map()
  walk(data.nodeData, (node, parent) => m.set(node.id, { node, parent }))
  return m
}

function isAncestor(m, maybeAncestorId, id) {
  for (let cur = m.get(id)?.parent; cur; cur = m.get(cur.id)?.parent) {
    if (cur.id === maybeAncestorId) return true
  }
  return false
}

const newId = () => crypto.randomBytes(6).toString('hex')

// Ops:
//   {op:'add', id?, parent, topic, status?, note?, link?, impl?, doc?, component?, dir?, file?}
//     component: a type ('software', 'service', 'infra', 'shared', ...) makes a main topic a component
//     dir:       optional folder name for a component's documents, instead of one made from its topic
//     doc:       a kind ('system', 'prd', 'tech', 'service', 'process', 'infra', 'ops', 'rollout', ...)
//                makes the node a document; its children are the sections
//     file:      optional file name for a document, instead of the kind's default
//   {op:'set', id, topic?, status?, note?, link?, impl?, prose?, progress?, human?}
//     impl:     'done' | 'partial' | 'missing' | '' how far the implementation is
//     prose:    Claude's Markdown text for a PRD section (main topics only)
//     progress: 'done' | '' for a PRD section
//     human:    [{id, text}] the human's own paragraphs (only replayed from browser edits)
//   {op:'move', id, parent}
//   {op:'remove', id}
function applyOps(data, ops, by) {
  const errors = []
  for (const op of ops) {
    const m = index(data)
    const entry = m.get(op.id)
    switch (op.op) {
      case 'add': {
        if (op.id && entry) { errors.push(`add: id ${op.id} already exists`); break }
        const parent = m.get(op.parent)?.node ?? data.nodeData
        const node = { id: op.id || newId(), topic: op.topic ?? '' }
        if (op.note) node.note = op.note
        if (op.link) node.hyperLink = op.link
        if (op.status) setStatus(node, op.status)
        if (op.impl) node.metadata = { ...(node.metadata || {}), impl: op.impl }
        for (const k of ['doc', 'component', 'dir', 'file']) if (op[k]) node.metadata = { ...(node.metadata || {}), [k]: op[k] }
        if (by) node.metadata = { ...(node.metadata || {}), by }
        ;(parent.children ||= []).push(node)
        break
      }
      case 'set': {
        if (!entry) { errors.push(`set: no node ${op.id}`); break }
        const n = entry.node
        if (op.topic !== undefined) n.topic = op.topic
        if (op.status !== undefined) setStatus(n, op.status)
        if (op.note !== undefined) { if (op.note) n.note = op.note; else delete n.note }
        if (op.link !== undefined) { if (op.link) n.hyperLink = op.link; else delete n.hyperLink }
        for (const [k, field] of [['doc', 'doc'], ['component', 'component'], ['dir', 'dir'], ['file', 'file'], ['impl', 'impl'], ['prose', 'prose'], ['progress', 'progress'], ['human', 'humanProse']]) {
          if (op[k] === undefined) continue
          n.metadata = { ...(n.metadata || {}) }
          const empty = op[k] === '' || (Array.isArray(op[k]) && !op[k].length)
          if (empty) delete n.metadata[field]; else n.metadata[field] = op[k]
        }
        break
      }
      case 'move': {
        const target = m.get(op.parent)?.node
        if (!entry || !entry.parent) { errors.push(`move: no movable node ${op.id}`); break }
        if (!target) { errors.push(`move: no parent ${op.parent}`); break }
        if (op.parent === op.id || isAncestor(m, op.id, op.parent)) { errors.push(`move: ${op.id} into its own subtree`); break }
        entry.parent.children = entry.parent.children.filter((c) => c.id !== op.id)
        ;(target.children ||= []).push(entry.node)
        break
      }
      case 'remove': {
        if (!entry) break // already gone, e.g. an ancestor was removed first
        if (!entry.parent) { errors.push('remove: cannot remove the root'); break }
        entry.parent.children = entry.parent.children.filter((c) => c.id !== op.id)
        break
      }
      default:
        errors.push(`unknown op ${JSON.stringify(op)}`)
    }
  }
  return errors
}

function flat(data) {
  const m = new Map()
  walk(data.nodeData, (n, p) => m.set(n.id, {
    topic: n.topic, parent: p?.id ?? null, status: n.metadata?.status, note: n.note, link: n.hyperLink,
    impl: n.metadata?.impl, prose: n.metadata?.prose, progress: n.metadata?.progress,
    human: n.metadata?.humanProse?.length ? JSON.stringify(n.metadata.humanProse) : undefined,
  }))
  return m
}

// Ops that turn `a` into `b` (by node id). Sibling order is not tracked.
function diff(a, b) {
  const A = flat(a), B = flat(b), ops = []
  walk(b.nodeData, (n, p) => {
    if (!A.has(n.id)) ops.push(clean({ op: 'add', id: n.id, parent: p?.id, topic: n.topic, status: n.metadata?.status, note: n.note, link: n.hyperLink }))
  })
  for (const [id, x] of B) {
    const y = A.get(id)
    if (!y) continue
    const set = {}
    for (const k of ['topic', 'status', 'note', 'link', 'impl', 'prose', 'progress']) if (x[k] !== y[k]) set[k] = x[k] ?? ''
    if (x.human !== y.human) set.human = x.human ? JSON.parse(x.human) : []
    if (Object.keys(set).length) ops.push({ op: 'set', id, ...set, was: y.topic })
    if (x.parent !== y.parent && x.parent) ops.push({ op: 'move', id, parent: x.parent, topic: x.topic })
  }
  for (const [id, y] of A) if (!B.has(id)) ops.push({ op: 'remove', id, topic: y.topic })
  return ops
}

function clean(o) {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

// ---------- file io ----------

const hash = (text) => crypto.createHash('sha1').update(text).digest('hex').slice(0, 12)

function readMap(P) {
  const text = fs.readFileSync(P.map, 'utf8')
  return { v: hash(text), text, data: JSON.parse(text) }
}

function writeAtomic(file, text) {
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, text)
  fs.renameSync(tmp, file)
}

function writeMap(P, data) {
  const text = JSON.stringify(data, null, 2) + '\n'
  writeAtomic(P.map, text)
  writePrd(P, data)
  return hash(text)
}

const isOurs = (file) => fs.existsSync(file) && isGenerated(fs.readFileSync(file, 'utf8'))

// Writes every document of the map under docs/product/, and removes documents
// it generated earlier that are gone from the map. Never touches a file
// the Plan module did not generate (e.g. a hand-written PRD.md).
function writePrd(P, data) {
  const docs = listDocs(data)
  const glossary = fs.existsSync(P.glossary)
  for (const doc of docs) {
    const file = P.doc(doc.file)
    if (fs.existsSync(file) && !isOurs(file)) {
      writePrd.warned ||= new Set()
      if (!writePrd.warned.has(file)) console.error(`plan: ${file} was not generated by the Plan module, leaving it alone`)
      writePrd.warned.add(file)
      continue
    }
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const siblings = docs.filter((d) => d !== doc)
    writeAtomic(file, toMarkdown(buildPrd(data, doc.id), { glossary, siblings }))
  }
  let before = []
  try { before = JSON.parse(fs.readFileSync(P.written, 'utf8')) } catch {}
  const now = docs.map((d) => d.file)
  for (const old of before) if (!now.includes(old) && isOurs(P.doc(old))) fs.unlinkSync(P.doc(old))
  fs.mkdirSync(P.state, { recursive: true })
  fs.writeFileSync(P.written, JSON.stringify(now, null, 2))
}

function logHumanEdits(P, ops) {
  if (!ops.length) return
  fs.mkdirSync(P.state, { recursive: true })
  const ts = new Date().toISOString()
  fs.appendFileSync(P.edits, ops.map((o) => JSON.stringify({ ts, ...o })).join('\n') + '\n')
}

// Reads pending human edits, collapses them per node, and moves them to history.
function takeHumanEdits(P) {
  if (!fs.existsSync(P.edits)) return []
  const text = fs.readFileSync(P.edits, 'utf8')
  fs.appendFileSync(P.history, text)
  fs.writeFileSync(P.edits, '')
  const ops = text.split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return collapse(ops)
}

// add+set -> add, add+remove -> nothing, set+set -> set
function collapse(ops) {
  const out = []
  const byId = new Map()
  for (const op of ops) {
    const prev = byId.get(op.id)
    if (prev && prev.op === 'add' && op.op === 'set') { Object.assign(prev, pick(op, EDIT_KEYS)); continue }
    if (prev && prev.op === 'add' && op.op === 'remove') { out.splice(out.indexOf(prev), 1); byId.delete(op.id); continue }
    if (prev && prev.op === 'set' && op.op === 'set') { Object.assign(prev, pick(op, EDIT_KEYS)); continue }
    out.push(op)
    if (op.op !== 'move') byId.set(op.id, op)
  }
  return out
}

const EDIT_KEYS = ['topic', 'status', 'note', 'link', 'impl', 'prose', 'progress', 'human']
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))

// ---------- text output ----------

function outline(data) {
  const lines = []
  const sections = new Set()
  walk(data.nodeData, (n) => { if (isSection(data, n.id)) sections.add(n.id) })
  const rec = (n, depth) => {
    const st = n.metadata?.status ? ` (${n.metadata.status}${n.metadata.impl ? `, impl: ${n.metadata.impl}` : ''}${n.metadata.by === 'human' ? ', by human' : ''})` : ''
    const m = n.metadata || {}
    const prd = m.doc ? [`document → ${BASE_DIR}/${listDocs(data).find((d) => d.id === n.id)?.file}`] : m.component ? [`component: ${m.component}`] : sections.has(n.id) ? [
      `section: ${m.progress === 'done' ? 'done' : m.prose ? 'has prose' : 'no prose yet'}`,
      m.humanProse?.length && `${m.humanProse.length} human paragraph(s)`,
    ] : []
    const extra = [n.hyperLink && `link: ${n.hyperLink}`, n.note && `note: ${n.note}`, ...prd].filter(Boolean).join('; ')
    lines.push(`${'  '.repeat(depth)}[${n.id}] ${n.topic}${st}${extra ? ` — ${extra}` : ''}`)
    for (const c of n.children || []) rec(c, depth + 1)
  }
  rec(data.nodeData, 0)
  return lines.join('\n')
}

function describeEdits(ops, data) {
  const m = index(data)
  const name = (id) => (m.get(id) ? `[${id}] "${m.get(id).node.topic}"` : `[${id}]`)
  return ops.map((o) => {
    switch (o.op) {
      case 'add': return `- added ${name(o.id)} under ${name(o.parent)}${o.status ? ` with status ${o.status}` : ''}`
      case 'set': {
        const parts = []
        if ('topic' in o) parts.push(`renamed "${o.was}" → "${o.topic}"`)
        if ('status' in o) parts.push(`status → ${o.status || '(none)'}`)
        if ('note' in o) parts.push(`note → "${o.note}"`)
        if ('link' in o) parts.push(`link → ${o.link}`)
        if ('impl' in o) parts.push(`implementation → ${o.impl || '(unknown)'}`)
        if ('progress' in o) parts.push(`PRD progress → ${o.progress || '(open)'}`)
        if ('prose' in o) parts.push(o.prose ? 'your PRD text changed' : 'your PRD text was removed (the human took it over, see below)')
        let line = `- ${name(o.id)}: ${parts.join(', ')}`
        if ('human' in o) {
          line += `${parts.length ? '\n  ' : ''}the human's own PRD paragraphs in this section are now:`
          line += o.human.length ? o.human.map((h) => `\n    > ${h.text.replace(/\n/g, '\n    > ')}`).join('') : ' (none)'
        }
        return line
      }
      case 'move': return `- moved ${name(o.id)} under ${name(o.parent)}`
      case 'remove': return `- removed [${o.id}] "${o.topic}" (and its subtree)`
      default: return `- ${JSON.stringify(o)}`
    }
  }).join('\n')
}

function editsBlock(P, data) {
  const ops = takeHumanEdits(P)
  if (!ops.length) return ''
  return 'The human edited the mind map in the browser since you last looked. These edits are authoritative:\n' +
    describeEdits(ops, data)
}

// ---------- commands ----------

// A fresh map holds only the root: the first grilling round decides what
// components and documents the project needs.
function cmdInit(dir, title, force) {
  const P = paths(dir)
  if (fs.existsSync(P.map) && !force) die(`${P.map} already exists (use --force to overwrite)`)
  fs.mkdirSync(P.state, { recursive: true })
  fs.mkdirSync(P.base, { recursive: true })
  writeMap(P, { nodeData: { id: 'root', topic: title || 'Grilling', children: [] }, direction: 1 })
  console.log(`created ${P.map}`)
}

function cmdApply(dir, arg) {
  const P = paths(dir)
  const raw = arg ?? fs.readFileSync(0, 'utf8')
  let ops = JSON.parse(raw)
  if (!Array.isArray(ops)) ops = [ops]
  const { data } = readMap(P)
  const errors = applyOps(data, ops)
  writeMap(P, data)
  if (errors.length) console.log('errors:\n' + errors.map((e) => '  ' + e).join('\n'))
  const edits = editsBlock(P, data)
  if (edits) console.log(edits + '\n')
  console.log(outline(data))
}

function cmdShow(dir) {
  const P = paths(dir)
  const { data } = readMap(P)
  const edits = editsBlock(P, data)
  if (edits) console.log(edits + '\n')
  console.log(outline(data))
}

function cmdHook() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
    const dir = input.cwd || process.cwd()
    const P = paths(dir)
    const out = []
    if (/grill/i.test(input.prompt || '')) {
      out.push('This project draws grilling sessions on a live mind map: load the `groundwork-prd-maker` skill alongside the grilling skill.')
    }
    if (fs.existsSync(P.map)) {
      const edits = editsBlock(P, readMap(P).data)
      if (edits) out.push(edits)
    }
    if (out.length) console.log(out.join('\n\n'))
  } catch (e) {
    console.error(`mindmap hook: ${e.message}`)
  }
}

function cmdServe(dir, port) {
  const P = paths(dir)
  const seen = new Map() // version -> text, so a browser save can be diffed against what it loaded
  const remember = (v, text) => {
    seen.set(v, text)
    if (seen.size > 200) seen.delete(seen.keys().next().value)
  }
  const send = (res, code, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(typeof body === 'string' ? body : JSON.stringify(body))
  }
  const files = { '/': 'index.html', '/index.html': 'index.html', '/node-types.mjs': 'node-types.mjs', '/documents.mjs': 'documents.mjs' }
  const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' }

  http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    try {
      if (req.method === 'GET' && files[url.pathname]) {
        const f = path.join(HERE, files[url.pathname])
        return send(res, 200, fs.readFileSync(f, 'utf8'), types[path.extname(f)])
      }
      if (url.pathname === '/api/glossary' && req.method === 'GET') {
        return send(res, 200, { text: fs.existsSync(P.glossary) ? fs.readFileSync(P.glossary, 'utf8') : '' })
      }
      if (url.pathname === '/api/map' && req.method === 'GET') {
        if (!fs.existsSync(P.map)) return send(res, 404, { error: `no mindmap.json in ${dir}` })
        const cur = readMap(P)
        remember(cur.v, cur.text)
        if (url.searchParams.get('v') === cur.v) return send(res, 200, { v: cur.v, same: true })
        return send(res, 200, { v: cur.v, data: cur.data })
      }
      if (url.pathname === '/api/map' && req.method === 'PUT') {
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          try {
            const { base, data } = JSON.parse(body)
            delete data.theme // presentation lives in index.html, not in the map file
            const sent = JSON.stringify(data) // `data` may be mutated below
            const cur = readMap(P)
            const baseData = seen.has(base) ? JSON.parse(seen.get(base)) : cur.data
            const ops = diff(baseData, data)
            // Nodes the human adds without a status become "ask about this".
            for (const o of ops) if (o.op === 'add' && !o.status) o.status = 'todo'
            let next
            if (base === cur.v) {
              next = data // nobody else wrote meanwhile: keep the browser's exact layout
              const m = index(next)
              for (const o of ops) if (o.op === 'add') {
                const n = m.get(o.id).node
                if (!n.metadata?.status) setStatus(n, o.status)
                n.metadata = { ...n.metadata, by: 'human' }
              }
            } else {
              next = cur.data // Claude wrote meanwhile: replay the human's changes onto it
              applyOps(next, ops, 'human')
            }
            const v = writeMap(P, next)
            remember(v, JSON.stringify(next, null, 2) + '\n')
            logHumanEdits(P, ops)
            send(res, 200, { v, data: next, changed: JSON.stringify(next) !== sent })
          } catch (e) {
            send(res, 400, { error: e.message })
          }
        })
        return
      }
      send(res, 404, { error: 'not found' })
    } catch (e) {
      send(res, 500, { error: e.message })
    }
  }).listen(port, () => console.log(`plan: http://localhost:${port}  (file: ${P.map})`))
}

function die(msg) {
  console.error(msg)
  process.exit(1)
}

const [cmd, ...rest] = process.argv.slice(2)
const dir = process.env.MINDMAP_DIR || process.cwd()
const flag = (name, def) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : def }

switch (cmd) {
  case 'init': cmdInit(dir, rest.find((a) => !a.startsWith('--')), rest.includes('--force')); break
  case 'apply': cmdApply(dir, rest[0]); break
  case 'show': cmdShow(dir); break
  case 'serve': cmdServe(dir, Number(flag('--port', process.env.PORT || 4477))); break
  case 'hook': cmdHook(); break
  default: die('usage: plan.mjs init "<title>" | apply \'<ops json>\' | show | serve [--port N] | hook\n' +
    `statuses: ${Object.keys(STATUSES).join(', ')}\ndocument kinds: ${Object.keys(KINDS).join(', ')}\ncomponent types: ${Object.keys(COMPONENT_TYPES).join(', ')}`)
}
