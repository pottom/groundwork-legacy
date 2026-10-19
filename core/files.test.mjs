// Tests of the module writer: a module can write only under the folders its manifest names.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectFiles, moduleFiles } from './files.mjs'

const tmp = (p = 'gw-files-') => fs.mkdtempSync(path.join(os.tmpdir(), p))

// A link to a folder: a junction on Windows (needs no admin rights), a symlink elsewhere.
const linkDir = (target, link) => fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir')

const WRITES = ['docs/product', '.groundwork/plan']

test('writes under the listed folders succeed', () => {
  const root = tmp()
  const files = projectFiles(root, WRITES)
  files.write('docs/product/PRD.md', 'prd')
  files.write('docs/product/core/TECH.md', 'tech')
  files.append('.groundwork/plan/edits.jsonl', 'a\n')
  files.append('.groundwork/plan/edits.jsonl', 'b\n')
  assert.equal(files.read('docs/product/core/TECH.md'), 'tech')
  assert.equal(files.read('.groundwork/plan/edits.jsonl'), 'a\nb\n')
  assert.ok(files.exists('docs/product/PRD.md'))
  files.remove('docs/product/PRD.md')
  assert.equal(files.exists('docs/product/PRD.md'), false)
})

test('reads are project-wide but stay inside the project', () => {
  const root = tmp()
  fs.writeFileSync(path.join(root, 'GLOSSARY.md'), 'terms')
  const files = projectFiles(root, WRITES)
  assert.equal(files.read('GLOSSARY.md'), 'terms')
  assert.throws(() => files.read('../outside.txt'), /outside the project/)
})

test('a write to a folder the manifest does not list fails', () => {
  const root = tmp()
  const files = projectFiles(root, WRITES)
  assert.throws(() => files.write('README.md', 'x'), /may not write/)
  assert.throws(() => files.write('.groundwork/build/state.json', 'x'), /may not write/)
  assert.throws(() => files.append('docs/other.md', 'x'), /may not write/)
  assert.throws(() => files.write('docs/product', 'x'), /may not write/) // the folder itself is not a file
  assert.equal(fs.existsSync(path.join(root, 'README.md')), false)
})

test('a write with .. out of the folder fails', () => {
  const root = tmp()
  const files = projectFiles(root, WRITES)
  assert.throws(() => files.write('docs/product/../../escape.md', 'x'), /may not write/)
  assert.throws(() => files.write('../escape.md', 'x'), /may not write/)
  assert.throws(() => files.write('docs/product/..', 'x'), /may not write/)
  assert.equal(fs.existsSync(path.join(root, '..', 'escape.md')), false)
})

test('a write to an absolute path fails', () => {
  const root = tmp()
  const other = tmp()
  const files = projectFiles(root, WRITES)
  assert.throws(() => files.write(path.join(other, 'x.md'), 'x'), /may not write/)
  assert.throws(() => files.write(path.join(root, 'docs/product/x.md'), 'x'), /may not write/, 'even one that points inside')
  assert.throws(() => files.append('/tmp/x.md', 'x'), /may not write/)
  assert.deepEqual(fs.readdirSync(other), [])
})

