// The patient reader on real broken Spec documents (spec-fixtures/): edited by hand or by an agent,
// with a deleted mark, a rewritten item line, free paragraphs, git conflict markers, an
// implementation an agent updated, and a document the old Plan generator wrote. No content is
// lost, every line that is not canonical is reported, and the next write only normalizes the form.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { readSpecDoc, writeSpecDoc } from './spec-format.mjs'
import { DOC_STRINGS } from './doc-strings.mjs'

const FILE = 'docs/product/spec/records/TECH.md'
const fixture = (name) => fs.readFileSync(new URL(`./spec-fixtures/${name}`, import.meta.url), 'utf8')
const FIXTURES = fs.readdirSync(new URL('./spec-fixtures/', import.meta.url)).filter((f) => f.endsWith('.md'))

// The words of the marks, in every language: the writer may put them in another language or order.
const MARK_WORDS = new Set(Object.values(DOC_STRINGS).flatMap((t) => [...Object.values(t.marks.status), ...Object.values(t.impl), ...t.marks.superseded.split(' ')]))
const words = (text) => new Set((text.match(/[\p{L}\p{N}][\p{L}\p{N}_.#-]*/gu) ?? []).filter((w) => !MARK_WORDS.has(w)))

/** Find an item anywhere in a document. */
function item(doc, id) {
  const walk = (items) => { for (const it of items) { if (it.id === id) return it; const c = walk(it.items); if (c) return c } return null }
  return walk(doc.items) ?? doc.sections.map((s) => walk(s.items)).find(Boolean) ?? null
}

for (const name of FIXTURES) {
  test(`${name}: no content is lost, every non-canonical line is reported, and a second write changes nothing`, () => {
    const text = fixture(name)
    const { doc, problems } = readSpecDoc(text, { file: FILE })
    const written = writeSpecDoc(doc)
    const lost = [...words(text)].filter((w) => !words(written).has(w))
    assert.deepEqual(lost, [], 'every word of the file is still there')
    const out = new Set(written.split('\n'))
    const reported = new Set(problems.map((p) => p.line))
    text.replace(/\r\n/g, '\n').split('\n').forEach((line, i) => {
      if (line.trim() && !out.has(line)) assert.ok(reported.has(i + 1), `line ${i + 1} is not written as it was, so it is reported: ${line}`)
    })
    for (const p of problems) assert.equal(p.text, text.split('\n')[p.line - 1])
    const again = readSpecDoc(written, { file: FILE })
    assert.equal(writeSpecDoc(again.doc), written, 'the normalized form is stable')
    assert.deepEqual(again.problems.filter((p) => p.why !== 'no-mark' && p.why !== 'unknown-mark'), [], 'only a missing id or an unknown mark is still reported')
  })
}

test('canonical.md has nothing to report', () => {
  const text = fixture('canonical.md')
  const { doc, problems } = readSpecDoc(text, { file: FILE })
  assert.deepEqual(problems, [])
  assert.equal(writeSpecDoc(doc), text)
})

test('a deleted mark: the heading is a section without an id, the item line an item without one, both reported', () => {
  const { doc, problems } = readSpecDoc(fixture('deleted-mark.md'), { file: FILE })
  assert.equal(doc.sections[0].id, '')
  assert.equal(doc.sections[0].title, 'Adatok és tárolás')
  assert.equal(doc.sections[0].items[0].id, '')
  assert.equal(doc.sections[0].items[0].topic, 'Minden rekord egyetlen Markdown-fájl · döntés · kész · C-1')
  assert.equal(doc.sections[0].items[0].note, 'Egy igazság, egy fájl.')
  assert.equal(item(doc, 'g-rec-ids').items[1].topic, 'Spec: rész = slug', 'the children stay under their group')
  assert.deepEqual(problems.map((p) => [p.line, p.why]), [[5, 'no-mark'], [9, 'no-mark'], [13, 'no-mark']])
})

test('a rewritten item line: marks in another order or language are read, an unknown one is kept', () => {
  const { doc, problems } = readSpecDoc(fixture('rewritten-item.md'), { file: FILE })
  assert.equal(doc.lang, 'hu')
  const md = item(doc, 'd-rec-md-source')
  assert.equal(md.topic, 'Minden rekord egyetlen Markdown-fájl, és ez a forrás')
  assert.equal(md.status, 'decision')
  assert.equal(md.impl, 'done')
  assert.deepEqual([item(doc, 'd-rec-ids').status, item(doc, 'd-rec-ids').impl], ['decision', 'partial'])
  assert.deepEqual(item(doc, 'd-rec-ids-spec').extra, ['sürgős'])
  assert.equal(item(doc, 'd-rec-write').status, 'decision', 'a line without a status reads as a decision')
  assert.deepEqual(problems.map((p) => [p.line, p.why]), [[9, 'form'], [12, 'form'], [13, 'unknown-mark'], [18, 'no-status']])
  const written = writeSpecDoc(doc)
  assert.match(written, /\n- Minden rekord egyetlen Markdown-fájl, és ez a forrás · `d-rec-md-source` · döntés · kész · C-1\n/)
  assert.match(written, /\n {2}- I-n, C-n, M-n: soha újra nem használt sorszám · `d-rec-ids` · döntés · részben · C-1, C-2\n/)
  assert.match(written, / · `d-rec-ids-spec` · döntés · hiányzik · C-2 · sürgős\n/)
})

test('free paragraphs between and after the items, and above the title, are kept as the human\'s text', () => {
  const { doc, problems } = readSpecDoc(fixture('free-paragraph.md'), { file: FILE })
  assert.deepEqual(doc.human, [{ text: 'Megjegyzés a cím fölött: ezt egy csapattárs írta.' }])
  assert.deepEqual(doc.sections[0].human, [{ text: 'Ezt a bekezdést valaki az elemek közé írta.' }, { text: 'És egy a végére is,\nkét sorban.' }])
  assert.deepEqual(doc.sections[0].items.map((i) => i.id), ['d-rec-md-source', 'g-rec-ids', 'x-rec-json-source'])
  assert.deepEqual(problems.map((p) => [p.line, p.why]), [[1, 'stray'], [14, 'stray'], [20, 'stray'], [21, 'stray']])
})

test('git conflict markers: both sides and the markers are kept as the human\'s text, not as items', () => {
  const { doc, problems } = readSpecDoc(fixture('conflict.md'), { file: FILE })
  const [conflict] = doc.sections[0].human
  assert.match(conflict.text, /^<<<<<<< HEAD\n[\s\S]*\n=======\n[\s\S]*\n>>>>>>> c-4-ids$/)
  assert.deepEqual(doc.sections[0].items.map((i) => i.id), ['d-rec-md-source', 'x-rec-json-source'])
  assert.deepEqual(problems.map((p) => p.why), Array(7).fill('conflict'))
  assert.deepEqual(problems.map((p) => p.line), [11, 12, 13, 14, 15, 16, 17])
})

test('an implementation an agent updated: another language is read and normalized, extra words kept', () => {
  const { doc, problems } = readSpecDoc(fixture('agent-impl.md'), { file: FILE })
  assert.equal(item(doc, 'd-rec-ids').impl, 'done')
  assert.deepEqual(item(doc, 'd-rec-ids-spec').extra, ['kész (#48)'])
  assert.match(item(doc, 'd-rec-ids-spec').note, /Implemented in core\/records\/spec-format\.mjs by the agent\.$/)
  assert.deepEqual(doc.sections[1].human, [{ text: 'Ennek a blokknak nincs vége, mert az agent kitörölte.' }])
  assert.deepEqual(problems.map((p) => [p.line, p.why]), [[16, 'form'], [17, 'unknown-mark'], [26, 'unclosed'], [27, 'unclosed']])
})

test('a document the old Plan generator wrote: its headings are sections without ids, its lists items without them', () => {
  const { doc, problems } = readSpecDoc(fixture('old-generated.md'), { file: FILE })
  assert.equal(doc.title, 'Groundwork — Rekordtár: Műszaki terv')
  assert.equal(doc.sections[0].title, '1. Architektúra és komponensek')
  assert.ok(doc.sections.every((s) => s.id === ''))
  assert.match(doc.human[0].text, /^<!-- generated by Groundwork Plan/)
  assert.ok(problems.some((p) => p.line === 1 && p.why === 'stray'))
  assert.ok(problems.filter((p) => p.why === 'no-mark').length > 50)
})
