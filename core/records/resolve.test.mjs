import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openRecords } from './store.mjs'
import { CORE_RECORDS } from './changes.mjs'
import changesModule from '../../modules/changes/module.mjs'

const today = () => '2026-10-20'
// A project whose merged C-1 lists, in its scope, the old ids and what they became.
const FILES = {
  'docs/product/spec/parts.md': '# Részek\n\n- Web · `web` · software · aktív\n',
  'docs/product/spec/SYSTEM.md': '# Demo — Áttekintés\n\n_Rendszer-áttekintés_\n\n## Cél {#t-goal}\n\n- Cél · `d-goal` · döntés · C-1\n',
  'docs/product/spec/web/PRD.md': '# Demo — Web: PRD\n\n_Termékkövetelmények_\n\n## Felület {#t-web-ui}\n\n- Egy oldal · `d-web-page` · döntés · C-1\n',
  'docs/product/changes/C-001-kiindulo-allapot.md': '---\nid: C-1\ntitle: Kiinduló állapot\nstatus: done\n---\n\n## Keret\n\n'
    + '- `c-web` → `web` (rész)\n- `doc-web-prd` → `web/prd` (dokumentum)\n- `r-1` → M-1 (mérföldkő)\n- `r-2` → M-2 (mérföldkő)\n\n## Történet\n',
  'docs/product/milestones/M-001-elso.md': '---\nid: M-1\ntitle: Első\nstatus: done\n---\n\n## Történet\n',
  'docs/product/milestones/M-002-masodik.md': '---\nid: M-2\ntitle: Második\nstatus: planned\n---\n\n## Történet\n',
}
const project = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-resolve-'))
  for (const [file, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), text)
  }
  return root
}
const open = (root) => openRecords(root, [changesModule, CORE_RECORDS], { today })

test("an old id resolves through a merged change's list of what the ids became", () => {
  const store = open(project())
  const part = store.resolve('c-web')
  assert.equal(part.kind, 'alias')
  assert.deepEqual([part.to, part.change], ['web', 'C-1'])
  assert.equal(part.target.kind, 'spec')
  assert.equal(part.target.found.kind, 'part')
  const doc = store.resolve('doc-web-prd')
  assert.equal(doc.target.found.kind, 'document')
  assert.equal(doc.target.found.id, 'web/prd')
  const ms = store.resolve('r-2')
  assert.deepEqual([ms.to, ms.target.kind, ms.target.record.id], ['M-2', 'record', 'M-2'])
})

test('a Spec id or a record id resolves as itself; an unknown id is null', () => {
  const store = open(project())
  assert.equal(store.resolve('d-goal').kind, 'spec')
  assert.equal(store.resolve('M-1').kind, 'record')
  assert.equal(store.resolve('nope-1'), null)
})

test('only a merged change names old ids: a change being grilled does not', () => {
  const root = project()
  fs.writeFileSync(path.join(root, 'docs/product/changes/C-009-x.md'),
    '---\nid: C-9\ntitle: X\nstatus: grilling\n---\n\n## Keret\n\n- `old-thing` → `web` (rész)\n\n## Történet\n')
  const store = open(root)
  assert.equal(store.resolve('old-thing'), null)
})
