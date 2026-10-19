// The project's name, resolved once for the shell and the modules.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { projectName } from './project-name.mjs'

function project(files, folder = 'my-folder') {
  const root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-name-')), folder)
  fs.mkdirSync(root)
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(root, name), text)
  return root
}

test('the first heading of the README names the project', () => {
  assert.equal(projectName(project({ 'README.md': 'Some intro\n\n# Medoc *Build*  \n\n## More\n', 'package.json': '{"name":"medoc"}' })), 'Medoc Build')
})

test('a README heading keeps its text, not its markup', () => {
  assert.equal(projectName(project({ 'README.md': '# [Groundwork](https://x.example) `v2` ![badge](b.svg)\n' })), 'Groundwork v2')
})

test('without a README heading, the package name, without its scope', () => {
  assert.equal(projectName(project({ 'README.md': 'no heading here\n', 'package.json': '{"name":"@pottom/groundwork"}' })), 'groundwork')
})

test('without either, the folder name; a broken package.json is no reason to fail', () => {
  assert.equal(projectName(project({ 'package.json': '{oops' })), 'my-folder')
  assert.equal(projectName(project({}, 'plain')), 'plain')
})

test('a heading inside a code block does not count', () => {
  assert.equal(projectName(project({ 'README.md': '```sh\n# install\n```\n\n# Real name\n' })), 'Real name')
})
