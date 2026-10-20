// A Spec document as canonical Markdown (spec-format.mjs): the form the store writes, read back byte
// for byte, and the patient reader that keeps whatever does not fit and reports it.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSpecDoc, writeSpecDoc, readParts, writeParts, docIdOf } from './spec-format.mjs'

const FILE = 'docs/product/spec/core/TECH.md'

/** A Spec document with every kind of content: prose, human paragraphs, groups, items, notes, links. */
const DOC = {
  id: 'core/tech', part: 'core', kind: 'tech', file: FILE, lang: 'hu', title: 'Mag: Műszaki terv',
  prose: '', human: [], items: [],
  sections: [
    {
      id: 't-stack', title: 'Technológiai stack', done: true,
      prose: 'Node, függőség nélkül.\n\nMásodik bekezdés.',
      human: [{ id: 'hp-1', text: 'Az ember bekezdése.' }],
      items: [
        { id: 'd-npm', topic: 'npm-csomag', status: 'decision', impl: 'done', origin: ['C-1'], note: 'npx-szel fut.', link: 'core/groundwork.mjs', items: [] },
        { id: 'g-ui', topic: 'Felület', status: 'topic', origin: ['C-1'], items: [
          { id: 'd-lit', topic: 'lit-html', status: 'decision', impl: 'partial', origin: ['C-1', 'C-7'], items: [] },
          { id: 'd-react', topic: 'React', status: 'decision', origin: ['C-1'], supersededBy: 'C-9', items: [] },
        ] },
        { id: 'x-build', topic: 'Build-lépés', status: 'excluded', origin: ['C-2'], note: 'Két sor\njegyzet.', items: [] },
      ],
    },
    { id: 't-sec', title: 'Biztonság', done: false, prose: '', human: [], items: [] },
  ],
}

const TEXT = [
  '# Mag: Műszaki terv',
  '',
  '_Műszaki terv_',
  '',
  '## Technológiai stack {#t-stack .done}',
  '',
  'Node, függőség nélkül.',
  '',
  'Második bekezdés.',
  '',
  '<!-- human: hp-1 -->',
  'Az ember bekezdése.',
  '<!-- /human -->',
  '',
  '- npm-csomag · `d-npm` · döntés · kész · C-1',
  '  npx-szel fut.',
  '  [core/groundwork.mjs](../../../../core/groundwork.mjs)',
  '- **Felület** · `g-ui` · C-1',
  '  - lit-html · `d-lit` · döntés · részben · C-1, C-7',
  '  - React · `d-react` · döntés · C-1 · felváltotta: C-9',
  '- Build-lépés · `x-build` · kizárt · C-2',
  '  Két sor',
  '  jegyzet.',
  '',
  '## Biztonság {#t-sec}',
  '',
].join('\n')

test('a Spec document is written in one canonical form: marked sections, item lines with id, status, implementation and origin', () => {
  assert.equal(writeSpecDoc(DOC), TEXT)
})

test('the canonical form reads back to the same document, with nothing to report', () => {
  const { doc, problems } = readSpecDoc(TEXT, { file: FILE })
  assert.deepEqual(doc, DOC)
  assert.deepEqual(problems, [])
})

test('the document id comes from its path: spec/<part>/<KIND>.md is part/kind, spec/SYSTEM.md is system', () => {
  assert.deepEqual(docIdOf('docs/product/spec/core/TECH.md'), { id: 'core/tech', part: 'core', kind: 'tech' })
  assert.deepEqual(docIdOf('docs/product/spec/ideas/OPERATIONS.md'), { id: 'ideas/ops', part: 'ideas', kind: 'ops' })
  assert.deepEqual(docIdOf('docs/product/spec/SYSTEM.md'), { id: 'system', part: null, kind: 'system' })
  assert.equal(docIdOf('docs/product/spec/parts.md'), null)
  assert.equal(docIdOf('docs/product/ideas/I-001-x.md'), null)
})

