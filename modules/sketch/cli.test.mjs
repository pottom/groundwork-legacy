// `groundwork sketch show` and `groundwork sketch apply`, run as processes through the package's bin:
// what Claude reads of a sketch, and how it draws on it (f-board-claude-read, f-board-claude-draw).
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCommand } from '../../core/cli-process.test-helper.mjs'

const BIN = fileURLToPath(new URL('../../core/groundwork.mjs', import.meta.url))
const FILE = (name = 'main') => path.join('docs', 'product', 'sketches', `${name}.excalidraw`)
const project = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gw-sketch-cli-'))
const sketch = (cwd, ...args) => runCommand(process.execPath, [BIN, 'sketch', ...args], { cwd })
const apply = (cwd, ops, name = 'main') => sketch(cwd, 'apply', name, JSON.stringify(ops))
const fileOf = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, FILE(name)), 'utf8'))
const live = (dir, name) => fileOf(dir, name).elements.filter((e) => !e.isDeleted)
const byId = (dir, id, name) => fileOf(dir, name).elements.find((e) => e.id === id)

test('apply draws labelled shapes, a text and an arrow between two shapes, as a standard .excalidraw file', async () => {
  const dir = project()
  const r = await apply(dir, [
    { op: 'add', type: 'rectangle', id: 'api', x: 0, y: 0, label: 'API' },
    { op: 'add', type: 'ellipse', id: 'db', x: 400, y: 0, width: 160, height: 80, label: 'Database' },
    { op: 'add', type: 'arrow', id: 'reads', from: 'api', to: 'db', label: 'reads' },
    { op: 'add', type: 'text', id: 'note', x: 0, y: 200, text: 'A note' },
  ])
  assert.equal(r.code, 0, r.stderr)
  const file = fileOf(dir)
  assert.equal(file.type, 'excalidraw')
  assert.equal(file.version, 2)
  const api = byId(dir, 'api'), db = byId(dir, 'db'), arrow = byId(dir, 'reads')
  assert.equal(api.type, 'rectangle')
  assert.equal(db.type, 'ellipse')
  assert.deepEqual([db.x, db.y, db.width, db.height], [400, 0, 160, 80])
  const label = file.elements.find((e) => e.type === 'text' && e.containerId === 'api')
  assert.equal(label.text, 'API')
  assert.ok(api.boundElements.some((b) => b.id === label.id && b.type === 'text'), 'the label is bound to its shape')
  assert.equal(arrow.type, 'arrow')
  assert.equal(arrow.startBinding.elementId, 'api')
  assert.equal(arrow.endBinding.elementId, 'db')
  assert.ok(api.boundElements.some((b) => b.id === 'reads') && db.boundElements.some((b) => b.id === 'reads'))
  const [start, end] = [arrow.points[0], arrow.points.at(-1)].map(([px, py]) => [arrow.x + px, arrow.y + py])
  assert.ok(start[0] >= api.x + api.width - 1 && end[0] <= db.x + 1, 'the arrow runs from the edge of one shape to the other')
  assert.equal(file.elements.find((e) => e.containerId === 'reads').text, 'reads')
  assert.equal(byId(dir, 'note').text, 'A note')
  for (const e of file.elements) {
    assert.ok(Number.isInteger(e.version) && Number.isInteger(e.versionNonce) && Number.isInteger(e.seed), e.id)
    assert.equal(e.isDeleted, false)
  }
})

test('show prints a digest Claude can reason about: ids, kinds, labels, places and connections', async () => {
  const dir = project()
  await apply(dir, [
    { op: 'add', type: 'rectangle', id: 'api', x: 0, y: 0, width: 120, height: 60, label: 'API' },
    { op: 'add', type: 'diamond', id: 'ok', x: 300, y: 0, label: 'Valid?' },
    { op: 'add', type: 'arrow', id: 'a1', from: 'api', to: 'ok', label: 'checks' },
    { op: 'add', type: 'text', id: 'note', x: 0, y: 200, text: 'Draft' },
  ])
  const r = await sketch(dir, 'show', 'main')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /^rectangle api "API" at 0,0 size 120x60$/m)
  assert.match(r.stdout, /^diamond ok "Valid\?" at 300,0/m)
  assert.match(r.stdout, /^arrow a1 "checks": api "API" -> ok "Valid\?"$/m)
  assert.match(r.stdout, /^text note "Draft" at 0,200$/m)
  assert.doesNotMatch(r.stdout, /containerId|versionNonce/, 'labels show on their shape, not as texts of their own')
})