test('a write through a link that points outside fails', () => {
  const root = tmp()
  const outside = tmp('gw-outside-')
  fs.mkdirSync(path.join(root, 'docs/product'), { recursive: true })
  linkDir(outside, path.join(root, 'docs/product/linked'))
  const files = projectFiles(root, WRITES)
  assert.throws(() => files.write('docs/product/linked/x.md', 'x'), /may not write/)
  assert.throws(() => files.write('docs/product/linked/deep/x.md', 'x'), /may not write/)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('a listed folder that is itself a link to outside cannot be written', () => {
  const root = tmp()
  const outside = tmp('gw-outside-')
  fs.mkdirSync(path.join(root, '.groundwork'))
  linkDir(outside, path.join(root, '.groundwork/plan'))
  const files = projectFiles(root, WRITES)
  assert.throws(() => files.write('.groundwork/plan/edits.jsonl', 'x'), /may not write/)
  assert.deepEqual(fs.readdirSync(outside), [])
})

test('a manifest may only list folders under docs/product/ or .groundwork/', () => {
  const root = tmp()
  assert.throws(() => projectFiles(root, ['src']), /docs\/product\/ and \.groundwork\//)
  assert.throws(() => projectFiles(root, ['docs']), /docs\/product\/ and \.groundwork\//)
  assert.throws(() => projectFiles(root, ['.']), /docs\/product\/ and \.groundwork\//)
  assert.throws(() => projectFiles(root, ['docs/product/../../x']), /docs\/product\/ and \.groundwork\//)
  assert.throws(() => projectFiles(root, [root]), /docs\/product\/ and \.groundwork\//)
  assert.doesNotThrow(() => projectFiles(root, ['.groundwork', 'docs/product/plan']))
})

test('a module without a writes list cannot write anything', () => {
  const root = tmp()
  const files = moduleFiles(root, { id: 'demo' })
  assert.throws(() => files.write('docs/product/x.md', 'x'), /may not write/)
})

test('moduleFiles moves a module\'s state from an older folder once', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, '.old-state'))
  fs.writeFileSync(path.join(root, '.old-state/edits.jsonl'), 'pending\n')
  const manifest = { id: 'demo', writes: ['.groundwork/demo'], moves: { '.old-state': '.groundwork/demo' } }
  const files = moduleFiles(root, manifest)
  assert.equal(files.read('.groundwork/demo/edits.jsonl'), 'pending\n')
  assert.equal(fs.existsSync(path.join(root, '.old-state')), false)
  // A second old folder appearing later does not overwrite the new state: it is added to it.
  fs.mkdirSync(path.join(root, '.old-state'))
  fs.writeFileSync(path.join(root, '.old-state/edits.jsonl'), 'later\n')
  moduleFiles(root, manifest)
  assert.equal(files.read('.groundwork/demo/edits.jsonl'), 'pending\nlater\n')
})

test('a move may only go into a folder the module may write, from a plain top-level folder', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, '.old-state'))
  assert.throws(() => moduleFiles(root, { writes: ['.groundwork/demo'], moves: { '.old-state': 'src' } }), /may not write/)
  assert.throws(() => moduleFiles(root, { writes: ['.groundwork/demo'], moves: { '../elsewhere': '.groundwork/demo' } }), /top-level folder/)
  assert.throws(() => moduleFiles(root, { writes: ['.groundwork/demo'], moves: { 'docs/x': '.groundwork/demo' } }), /top-level folder/)
  const outside = tmp('gw-outside-')
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep')
  linkDir(outside, path.join(root, '.linked-state'))
  moduleFiles(root, { writes: ['.groundwork/demo'], moves: { '.linked-state': '.groundwork/demo' } })
  assert.equal(fs.existsSync(path.join(root, '.groundwork/demo')), false, 'a link is not moved')
  assert.ok(fs.existsSync(path.join(outside, 'keep.txt')))
})

test('when both folders exist, the old state is merged in: logs are appended, newer files kept', () => {
  const root = tmp()
  fs.mkdirSync(path.join(root, '.old-state'))
  fs.writeFileSync(path.join(root, '.old-state', 'edits.jsonl'), 'old\n')
  fs.writeFileSync(path.join(root, '.old-state', 'written.json'), '["OLD.md"]')
  fs.writeFileSync(path.join(root, '.old-state', 'only-old.txt'), 'x')
  fs.mkdirSync(path.join(root, '.groundwork', 'demo'), { recursive: true })
  fs.writeFileSync(path.join(root, '.groundwork', 'demo', 'edits.jsonl'), 'new\n')
  fs.writeFileSync(path.join(root, '.groundwork', 'demo', 'written.json'), '["NEW.md"]')
  moduleFiles(root, { writes: ['.groundwork/demo'], moves: { '.old-state': '.groundwork/demo' } })
  const dest = (f) => fs.readFileSync(path.join(root, '.groundwork', 'demo', f), 'utf8')
  assert.equal(dest('edits.jsonl'), 'new\nold\n')
  assert.equal(dest('written.json'), '["NEW.md"]')
  assert.equal(dest('only-old.txt'), 'x')
  assert.equal(fs.existsSync(path.join(root, '.old-state')), false)
})
