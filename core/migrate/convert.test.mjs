import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mapToSpec } from './convert.mjs'

const fixture = (name) => JSON.parse(fs.readFileSync(new URL(`./migrate-fixtures/${name}`, import.meta.url), 'utf8'))
const small = () => fixture('small-map.json')

/** @param {any} doc */
const itemIds = (doc) => {
  const out = []
  const walk = (items) => { for (const it of items) { out.push(it.id); walk(it.items) } }
  walk(doc.items)
  for (const s of doc.sections) walk(s.items)
  return out
}

test('components become parts, documents become Spec documents under spec/, the system one at spec/SYSTEM.md', () => {
  const r = mapToSpec(small())
  assert.equal(r.lang, 'en')
  assert.deepEqual(r.parts, [
    { name: 'Web shop', slug: 'web', type: 'software', description: 'The pages customers see.', active: true },
    { name: 'API Server', slug: 'api-server', type: 'service', description: '', active: true },
  ])
  assert.deepEqual(r.docs.map((d) => [d.doc.id, d.doc.file, d.oldFile, d.doc.title]), [
    ['system', 'docs/product/spec/SYSTEM.md', 'docs/product/SYSTEM.md', 'Shop — Overview'],
    ['web/prd', 'docs/product/spec/web/PRD.md', 'docs/product/web/PRD.md', 'Shop — Web shop: Product'],
    ['web/tech', 'docs/product/spec/web/TECH.md', 'docs/product/web/TECH.md', 'Shop — Web shop: Technical design'],
    ['api-server/tech', 'docs/product/spec/api-server/TECH.md', 'docs/product/api-server/TECH.md', 'Shop — API Server: Technical design'],
  ])
})

test('a section keeps its id, title, prose, human paragraphs and progress; an item its id, status, impl, note and link, with origin C-1', () => {
  const sys = mapToSpec(small()).docs[0].doc
  const goal = sys.sections[0]
  assert.equal(goal.id, 't-goal')
  assert.equal(goal.title, 'Goal and stakeholders')
  assert.equal(goal.done, true)
  assert.equal(goal.prose, 'Sell things online.\n\nTo anyone.')
  assert.deepEqual(goal.human, [{ id: 'hp-1', text: "The human's own words." }])
  assert.deepEqual(goal.items[0], { id: 'd-goal', topic: 'A small web shop', status: 'decision', impl: 'done', origin: ['C-1'], note: 'First line.\nSecond line.', link: 'core/shop.mjs', items: [] })
  const ux = goal.items[1]
  assert.equal(ux.status, 'topic')
  assert.deepEqual(ux.items.map((i) => [i.id, i.status, i.impl ?? '']), [
    ['n-1', 'note', ''], ['x-1', 'excluded', ''], ['p-1', 'parked', 'missing'], ['i-1', 'inferred', 'done'],
    ['d-sub', 'decision', 'partial'],
  ])
  assert.equal(mapToSpec(small()).docs[2].doc.sections[0].done, false)
})

test('a todo pointing to an idea is dropped; any other todo is an open question; its children stay in its place', () => {
  const r = mapToSpec(small())
  assert.deepEqual(r.questions, [
    { id: 'q-1', topic: 'Do we need accounts?', note: 'Guests may be enough.', document: 'system', section: 'Goal and stakeholders' },
    { id: 'q-loose', topic: 'Ask the shop owners', document: 'web/prd', section: 'Ideas' },
  ])
  assert.deepEqual(r.dropped, [
    { id: 'q-idea', topic: 'Wish lists', idea: 'I-1' },
    { id: 'abc123', topic: 'Gift cards', idea: 'I-2' },
    { id: 'def456', topic: 'Coupons per document', idea: 'I-3' },
  ])
  const all = r.docs.flatMap((d) => itemIds(d.doc))
  for (const id of ['q-1', 'q-idea', 'abc123', 'def456', 'q-loose']) assert.ok(!all.includes(id), `${id} is not in the Spec`)
  assert.ok(all.includes('d-sub'), 'the child of a todo stays')
})

test('the from-ideas section goes away', () => {
  const prd = mapToSpec(small()).docs.find((d) => d.doc.id === 'web/prd').doc
  assert.deepEqual(prd.sections.map((s) => s.id), ['t-web-scope'])
})

test("the system document's roadmap section becomes milestones in order; the rest of it moves to the start of the document", () => {
  const r = mapToSpec(small())
  assert.equal(r.roadmap, 't-road')
  assert.deepEqual(r.milestones, [
    { n: 1, id: 'r-1', title: 'First release', note: 'The MVP.', impl: 'done' },
    { n: 2, id: 'r-2', title: 'Payments', impl: 'partial' },
    { n: 3, id: 'r-3', title: 'Reviews', link: 'https://example.com/reviews' },
  ])
  const sys = r.docs[0].doc
  assert.deepEqual(sys.sections.map((s) => s.id), ['t-goal'])
  assert.equal(sys.prose, 'The order of delivery.')
  assert.deepEqual(sys.human, [{ id: 'hp-r', text: 'Roadmap words of the human.' }])
  assert.deepEqual(sys.items.map((i) => [i.id, i.status, i.origin]), [['p-later', 'parked', ['C-1']]])
})

