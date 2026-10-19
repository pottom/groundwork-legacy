// The Agents page: a thin index.html and small ES modules that render with lit-html, in English and
// Hungarian, listening through the shell. The server serves only the files the manifest lists.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import agents from './module.mjs'
import { UI_STRINGS } from './ui-strings.mjs'
import { duration } from './view/time.mjs'

const read = (f) => fs.readFileSync(path.join(agents.view.dir, f), 'utf8').replace(/\r\n/g, '\n')
const local = (spec) => spec.startsWith('./') || spec.startsWith('../')
const viewSource = () => agents.view.files.map(read).join('\n')

test('index.html is a thin shell that loads the theme switch first and the entry module', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<style\b/)
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, 'no inline script')
  assert.match(html, /<script type="module" src="\.\/view\/main\.mjs"><\/script>/)
})

test('every file the page loads from the module is listed in the manifest, and each is loaded', () => {
  const listed = new Set(agents.view.files)
  const seen = new Set(['index.html'])
  const queue = ['index.html']
  while (queue.length) {
    const f = queue.shift()
    const src = read(f)
    const refs = [
      ...[...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g)].map((m) => m[1]),
      ...[...src.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
    ].filter(local)
    for (const ref of refs) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), ref))
      assert.ok(listed.has(target), `${f} loads ${ref}: ${target} is in view.files`)
      if (!seen.has(target)) { seen.add(target); queue.push(target) }
    }
  }
  for (const f of listed) assert.ok(seen.has(f), `${f} is listed and the page loads it`)
  for (const f of listed) assert.ok(read(f).split('\n').length <= 420, f)
})

test('it renders with lit-html, reads the list again on agents.events through the shell, and never polls the server', () => {
  const src = viewSource()
  assert.match(src, /from '\/vendor\/lit-html\/lit-html\.js'/)
  assert.doesNotMatch(src, /\.innerHTML\s*=|insertAdjacentHTML/)
  assert.match(src, /import \{ subscribe \} from '\/shell\/live\.mjs'/)
  assert.doesNotMatch(src, /new EventSource/)
  const main = read('view/main.mjs')
  assert.match(main, /topics\.includes\('agents\.events'\)/)
  assert.match(main, /fetch\('\/api\/agents\/list'/)
  assert.doesNotMatch(main, /setInterval\([^)]*fetch|setInterval\(load/, 'the clock only redraws the running durations')
})

test('an agent shows its state as a badge in the state\'s tone, its start and its duration', () => {
  const list = read('view/list.mjs')
  assert.match(list, /running: 'info'/)
  assert.match(list, /done: 'ok'/)
  assert.match(list, /failed: 'bad'/)
  assert.match(list, /gw-badge gw-badge--dot gw-badge--\$\{/)
  assert.match(list, /duration\(/)
})

test('opening an agent (or a session) shows its timeline and its final report, read again live', () => {
  const main = read('view/main.mjs')
  assert.match(main, /fetch\(`\/api\/agents\/agent\?/)
  assert.match(main, /hashchange/, 'the open agent is in the address: #agent=<session>/<agent>')
  assert.match(main, /topics\.includes\('agents\.events'\)\) \{?[^}]*loadDetail\(\)|loadDetail\(\)[^\n]*agents\.events|agents\.events[\s\S]{0,80}loadDetail/)
  const detail = read('view/detail.mjs')
  assert.match(detail, /unsafeHTML\(/, 'the report is Markdown')
  assert.match(detail, /from '\.\/markdown\.mjs'/, 'through the safe options: raw HTML shows as text')
  assert.match(read('view/list.mjs'), /`#agent=\$\{s\.id\}\/\$\{a\.id\}`/)
})

test('every kind of step and test outcome has its words, in both languages', () => {
  const kinds = [...read('timeline.mjs').matchAll(/^\/\/ {3}- (\w+)/gm)].map((m) => m[1])
  assert.deepEqual(kinds, ['read', 'edit', 'command', 'tool', 'test', 'commit', 'skill', 'agent', 'waiting'])
  for (const k of [...kinds.map((k) => `step.${k}`), 'outcome.passed', 'outcome.failed', 'outcome.ran', 'report.title', 'timeline.title']) {
    assert.ok(UI_STRINGS.en[k] && UI_STRINGS.hu[k], k)
  }
})

test('an agent shows its ticket, linking to it in Build, and its branch; Build\'s link to an agent opens it here', () => {
  const list = read('view/list.mjs')
  assert.match(list, /'\/\?module=build&ticket=' \+ encodeURIComponent\(/)
  assert.match(list, /target="_top"/, 'the ticket opens in the whole window')
  assert.match(list, /href=\$\{branchHash\(item\.branch\)\}/, 'the branch links to its row in the worktrees')
  assert.match(read('view/worktrees.mjs'), /id=\$\{i\.branch \? 'branch-' \+ i\.branch/)
  const main = read('view/main.mjs')
  assert.match(main, /readAddress\(location\)/, 'Build\'s ?agent=<session>/<agent> opens that agent (address.mjs)')
  assert.match(main, /scrollIntoView\(/)
})

test('a duration reads as m:ss, or h:mm:ss from an hour on', () => {
  assert.equal(duration(0), '0:00')
  assert.equal(duration(42_400), '0:42')
  assert.equal(duration(185_000), '3:05')
  assert.equal(duration(3_723_000), '1:02:03')
  assert.equal(duration(-5), '0:00')
})

test('an agent or session that needs attention stands out with its reason, judged live by the page clock', () => {
  const list = read('view/list.mjs')
  assert.match(list, /import \{ attentionOf \} from '\.\.\/attention\.mjs'/, 'the same rule as the shell\'s count')
  assert.match(list, /attentionOf\([^)]*, now\)/)
  assert.match(list, /data-attention=\$\{/)
  assert.match(list, /ui\(`attention\.\$\{/)
  for (const r of ['waiting', 'stalled', 'failed']) assert.ok(UI_STRINGS.en[`attention.${r}`] && UI_STRINGS.hu[`attention.${r}`], r)
  const css = read('agents.css')
  assert.match(css, /\[data-attention\]/)
  assert.match(css, /var\(--gw-warn/, 'attention is the warn tone')
})

test('the English and the Hungarian set have the same keys, translated; no Hungarian outside the strings', () => {
  const { en, hu } = UI_STRINGS
  assert.deepEqual(Object.keys(hu).sort(), Object.keys(en).sort())
  assert.deepEqual(Object.keys(en).filter((k) => hu[k] === en[k]), [])
  for (const f of agents.view.files.filter((f) => f !== 'ui-strings.mjs')) {
    assert.doesNotMatch(read(f), /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/, f)
  }
})
