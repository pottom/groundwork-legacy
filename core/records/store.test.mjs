// The core's record store (store.mjs): a module declares a type in its manifest's `records`, and
// the store lists, reads, numbers, writes and indexes its Markdown files.
// Run: node --test "core/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { openRecords } from './store.mjs'

const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-records-'))
const FOLDER = 'docs/product/things'
// A type of no real module: the store knows nothing about ideas.
const THING = {
  prefix: 'T', name: 'thing', folder: FOLDER,
  fields: ['title', 'refs', 'status', 'reason'], lists: ['refs'], links: ['refs'],
  lifecycle: { field: 'status', states: ['open', 'doing', 'done', 'dropped'], initial: 'open', claude: ['open', 'doing'] },
  rules(next) {
    if (!next.title) throw new Error('a thing needs a title')
    if (next.status === 'dropped' && !next.reason) throw new Error('dropping needs a reason')
    if (next.status !== 'dropped') delete next.reason
    return next
  },
}
const MODULE = { id: 'things', records: [THING] }
const open = (root, opts) => openRecords(root, [MODULE], { today: () => '2026-10-20', ...opts })
const tree = (root) => fs.readdirSync(root, { recursive: true }).map((f) => String(f).replaceAll('\\', '/')).sort()
const read = (root, file) => fs.readFileSync(path.join(root, file), 'utf8')

test('a module\'s records declaration is enough to create, list, read and update its records', () => {
  const root = project()
  const store = open(root)
  const made = store.create('T', { fields: { title: 'First thing' }, body: 'Why.' })
  assert.deepEqual([made.id, made.n, made.file, made.fields.status], ['T-1', 1, `${FOLDER}/T-001-first-thing.md`, 'open'])
  store.create('T', { fields: { title: 'Second', refs: ['T-1'] } })
  assert.deepEqual(open(root).list().map((r) => [r.id, r.fields.title]), [['T-1', 'First thing'], ['T-2', 'Second']])
  assert.equal(open(root).get('T-1').body, 'Why.')
  assert.equal(open(root).get('T-9'), null)
  const saved = store.update('T-1', { fields: { title: 'First thing, renamed', status: 'doing' }, body: 'Because.' })
  assert.deepEqual([saved.fields.title, saved.fields.status, saved.body], ['First thing, renamed', 'doing', 'Because.'])
  assert.equal(open(root).get('T-1').file, `${FOLDER}/T-001-first-thing.md`, 'the file keeps its name')
  assert.deepEqual(store.types().map((t) => t.prefix), ['T'])
})

test('the store writes only under docs/product/ and .groundwork/, and refuses a type folder elsewhere', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'X' } })
  store.update('T-1', { fields: { status: 'doing' } })
  assert.ok(tree(root).every((f) => /^(docs|docs\/product|docs\/product\/things(\/.*)?|\.groundwork(\/.*)?)$/.test(f)), tree(root).join(' '))
  for (const folder of ['src/things', '.groundwork/things', 'docs/product', '../docs/product/x', '/abs']) {
    assert.throws(() => openRecords(root, [{ id: 'm', records: [{ ...THING, folder }] }]), /docs\/product/, folder)
  }
  assert.throws(() => openRecords(root, [MODULE, { id: 'other', records: [{ ...THING, folder: 'docs/product/other' }] }]), /T/, 'one prefix, one type')
})

test('only record files count: other Markdown in the folder is not a record', () => {
  const root = project()
  fs.mkdirSync(path.join(root, FOLDER), { recursive: true })
  fs.writeFileSync(path.join(root, FOLDER, 'PRD.md'), '# A generated document\n')
  fs.writeFileSync(path.join(root, FOLDER, 'TECH.md'), '---\nid: T-40\n---\n')
  fs.writeFileSync(path.join(root, FOLDER, 'T-003-real.md'), '---\nid: T-3\ntitle: Real\nstatus: open\n---\n')
  assert.deepEqual(open(root).list().map((r) => r.id), ['T-3'])
  assert.equal(open(root).create('T', { fields: { title: 'Next' } }).id, 'T-4')
})