test('list prints the sketches\' names, and apply draws on the one it names', async () => {
  const dir = project()
  assert.equal((await apply(dir, [{ op: 'add', type: 'rectangle', x: 0, y: 0 }], 'flows')).code, 0)
  assert.equal((await apply(dir, [{ op: 'add', type: 'rectangle', x: 0, y: 0 }], 'main')).code, 0)
  const r = await sketch(dir, 'list')
  assert.equal(r.code, 0, r.stderr)
  assert.deepEqual(r.stdout.trim().split(/\r?\n/), ['flows', 'main'])
})

test('show of a sketch not drawn yet says it is empty', async () => {
  const r = await sketch(project(), 'show', 'main')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /empty/i)
})

test('apply moves, updates and deletes; a moved shape takes its label and its arrows with it', async () => {
  const dir = project()
  await apply(dir, [
    { op: 'add', type: 'rectangle', id: 'a', x: 0, y: 0, width: 100, height: 50, label: 'A' },
    { op: 'add', type: 'rectangle', id: 'b', x: 300, y: 0, width: 100, height: 50, label: 'B' },
    { op: 'add', type: 'arrow', id: 'ab', from: 'a', to: 'b' },
  ])
  const before = { b: byId(dir, 'b'), ab: byId(dir, 'ab') }
  const r = await apply(dir, [
    { op: 'move', id: 'b', x: 300, y: 200 },
    { op: 'update', id: 'a', label: 'Start', strokeColor: '#e03131' },
  ])
  assert.equal(r.code, 0, r.stderr)
  const b = byId(dir, 'b'), ab = byId(dir, 'ab'), a = byId(dir, 'a')
  assert.equal(b.y, 200)
  assert.ok(b.version > before.b.version, 'an edit raises the version, so it wins a merge')
  assert.ok(ab.version > before.ab.version)
  const end = ab.points.at(-1)
  assert.ok(ab.y + end[1] > 150, 'the arrow follows the moved shape')
  assert.equal(fileOf(dir).elements.find((e) => e.containerId === 'b').y > 150, true, 'the label moved too')
  assert.equal(fileOf(dir).elements.find((e) => e.containerId === 'a').text, 'Start')
  assert.equal(a.strokeColor, '#e03131')

  assert.equal((await apply(dir, [{ op: 'delete', id: 'a' }])).code, 0)
  const ids = live(dir).map((e) => e.id)
  assert.ok(!ids.includes('a') && !live(dir).some((e) => e.containerId === 'a'), 'the shape and its label are gone')
  assert.equal(byId(dir, 'a').isDeleted, true, 'kept as deleted, so a stale page cannot bring it back')
  assert.equal(byId(dir, 'ab').startBinding, null, 'the arrow stays, no longer bound to it')
})

test('fontFamily and fontSize set a text, and on a shape or an arrow they set its label; a free line through more points has sharp corners', async () => {
  const dir = project()
  const r = await apply(dir, [
    { op: 'add', type: 'rectangle', id: 'a', x: 0, y: 0, label: 'A', fontFamily: 2, fontSize: 16 },
    { op: 'add', type: 'rectangle', id: 'b', x: 300, y: 0, label: 'B' },
    { op: 'add', type: 'arrow', id: 'ab', from: 'a', to: 'b', label: 'goes', fontFamily: 2 },
    { op: 'add', type: 'text', id: 't', x: 0, y: 200, text: 'Note', fontFamily: 2 },
    { op: 'update', id: 'b', fontFamily: 2, fontSize: 28 },
  ])
  assert.equal(r.code, 0, r.stderr)
  const label = (id) => fileOf(dir).elements.find((e) => e.containerId === id)
  assert.deepEqual([label('a').fontFamily, label('a').fontSize], [2, 16])
  assert.deepEqual([label('b').fontFamily, label('b').fontSize], [2, 28])
  assert.equal(label('ab').fontFamily, 2)
  assert.equal(byId(dir, 't').fontFamily, 2)
  assert.equal(byId(dir, 'a').fontFamily, undefined, 'the shape itself has no font')
  assert.equal((await apply(dir, [{ op: 'update', id: 'a', label: 'One\nTwo' }])).code, 0)
  const two = label('a')
  assert.equal(two.height - two.baseline, Math.round(16 * 0.35), 'the baseline is that of the last line, so Excalidraw draws every line inside the shape')
  assert.equal((await apply(dir, [{ op: 'add', type: 'arrow', id: 'el', points: [[0, 0], [0, 50], [80, 50]] }])).code, 0)
  assert.equal(byId(dir, 'el').roundness, null, 'a free line through three points turns at sharp corners')
  assert.ok(byId(dir, 'ab').roundness, 'a two-point arrow keeps its curve')
  const bad = await apply(dir, [{ op: 'update', id: 't', fontFamily: 9 }])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /fontFamily/)
})

