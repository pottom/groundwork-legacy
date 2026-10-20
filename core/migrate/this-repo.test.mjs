// This repository after `groundwork migrate` (#54): the old map (migrate-fixtures/groundwork-map.json,
// a byte copy of the docs/product/mindmap.json it had) and the old GitHub tickets
// (migrate-fixtures/groundwork-tickets.json: number, state, milestone, title, body, as `gh issue list`
// gave them) against the records the repo holds now. Nothing is lost: every node of the map is a
// Spec id, an item a pending change proposes or an old id a merged change lists, with its note,
// link, human paragraphs and impl; the tickets' PRD lines name the same items, and Build's checks
// (against Plan's GET /api/plan/ids) give what they gave on the old map.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixture } from './project.test-helper.mjs'
import { openRecords } from '../records/store.mjs'
import { CORE_RECORDS } from '../records/changes.mjs'
import { checkRecords } from '../records/check.mjs'
import { MODULES } from '../modules.mjs'
import { startServer } from '../server.mjs'
import { nodeIds } from '../../modules/plan/map-store.mjs'
import { listDocs } from '../../modules/plan/documents.mjs'
import { readTickets } from '../../modules/build/ticket-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const MAP = JSON.parse(fixture('groundwork-map.json'))
const TICKETS = JSON.parse(fixture('groundwork-tickets.json'))
const OLD = TICKETS.filter((t) => t.number <= 46)
const C2_TICKETS = TICKETS.filter((t) => t.number >= 47 && t.number <= 54)
const store = () => openRecords(ROOT, [...MODULES, CORE_RECORDS])

const nodes = []
const walk = (n, parent = null) => { nodes.push({ n, parent }); (n.children ?? []).forEach((c) => walk(c, n)) }
walk(MAP.nodeData)
const prdIds = (body) => {
  const line = /^\*\*PRD:\*\*(.*)$/m.exec(body)?.[1] ?? ''
  return line.replace(/\([^)]*\)/g, '').split(',').map((s) => s.trim().replace(/`/g, '')).filter((s) => /^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u.test(s) && /[-_\d]/.test(s))
}

test('the old map is gone from docs/product/; the Spec, the changes and the milestones are there', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'docs/product/mindmap.json')), false)
  assert.equal(fs.existsSync(path.join(ROOT, 'docs/product/ideas/items')), false, 'the ideas moved to docs/product/ideas/')
  const s = store()
  assert.ok(s.spec.docs().length > 0)
  assert.deepEqual(s.list('I').map((r) => r.id), ['I-1', 'I-2', 'I-3', 'I-4', 'I-5'])
})

test('every node of the old map is there, with its note, link, human paragraphs and impl', () => {
  assert.equal(nodes.length, 423)
  const s = store()
  let checked = 0
  for (const { n } of nodes) {
    const r = s.resolve(n.id)
    assert.ok(r, `${n.id} resolves`)
    const m = n.metadata ?? {}
    const human = (m.humanProse ?? []).map((h) => h.text)
    if (r.kind === 'spec' && r.found.kind === 'item') {
      const it = r.found.item
      assert.equal(it.topic, n.topic, `${n.id} topic`)
      assert.equal(it.note, n.note, `${n.id} note`)
      assert.equal(it.link, n.hyperLink, `${n.id} link`)
      assert.equal(it.impl, m.impl, `${n.id} impl`)
      checked++
    } else if (r.kind === 'spec' && r.found.kind === 'section') {
      const sec = r.found.section
      assert.equal(sec.title, n.topic, `${n.id} title`)
      assert.equal(sec.prose, [m.prose, n.note].filter(Boolean).join('\n\n'), `${n.id} prose`)
      assert.equal(sec.done, m.progress === 'done', `${n.id} progress`)
      for (const h of human) assert.ok(sec.human.some((x) => x.text === h), `${n.id} human paragraph`)
      checked++
    } else if (r.kind === 'proposed') {
      const { item, change } = r
      assert.equal(item.op, 'add')
      assert.ok(String(item.text).includes(n.topic), `${n.id} topic in ${change.id}`)
      const note = item.note ?? ''
      if (n.note) assert.ok(note.includes(n.note.split('\n')[0]), `${n.id} note in ${change.id}`)
      if (n.hyperLink) assert.ok(note.includes(`<${n.hyperLink}>`), `${n.id} link in ${change.id}`)
      if (m.prose) assert.ok(note.includes(m.prose.split('\n')[0]), `${n.id} prose in ${change.id}`)
      for (const h of human) assert.ok(note.includes(h.split('\n')[0]), `${n.id} human paragraph in ${change.id}`)
      assert.equal(m.impl, undefined, `${n.id}: a proposed item comes in as missing, so the old one had none`)
      checked++
    } else {
      assert.equal(r.kind, 'alias', `${n.id} is an old id C-1 lists`)
      if (r.to) assert.ok(r.target, `${n.id} → ${r.to} resolves`)
      else assert.ok(r.note, `${n.id} became nothing, and C-1 says why`)
      if (m.component) {
        const part = r.target.kind === 'spec' ? r.target.found.part : null
        const proposed = r.target.kind === 'proposed' ? r.target.item.text : null
        assert.ok(part ? part.name === n.topic : String(proposed).startsWith(n.topic), `${n.id} part name`)
      }
      if (/^r-\d+$/.test(n.id)) assert.equal(r.target.record.fields.title, n.topic.replace(/^\d+\.\s+/, ''), `${n.id} milestone title`)
    }
  }
  assert.ok(checked > 380, `${checked} items and sections checked`)
})

test('C-2…C-5 are pending under M-9 with I-5; M-1…M-7 are done, M-8 and M-9 in progress', () => {
  const s = store()
  assert.equal(s.get('C-1').fields.status, 'done')
  const titles = ['Rekordtár és Markdown-forrás', 'Változások', 'Spec munkaterület', 'Jegyek és Áttekintés']
  titles.forEach((title, i) => {
    const c = s.get(`C-${i + 2}`)
    assert.deepEqual([c.fields.title, c.fields.status, c.fields.milestone, c.fields.ideas], [title, 'awaiting-approval', 'M-9', ['I-5']])
  })
  assert.deepEqual(s.list('M').map((m) => m.fields.status), ['done', 'done', 'done', 'done', 'done', 'done', 'done', 'in-progress', 'in-progress'])
  assert.equal(s.get('M-9').fields.title, 'Újratervezés: rekordmodell és futószalag (I-5)')
})

test('the ids on the C-2 tickets (#47–#54) resolve', () => {
  const s = store()
  assert.equal(C2_TICKETS.length, 8)
  for (const t of C2_TICKETS) for (const id of prdIds(t.body)) assert.ok(s.resolve(id), `#${t.number}: ${id}`)
})