test('Claude moves a record only between the states its type allows; the human anywhere (and Claude is the default)', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'X' } })
  assert.equal(store.update('T-1', { fields: { status: 'doing' } }, { by: 'claude' }).fields.status, 'doing')
  for (const status of ['done', 'dropped']) {
    assert.throws(() => store.update('T-1', { fields: { status, reason: 'r' } }, { by: 'claude' }), (e) => e.code === 'forbidden' && /only a human/.test(e.message), status)
    assert.throws(() => store.update('T-1', { fields: { status, reason: 'r' } }), (e) => e.code === 'forbidden', `${status}, by default`)
  }
  assert.equal(store.get('T-1').fields.status, 'doing', 'a refused write writes nothing')
  assert.equal(store.update('T-1', { fields: { status: 'done' } }, { by: 'human' }).fields.status, 'done')
  assert.throws(() => store.update('T-1', { fields: { status: 'open' } }, { by: 'claude' }), (e) => e.code === 'forbidden', 'nor out of a human\'s state')
  assert.equal(store.update('T-1', { fields: { title: 'Y' } }, { by: 'claude' }).fields.title, 'Y', 'other fields Claude may still edit')
  assert.throws(() => store.update('T-1', { fields: { status: 'nonsense' } }, { by: 'human' }), /status/)
  assert.throws(() => store.create('T', { fields: { title: 'Z', status: 'done' } }, { by: 'claude' }), (e) => e.code === 'forbidden')
  assert.equal(store.create('T', { fields: { title: 'Z', status: 'done' } }, { by: 'human' }).fields.status, 'done')
})

test('the type\'s rules check every write', () => {
  const store = open(project())
  assert.throws(() => store.create('T', { fields: {} }), /title/)
  store.create('T', { fields: { title: 'X' } })
  assert.throws(() => store.update('T-1', { fields: { status: 'dropped' } }, { by: 'human' }), /reason/)
  assert.equal(store.update('T-1', { fields: { status: 'dropped', reason: 'No.' } }, { by: 'human' }).fields.reason, 'No.')
  assert.equal(store.update('T-1', { fields: { status: 'open' } }, { by: 'human' }).fields.reason, undefined)
  assert.throws(() => store.create('X', { fields: { title: 'X' } }), /X/)
  assert.throws(() => store.update('T-9', { fields: { title: 'X' } }), (e) => e.code === 'missing')
})

test('a write made on an older version of the file is refused', () => {
  const store = open(project())
  const seen = store.create('T', { fields: { title: 'X' } }).version
  store.update('T-1', { fields: { title: 'Meanwhile' } })
  assert.throws(() => store.update('T-1', { fields: { title: 'Lost' } }, { base: seen }), (e) => e.code === 'stale')
  assert.equal(store.get('T-1').fields.title, 'Meanwhile')
})

test('new numbers are never reused, also after a record is deleted', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'One' } })
  const two = store.create('T', { fields: { title: 'Two' } })
  fs.rmSync(path.join(root, two.file))
  assert.equal(open(root).create('T', { fields: { title: 'Three' } }).id, 'T-3')
})

test('a deleted number stays used even without the cache: a reference or git still knows it', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'One' } })
  const two = store.create('T', { fields: { title: 'Two' } })
  store.create('T', { fields: { title: 'Points at two', refs: ['T-2'] } })
  const three = store.get('T-3')
  fs.rmSync(path.join(root, two.file))
  fs.rmSync(path.join(root, '.groundwork'), { recursive: true })
  assert.equal(open(root).create('T', { fields: { title: 'Four' } }).id, 'T-4', 'T-3 refers to T-2')

  // a file that was in git and is gone, with nothing pointing at it
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' })
  git('init', '-q'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'x')
  const four = open(root).get('T-4')
  fs.rmSync(path.join(root, four.file))
  fs.rmSync(path.join(root, three.file))
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'gone')
  fs.rmSync(path.join(root, '.groundwork'), { recursive: true })
  assert.equal(open(root).create('T', { fields: { title: 'Five' } }).id, 'T-5')
})