test('--roadmap names another section; none turns the milestones off; an unknown one is refused', () => {
  const r = mapToSpec(small(), { roadmap: 't-web-scope' })
  assert.deepEqual(r.milestones.map((m) => m.id), ['d-cart'])
  assert.ok(r.docs[0].doc.sections.some((s) => s.id === 't-road'))
  assert.deepEqual(mapToSpec(small(), { roadmap: 'none' }).milestones, [])
  assert.throws(() => mapToSpec(small(), { roadmap: 't-nope' }), /t-nope/)
})

test('ids: every node is a Spec id, or mapped to what it became', () => {
  const r = mapToSpec(small())
  const spec = new Set([...r.parts.map((p) => p.slug), ...r.docs.flatMap((d) => [d.doc.id, ...d.doc.sections.map((s) => s.id), ...itemIds(d.doc)])])
  const mapped = new Map(r.ids.map((x) => [x.from, x.to]))
  const nodes = []
  const walk = (n) => { nodes.push(n.id); (n.children ?? []).forEach(walk) }
  walk(small().nodeData)
  for (const id of nodes) assert.ok(spec.has(id) || mapped.has(id), `${id} survives`)
  assert.equal(mapped.get('c-web'), 'web')
  assert.equal(mapped.get('doc-api-tech'), 'api-server/tech')
  assert.equal(mapped.get('r-2'), 'M-2')
  assert.equal(mapped.get('abc123'), 'I-2')
  assert.equal(mapped.get('q-1'), 'questions')
})

test('split: the named branches leave the Spec and come back with their place, for a pending change', () => {
  const r = mapToSpec(small(), { split: ['d-cart', 't-api', 'c-web'] })
  assert.deepEqual(r.split.map((s) => [s.id, s.kind, s.target]), [
    ['d-cart', 'item', 'web/prd#t-web-scope'],
    ['t-api', 'section', 'api-server/tech'],
    ['c-web', 'part', 'web'],
  ])
  assert.deepEqual(r.split[0].item.origin, [])
  assert.deepEqual(r.docs.map((d) => d.doc.id), ['system', 'api-server/tech'])
  assert.deepEqual(r.docs[1].doc.sections, [])
  assert.deepEqual(r.parts.map((p) => p.slug), ['api-server'])
})

test("a map shaped like Groundwork's own: every node survives, and every document reads back as written", async () => {
  const { writeSpecDoc, readSpecDoc } = await import('../records/spec-format.mjs')
  const data = fixture('groundwork-map.json')
  const r = mapToSpec(data)
  assert.equal(r.lang, 'hu')
  assert.equal(r.parts.length, 8)
  assert.equal(r.docs.length, 15)
  assert.equal(r.docs[0].doc.id, 'system')
  assert.equal(r.roadmap, 't-roadmap')
  assert.equal(r.milestones.length, 9)
  assert.equal(r.milestones[8].title, 'Újratervezés: rekordmodell és futószalag (I-5)')
  assert.deepEqual(r.warnings, [])
  const spec = new Set([...r.parts.map((p) => p.slug), ...r.docs.flatMap((d) => [d.doc.id, ...d.doc.sections.map((s) => s.id), ...itemIds(d.doc)])])
  const mapped = new Set(r.ids.map((x) => x.from))
  const walk = (n) => {
    assert.ok(spec.has(n.id) || mapped.has(n.id), `${n.id} survives`)
    ;(n.children ?? []).forEach(walk)
  }
  walk(data.nodeData)
  const byId = new Map()
  for (const { doc } of r.docs) {
    const back = readSpecDoc(writeSpecDoc(doc), { file: doc.file })
    assert.deepEqual(back.problems, [], doc.id)
    assert.deepEqual(back.doc, doc, doc.id)
    const w = (items) => { for (const it of items) { byId.set(it.id, it); w(it.items) } }
    w(doc.items)
    for (const s of doc.sections) { byId.set(s.id, s); w(s.items) }
  }
  // the note, link and impl of every item, the prose and progress of every section, are there
  let items = 0, sections = 0
  const each = (n) => {
    const got = byId.get(n.id)
    if (got && 'topic' in got) {
      assert.equal(got.note, n.note, `${n.id} note`)
      assert.equal(got.link, n.hyperLink, `${n.id} link`)
      assert.equal(got.impl, n.metadata?.impl, `${n.id} impl`)
      items++
    } else if (got) {
      assert.equal(got.prose, n.metadata?.prose ?? '', `${n.id} prose`)
      assert.equal(got.done, n.metadata?.progress === 'done', `${n.id} progress`)
      sections++
    }
    ;(n.children ?? []).forEach(each)
  }
  each(data.nodeData)
  assert.ok(items > 300, `${items} items`)
  assert.equal(sections, 66)
})

test('what the Spec form cannot hold as it is, is kept another way and reported', () => {
  const data = small()
  const goal = data.nodeData.children[0].children[0]
  goal.metadata.prose = 'Steps:\n- one\n- two'
  goal.children[0].note = 'Options:\n- a\n- b'
  goal.note = 'A note on the section.'
  const r = mapToSpec(data)
  const s = r.docs[0].doc.sections[0]
  assert.equal(s.prose, '')
  assert.deepEqual(s.human.map((h) => h.text), ['Steps:\n- one\n- two\n\nA note on the section.', "The human's own words."])
  assert.equal(s.items[0].note, 'Options:\n\\- a\n\\- b')
  assert.equal(r.warnings.length, 2)
})
