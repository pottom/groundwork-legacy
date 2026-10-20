// A case record's Markdown: front matter, body and the history list at the end, written and read
// back byte for byte (format.mjs).
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readRecord, writeRecord, fileName, slugOf, HISTORY_HEADING } from './format.mjs'

const IDEA = { prefix: 'I', fields: ['title', 'author', 'links', 'status', 'reason', 'created'], lists: ['links'] }

test('a record is its id and fields in the front matter, its body, then the history list', () => {
  const text = writeRecord({
    id: 'I-5', fields: { title: 'Record model', status: 'considering', links: ['I-3', 't-pipe'], created: '2026-10-20' },
    body: 'One store for every record.', history: ['2026-10-20 · claude · created'],
  }, IDEA)
  assert.equal(text, [
    '---', 'id: I-5', 'title: Record model', 'links: I-3, t-pipe', 'status: considering', 'created: 2026-10-20', '---', '',
    'One store for every record.', '', `## ${HISTORY_HEADING}`, '', '- 2026-10-20 · claude · created', '',
  ].join('\n'))
})

test('reading gives back what was written: fields, body, history', () => {
  const x = { id: 'I-5', fields: { title: 'Record model', status: 'new', links: ['I-3'] }, body: 'Body.\n\n## A heading of its own\n\nMore.', history: ['2026-10-20 · human · created', '2026-10-21 · claude · status: new → considering'] }
  assert.deepEqual(readRecord(writeRecord(x, IDEA), IDEA), x)
})

test('a record without a body or history still reads back the same', () => {
  const x = { id: 'I-1', fields: { title: 'Bare' }, body: '', history: [] }
  const text = writeRecord(x, IDEA)
  assert.deepEqual(readRecord(text, IDEA), x)
  assert.equal(writeRecord(readRecord(text, IDEA), IDEA), text)
})

test('values that would not read back plainly are quoted: colons, quotes, leading dashes, line breaks', () => {
  const tricky = ['a: b', '"quoted"', '- dash', 'trailing ', ' leading', 'x #y', 'two\nlines', '[list]', 'ő ű ✓', "it's"]
  for (const v of tricky) {
    const x = { id: 'I-2', fields: { title: v }, body: '', history: [] }
    assert.deepEqual(readRecord(writeRecord(x, IDEA), IDEA), x, JSON.stringify(v))
  }
})

test('the reader is patient: CRLF, unknown keys and stray front-matter lines are kept, a missing front matter is all body', () => {
  const text = '---\r\nid: I-3\r\ntitle: Old\r\nowner: team\r\nnot a field line\r\nstatus: rejected\r\n---\r\n\r\nBody.\r\n'
  const r = readRecord(text, IDEA)
  assert.deepEqual(r.fields, { title: 'Old', owner: 'team', status: 'rejected' })
  assert.equal(r.body, 'Body.')
  const again = writeRecord(r, IDEA)
  assert.match(again, /\nowner: team\n/)
  assert.match(again, /\nnot a field line\n/)
  assert.deepEqual(readRecord('Just text.', IDEA), { id: null, fields: {}, body: 'Just text.', history: [] })
})

test('the last history heading starts the history; an earlier one in the body stays body', () => {
  const x = { id: 'I-4', fields: { title: 'T' }, body: `## ${HISTORY_HEADING}\n\nnot the real one`, history: ['2026-10-20 · human · created'] }
  assert.deepEqual(readRecord(writeRecord(x, IDEA), IDEA), x)
})

test('file names carry the padded number and an ASCII slug; the id is the bare number', () => {
  assert.equal(fileName('I', 5, slugOf('Gyors tabváltás!')), 'I-005-gyors-tabvaltas.md')
  assert.equal(fileName('I', 1234, 'x'), 'I-1234-x.md')
  assert.equal(slugOf('***'), 'record')
})

// Round trip on generated records: read(write(x)) = x and write(read(write(x))) = write(x), byte for byte.
function rng(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
}
const PIECES = ['a', 'Z', ' ', ':', ': ', '"', "'", '#', ' #', '-', ',', '[', ']', '{', '\n', '\t', 'ő', 'é', '✓', '`', '*', '|', '>', '%', '@', '!', '&', '0', '9', '## Történet', '---', '\\']
function gen(next) {
  const str = (max) => Array.from({ length: Math.floor(next() * max) }, () => PIECES[Math.floor(next() * PIECES.length)]).join('')
  const fields = {}
  for (const k of ['title', 'author', 'status', 'reason', 'created', 'extra-key']) {
    const v = str(8)
    if (v !== '' && next() < 0.8) fields[k] = v
  }
  if (next() < 0.7) fields.links = Array.from({ length: 1 + Math.floor(next() * 3) }, (_, i) => `I-${i + Math.floor(next() * 50)}`)
  const body = str(40).trim()
  const history = Array.from({ length: Math.floor(next() * 4) }, () => `2026-10-${10 + Math.floor(next() * 20)} · ${next() < 0.5 ? 'human' : 'claude'} · ${str(6).replace(/\s+/g, ' ').trim() || 'created'}`)
  return { id: `I-${1 + Math.floor(next() * 999)}`, fields, body, history }
}

test('round trip on generated records, byte for byte', () => {
  const next = rng(47)
  for (let i = 0; i < 500; i++) {
    const x = gen(next)
    const text = writeRecord(x, IDEA)
    assert.deepEqual(readRecord(text, IDEA), x, text)
    assert.equal(writeRecord(readRecord(text, IDEA), IDEA), text)
  }
})