test('every lifecycle or link change appends one history line; other edits none; the history survives a rewrite', () => {
  const root = project()
  const store = open(root)
  const made = store.create('T', { fields: { title: 'X' } }, { by: 'human' })
  assert.deepEqual(made.history, ['2026-10-20 · human · created'])
  store.update('T-1', { fields: { title: 'Renamed' }, body: 'New body.' })
  assert.equal(store.get('T-1').history.length, 1, 'a title or body edit is no event')
  store.update('T-1', { fields: { status: 'doing' } }, { by: 'claude' })
  store.update('T-1', { fields: { refs: ['T-7', 'x-1'] } }, { by: 'claude' })
  store.update('T-1', { fields: { status: 'dropped', reason: 'No.', refs: ['x-1'] } }, { by: 'human' })
  const { history } = open(root).get('T-1')
  assert.deepEqual(history, [
    '2026-10-20 · human · created',
    '2026-10-20 · claude · status: open → doing',
    '2026-10-20 · claude · refs: + T-7, x-1',
    '2026-10-20 · human · status: doing → dropped; refs: − T-7',
  ])
  // a hand edit of the body keeps the history, and the next write keeps both
  const file = path.join(root, store.get('T-1').file)
  fs.writeFileSync(file, read(root, store.get('T-1').file).replace('New body.', 'Edited by hand.'))
  store.update('T-1', { fields: { title: 'Again' } }, { by: 'human' })
  const after = open(root).get('T-1')
  assert.equal(after.body, 'Edited by hand.')
  assert.deepEqual(after.history, history)
  assert.match(read(root, after.file), /\n## Történet\n\n- 2026-10-20 · human · created\n/)
})

test('the id stands in the front matter, so a renamed file keeps it', () => {
  const root = project()
  const store = open(root)
  const made = store.create('T', { fields: { title: 'X' } })
  assert.match(read(root, made.file), /^---\nid: T-1\n/)
  fs.renameSync(path.join(root, made.file), path.join(root, FOLDER, 'T-001-a-better-name.md'))
  const r = open(root).get('T-1')
  assert.equal(r.file, `${FOLDER}/T-001-a-better-name.md`)
  assert.equal(open(root).update('T-1', { fields: { status: 'doing' } }).file, `${FOLDER}/T-001-a-better-name.md`)
})

test('deleting .groundwork/ loses nothing: the index is rebuilt from the Markdown', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'One' }, body: 'Body.' })
  store.create('T', { fields: { title: 'Two', refs: ['T-1'] } })
  store.update('T-1', { fields: { status: 'doing' } })
  const before = open(root).list()
  assert.ok(fs.existsSync(path.join(root, '.groundwork/records/index.json')))
  fs.rmSync(path.join(root, '.groundwork'), { recursive: true })
  assert.deepEqual(open(root).list(), before)
  assert.ok(fs.existsSync(path.join(root, '.groundwork/records/index.json')), 'rebuilt')
  assert.deepEqual(open(root).show('T-1').linkedFrom, ['T-2'])
})

test('a file edited by hand is read again, not taken from the cache', () => {
  const root = project()
  const store = open(root)
  const made = store.create('T', { fields: { title: 'One' } })
  store.list()
  fs.writeFileSync(path.join(root, made.file), read(root, made.file).replace('title: One', 'title: Edited outside'))
  assert.equal(open(root).get('T-1').fields.title, 'Edited outside')
})

test('show adds what is computed, reverse links and the body as safe HTML, which the file never holds', () => {
  const root = project()
  const store = open(root)
  store.create('T', { fields: { title: 'One' }, body: 'Hi <script>alert(1)</script> **bold** <img src=x onerror=alert(1)> [x](javascript:alert(1))' })
  store.create('T', { fields: { title: 'Two', refs: ['T-1'] } })
  store.create('T', { fields: { title: 'Three', refs: ['T-1', 'T-2'] } })
  const one = store.show('T-1')
  assert.deepEqual(one.linkedFrom, ['T-2', 'T-3'])
  assert.match(one.html, /<strong>bold<\/strong>/)
  assert.doesNotMatch(one.html, /<script|<img|javascript:/i)
  assert.equal(store.show('T-9'), null)
  assert.doesNotMatch(read(root, one.file), /linkedFrom|T-2|T-3/)
})