test('apply reads its ops from stdin too', async () => {
  const dir = project()
  const r = await runCommand(process.execPath, [BIN, 'sketch', 'apply', 'main'], { cwd: dir, input: JSON.stringify([{ op: 'add', type: 'rectangle', id: 'r', x: 0, y: 0 }]) })
  assert.equal(r.code, 0, r.stderr)
  assert.ok(byId(dir, 'r'))
})

test('a wrong call or a wrong op stops with a message and exit code 1, writing nothing', async () => {
  const dir = project()
  for (const args of [['nonsense'], ['show', '../x'], ['apply', 'main', 'not json'], ['apply', 'main', '[{"op":"fly"}]'],
    ['apply', 'main', '[{"op":"move","id":"nope","x":1,"y":1}]'], ['apply', 'main', '[{"op":"add","type":"blob","x":0,"y":0}]'],
    ['apply', 'main', '[{"op":"add","type":"rectangle","id":"r","x":0,"y":0},{"op":"add","type":"arrow","from":"r","to":"missing"}]']]) {
    const r = await sketch(dir, ...args)
    assert.equal(r.code, 1, args.join(' '))
    assert.match(r.stderr, /\S/)
  }
  assert.equal(fs.existsSync(path.join(dir, 'docs')), false, 'an apply with one wrong op writes none of them')
})

test('apply keeps what the page drew meanwhile: an element it does not know about stays', async () => {
  const dir = project()
  await apply(dir, [{ op: 'add', type: 'rectangle', id: 'mine', x: 0, y: 0 }])
  const file = fileOf(dir)
  file.elements.push({ ...file.elements[0], id: 'drawn-in-browser', x: 500, version: 3 })
  fs.writeFileSync(path.join(dir, FILE()), JSON.stringify(file))
  assert.equal((await apply(dir, [{ op: 'move', id: 'mine', x: 50, y: 0 }])).code, 0)
  assert.deepEqual(live(dir).map((e) => e.id).sort(), ['drawn-in-browser', 'mine'])
})

test('apply draws a Mermaid flowchart: its nodes as shapes, its edges as bound arrows, laid out in layers', async () => {
  const dir = project()
  const r = await apply(dir, [{ op: 'mermaid', x: 0, y: 0, source: [
    'flowchart TD',
    '  start([Start]) --> check{Valid?}',
    '  check -->|yes| save[Save it]',
    '  check -. no .-> err((Error))',
    '  save --> done[Done] & log[Log]',
    '%% a comment',
  ].join('\n') }])
  assert.equal(r.code, 0, r.stderr)
  const show = (await sketch(dir, 'show', 'main')).stdout
  assert.match(show, /^rectangle start "Start" at /m)
  assert.match(show, /^diamond check "Valid\?" at /m)
  assert.match(show, /^ellipse err "Error" at /m)
  assert.match(show, /^arrow \S+: start "Start" -> check "Valid\?"$/m)
  assert.match(show, /^arrow \S+ "yes": check "Valid\?" -> save "Save it"$/m)
  assert.match(show, /^arrow \S+ "no": check "Valid\?" -> err "Error"$/m)
  assert.match(show, /^arrow \S+: save "Save it" -> done "Done"$/m)
  assert.match(show, /^arrow \S+: save "Save it" -> log "Log"$/m)
  const y = (id) => byId(dir, id).y + byId(dir, id).height / 2, x = (id) => byId(dir, id).x
  assert.ok(y('start') < y('check') && y('check') < y('save') && y('save') < y('done'), 'top down, one layer per step')
  assert.equal(y('save'), y('err'), 'siblings share a layer')
  assert.notEqual(x('save'), x('err'), 'side by side')
  assert.equal(y('done'), y('log'))
  assert.equal(fileOf(dir).elements.find((e) => e.type === 'arrow' && e.endBinding?.elementId === 'err').strokeStyle, 'dashed')
})