test('spec/parts.md lists the parts, one line each: name, slug, type, one sentence, active or retired', () => {
  const list = {
    lang: 'hu',
    parts: [
      { name: 'Mag', slug: 'core', type: 'software', description: 'A szerver, a tár · és a héj.', active: true },
      { name: 'Plan modul', slug: 'plan', type: 'software', description: 'A gondolattérkép.', active: false },
      { name: 'Közös', slug: 'shared', type: 'shared', description: '', active: true },
    ],
    human: [{ text: 'Az ember megjegyzése.' }],
  }
  const text = writeParts(list)
  assert.equal(text, [
    '# Részek', '',
    '- Mag · `core` · software · A szerver, a tár · és a héj. · aktív',
    '- Plan modul · `plan` · software · A gondolattérkép. · kivezetett',
    '- Közös · `shared` · shared · aktív', '',
    '<!-- human -->', 'Az ember megjegyzése.', '<!-- /human -->', '',
  ].join('\n'))
  const back = readParts(text)
  assert.deepEqual({ lang: back.lang, parts: back.parts, human: back.human }, list)
  assert.deepEqual(back.problems, [])
  const en = writeParts({ ...list, lang: 'en' })
  assert.match(en, /^# Parts\n/)
  assert.match(en, / · retired\n/)
  assert.equal(readParts(en).lang, 'en')
})

test('a broken parts list keeps every line: a free line is human text, a line without its state is reported', () => {
  const { parts, human, problems } = readParts('# Részek\n\n- Mag · `core` · software · A mag.\nEgy szabad sor.\n')
  assert.deepEqual(parts, [{ name: 'Mag', slug: 'core', type: 'software', description: 'A mag.', active: true }])
  assert.deepEqual(human, [{ text: 'Egy szabad sor.' }])
  assert.deepEqual(problems.map((p) => [p.line, p.why]), [[3, 'no-status'], [4, 'stray']])
})

// ---------- random documents ----------

// A small seeded generator, so a failure can be run again.
function random(seed) {
  let s = seed >>> 0
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const int = (n) => Math.floor(next() * n)
  const pick = (xs) => xs[int(xs.length)]
  return { next, int, pick }
}

const WORDS = ['tár', 'rekord', 'Spec', 'ötlet', 'a · b', 'C-7', 'd-npm', '`kód`', '**félkövér**', 'x: y', '— gondolat', '(zárójel)', 'ű', 'line', 'és', '#hash', 'done', 'kész', '[x]']
const KIND_FILES = { system: 'SYSTEM.md', prd: 'PRD.md', tech: 'TECH.md', service: 'SERVICE.md', process: 'PROCESS.md', infra: 'INFRA.md', ops: 'OPERATIONS.md', rollout: 'ROLLOUT.md' }
const STATUSES = ['decision', 'note', 'excluded', 'parked', 'inferred', 'todo', 'topic']

function randomDoc(seed) {
  const r = random(seed)
  let n = 0
  const id = (p) => `${p}-${seed}-${++n}`
  const words = (k) => Array.from({ length: 1 + r.int(k) }, () => r.pick(WORDS)).join(' ')
  // Text that is a paragraph: no line that would read as a heading, list or mark.
  const para = () => Array.from({ length: 1 + r.int(3) }, () => 'Szöveg ' + words(6)).join(r.next() < 0.5 ? '\n' : '\n\n')
  // The human's text may hold anything but a section heading and the end of its block.
  const human = () => Array.from({ length: r.int(3) }, () => {
    const h = { text: r.next() < 0.3 ? `- lista ${words(3)}\n\n### alcím\n  behúzva` : para() }
    if (r.next() < 0.5) h.id = id('hp')
    return h
  })
  const item = (depth) => {
    const status = r.pick(STATUSES)
    const it = { id: id(status === 'topic' ? 'g' : 'd'), topic: words(5), status, origin: r.next() < 0.8 ? Array.from({ length: 1 + r.int(3) }, () => `C-${1 + r.int(20)}`) : [], items: [] }
    if (r.next() < 0.5) it.impl = r.pick(['done', 'partial', 'missing'])
    if (r.next() < 0.2) it.supersededBy = `C-${1 + r.int(20)}`
    if (r.next() < 0.4) it.note = Array.from({ length: 1 + r.int(3) }, () => words(4)).join(r.next() < 0.3 ? '\n\n' : '\n')
    if (r.next() < 0.3) it.link = r.pick(['core/x.mjs', 'https://example.com/a', 'docs/product/ideas/I-001-x.md', '#anchor'])
    if (depth < 3 && r.next() < 0.4) it.items = Array.from({ length: 1 + r.int(3) }, () => item(depth + 1))
    return it
  }
  const lang = ['hu', 'en'][seed % 2]
  const kind = Object.keys(KIND_FILES)[Math.floor(seed / 2) % 8]
  const part = kind === 'system' ? null : r.pick(['core', 'ideas', 'records'])
  const file = part ? `docs/product/spec/${part}/${KIND_FILES[kind]}` : 'docs/product/spec/SYSTEM.md'
  return {
    id: part ? `${part}/${kind}` : 'system', part, kind, file, lang, title: words(4),
    prose: r.next() < 0.2 ? para() : '', human: r.next() < 0.2 ? human() : [], items: r.next() < 0.1 ? [item(0)] : [],
    sections: Array.from({ length: r.int(6) }, () => ({
      id: id('t'), title: words(4), done: r.next() < 0.5,
      prose: r.next() < 0.6 ? para() : '', human: human(), items: Array.from({ length: r.int(5) }, () => item(0)),
    })),
  }
}

test('round trip byte for byte on 500 random documents of every kind, in both languages', () => {
  const kinds = new Set()
  for (let seed = 1; seed <= 500; seed++) {
    const x = randomDoc(seed)
    kinds.add(`${x.kind}/${x.lang}`)
    const text = writeSpecDoc(x)
    const { doc, problems } = readSpecDoc(text, { file: x.file })
    assert.deepEqual(doc, x, `seed ${seed}`)
    assert.deepEqual(problems, [], `seed ${seed}`)
    assert.equal(writeSpecDoc(doc), text, `seed ${seed}`)
  }
  assert.equal(kinds.size, Object.keys(KIND_FILES).length * 2, 'every kind in both languages')
})