test("the old tickets' PRD lines name the same items, and Build's checks give what they gave on the old map", async () => {
  assert.equal(OLD.length, 46)
  const s = store()
  const old = new Set(nodeIds(MAP))
  for (const t of OLD) {
    for (const id of prdIds(t.body)) {
      if (!old.has(id)) { assert.equal(s.resolve(id), null, `#${t.number}: ${id} was unknown and still is`); continue }
      const r = s.resolve(id)
      assert.ok(r, `#${t.number}: ${id}`)
      assert.equal(r.id, id)
      if (r.kind === 'spec' && r.found.kind === 'item') assert.equal(r.found.item.topic, nodes.find((x) => x.n.id === id).n.topic)
    }
  }
  const issues = OLD.map((t) => ({ number: t.number, title: t.title, state: t.state, stateReason: null, labels: [], milestone: t.milestone, body: t.body, blockedBy: null }))
  const checks = (mapIds) => readTickets({ name: 'groundwork', github: { repo: 'pottom/groundwork', issues }, mapIds }).problems
    .filter((p) => p.kind === 'unknown-prd' || p.kind === 'no-prd').map((p) => `${p.kind} #${p.tickets[0].issue} ${p.params.list ?? ''}`)
  const srv = await startServer({ root: ROOT, modules: MODULES, port: 0 })
  try {
    const res = await fetch(`http://127.0.0.1:${srv.port}/api/plan/ids`)
    assert.equal(res.status, 200)
    const { ids } = await res.json()
    assert.deepEqual(checks(ids), checks([...old]))
  } finally {
    await srv.close()
  }
})

test('record check passes on this repo', () => {
  assert.deepEqual(checkRecords(store()).findings.map((f) => `${f.file}:${f.line}: ${f.rule}: ${f.message}`), [])
})

test('no Markdown file links to an old document path, or into docs/product/ where nothing is', () => {
  const oldPaths = [...listDocs(MAP).map((d) => `docs/product/${d.file}`), 'docs/product/ideas/items/']
  const skip = new Set(['node_modules', '.git', '.groundwork', '.scratch', 'worktrees', 'migrate-fixtures', 'spec-fixtures'])
  const md = []
  const each = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (skip.has(e.name)) continue
      const rel = dir ? `${dir}/${e.name}` : e.name
      if (e.isDirectory()) each(rel)
      else if (e.name.endsWith('.md')) md.push(rel)
    }
  }
  each('')
  const bad = []
  for (const file of md) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].replace(/#.*$/, '')
      if (!target || /^[a-z]+:/i.test(target) || target.startsWith('/') || target.includes('{')) continue
      const rel = path.relative(ROOT, path.resolve(path.join(ROOT, path.dirname(file)), decodeURI(target))).split(path.sep).join('/')
      if (rel.startsWith('docs/product/') && !fs.existsSync(path.join(ROOT, rel))) bad.push(`${file}: ${m[1]}`)
    }
    // the Spec and the changes say what was true then (C-1's items, a change's history); the rest of
    // the repo (READMEs, skills, docs) names only the paths of today
    if (file.startsWith('docs/product/spec/') || file.startsWith('docs/product/changes/')) continue
    for (const p of oldPaths) if (text.includes(p)) bad.push(`${file}: ${p}`)
  }
  assert.deepEqual(bad, [])
})