test('a left-to-right flowchart runs left to right; one that is not a flowchart is refused', async () => {
  const dir = project()
  assert.equal((await apply(dir, [{ op: 'mermaid', source: 'graph LR\n  a[A] --> b[B]\n  b --> a' }])).code, 0)
  assert.ok(byId(dir, 'a').x < byId(dir, 'b').x)
  assert.equal(byId(dir, 'a').y + byId(dir, 'a').height / 2, byId(dir, 'b').y + byId(dir, 'b').height / 2)
  const bad = await apply(project(), [{ op: 'mermaid', source: 'sequenceDiagram\n  A->>B: hi' }])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /flowchart/)
})

// Threads pinned to shapes (f-board-threads): Claude reads and answers them.
const THREADS = (dir, name = 'main') => JSON.parse(fs.readFileSync(path.join(dir, 'docs', 'product', 'sketches', `${name}.threads.json`), 'utf8')).threads

test('comment pins a thread to a shape as Claude; threads prints every thread with its comments; close and reopen', async () => {
  const dir = project()
  await apply(dir, [{ op: 'add', type: 'rectangle', id: 'api', x: 0, y: 0, label: 'API' }])
  assert.match((await sketch(dir, 'threads', 'main')).stdout, /no threads/i)
  const r = await sketch(dir, 'comment', 'main', 'api', 'Should this be a queue?')
  assert.equal(r.code, 0, r.stderr)
  assert.equal(THREADS(dir).api.comments[0].author, 'Claude')
  assert.equal((await sketch(dir, 'comment', 'main', 'api', 'Agreed.', '--author', 'Ann')).code, 0)
  const out = (await sketch(dir, 'threads', 'main')).stdout
  assert.match(out, /^Threads on main: 1 open, 0 closed$/m)
  assert.match(out, /^api "API" \(open\)$/m)
  assert.match(out, /^ {2}Claude, \d{4}-\d\d-\d\d \d\d:\d\d: Should this be a queue\?$/m)
  assert.match(out, /^ {2}Ann, .*: Agreed\.$/m)
  assert.equal((await sketch(dir, 'close', 'main', 'api')).code, 0)
  assert.equal(THREADS(dir).api.closed, true)
  assert.match((await sketch(dir, 'threads', 'main')).stdout, /^api "API" \(closed\)$/m)
  assert.equal((await sketch(dir, 'reopen', 'main', 'api')).code, 0)
  assert.equal(THREADS(dir).api.closed, false)
  assert.equal(fileOf(dir).elements.some((e) => 'threads' in e), false, 'the .excalidraw file stays standard')
})

test('comment reads its text from stdin too; a deleted shape\'s thread shows as orphaned', async () => {
  const dir = project()
  await apply(dir, [{ op: 'add', type: 'rectangle', id: 'api', x: 0, y: 0, label: 'API' }])
  const r = await runCommand(process.execPath, [BIN, 'sketch', 'comment', 'main', 'api'], { cwd: dir, input: 'Line one\nline two\n' })
  assert.equal(r.code, 0, r.stderr)
  assert.equal(THREADS(dir).api.comments[0].text, 'Line one\nline two')
  await apply(dir, [{ op: 'delete', id: 'api' }])
  assert.match((await sketch(dir, 'threads', 'main')).stdout, /^api "API" \(open, orphaned: the shape was deleted\)$/m, 'with the label it had')
})

test('a comment on no shape, or with no text, stops with exit code 1 and writes nothing', async () => {
  const dir = project()
  await apply(dir, [{ op: 'add', type: 'rectangle', id: 'api', x: 0, y: 0 }])
  for (const args of [['comment', 'main', 'nope', 'Hi'], ['comment', 'main'], ['close', 'main', 'api'], ['comment', 'main', 'api', ' ']]) {
    const r = await sketch(dir, ...args)
    assert.equal(r.code, 1, args.join(' '))
    assert.match(r.stderr, /\S/)
  }
  assert.equal(fs.existsSync(path.join(dir, 'docs', 'product', 'sketches', 'main.threads.json')), false)
})
