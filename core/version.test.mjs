// The one version: package.json's, carried by every module and shown in the UI.
// Run: node --test core/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startServer } from './server.mjs'
import { MODULES } from './modules.mjs'

const PKG = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

async function withGroundwork(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-version-'))
  const srv = await startServer({ root, modules: MODULES, port: 0 })
  try { await fn(srv.url) } finally { await srv.close() }
}

test('every module carries the version of the package', async () => {
  await withGroundwork(async (url) => {
    const mods = await (await fetch(url + 'api/modules')).json()
    assert.deepEqual(mods.map((m) => [m.id, m.version]), [['ideas', PKG.version], ['plan', PKG.version], ['build', PKG.version], ['sketch', PKG.version], ['agents', PKG.version]])
    const hello = await (await fetch(url + 'api/build/hello')).json()
    assert.equal(hello.version, PKG.version)
  })
})

test('the shell shows the version in its header', async () => {
  await withGroundwork(async (url) => {
    const page = await (await fetch(url)).text()
    assert.match(page, /<span class="gw-brand">Groundwork<\/span>/, 'the header has the Groundwork brand')
    const version = /<span class="gw-version">([^<]*)<\/span>/.exec(page)
    assert.ok(version, 'and the version next to it')
    assert.equal(version[1], `v${PKG.version}`)
  })
})

test('no module keeps a version of its own in its source', () => {
  for (const f of ['../modules/plan/module.mjs', '../modules/build/module.mjs', '../modules/build/index.html']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /\bVERSION = '\d|version: '\d/, f)
  }
})
