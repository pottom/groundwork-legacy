#!/usr/bin/env node
// Plan module CLI: a live, human-editable mind map for grilling sessions that
// writes a PRD (PRD.md) as the interview goes. Its Claude skill is groundwork-prd-maker.
//
// Run as `npx groundwork plan <command>` (core/commands.mjs), or `node modules/plan/plan.mjs <command>`:
//
//   init "<title>"   create mindmap.json in the current dir
//   apply '<ops>'    apply a JSON op array (or pipe it on stdin)
//   show             print the outline + pending human edits
//   kinds            print the document kinds and their starting sections, in the map's document language
//   hook             UserPromptSubmit hook (reads hook JSON on stdin); `groundwork init` installs it
//
// The editor is served by the core server: npx groundwork
// Reading, writing and merging the map is in map-store.mjs; the ops are described there.

import fs from 'node:fs'
import { STATUSES } from './node-types.mjs'
import { BASE_DIR, KINDS, COMPONENT_TYPES, listDocs, isSection } from './documents.mjs'
import { DOC_STRINGS, docStrings, langOf } from './doc-strings.mjs'
import { openMap, walk, index } from './map-store.mjs'
import { moduleFiles } from '../../core/files.mjs'
import plan from './module.mjs'

// The CLI and the hook run outside the server, but write through the same writer the core
// grants Plan from its manifest (this also moves old .prd-maker/ state over).
const open = (dir) => openMap(dir, moduleFiles(dir, plan))

// ---------- text output ----------

function outline(data) {
  const lines = []
  const sections = new Set()
  walk(data.nodeData, (n) => { if (isSection(data, n.id)) sections.add(n.id) })
  const rec = (n, depth) => {
    const st = n.metadata?.status ? ` (${n.metadata.status}${n.metadata.impl ? `, impl: ${n.metadata.impl}` : ''}${n.metadata.by === 'human' ? ', by human' : ''})` : ''
    const m = n.metadata || {}
    const prd = m.doc ? [`document → ${BASE_DIR}/${listDocs(data).find((d) => d.id === n.id)?.file}`] : m.component ? [`component: ${m.component}`] : sections.has(n.id) ? [
      `section: ${m.progress === 'done' ? 'done' : m.prose ? 'has prose' : 'no prose yet'}`,
      m.humanProse?.length && `${m.humanProse.length} human paragraph(s)`,
    ] : []
    const extra = [n === data.nodeData && `document language: ${langOf(data)}`, n.hyperLink && `link: ${n.hyperLink}`, n.note && `note: ${n.note}`, ...prd].filter(Boolean).join('; ')
    lines.push(`${'  '.repeat(depth)}[${n.id}] ${n.topic}${st}${extra ? ` — ${extra}` : ''}`)
    for (const c of n.children || []) rec(c, depth + 1)
  }
  rec(data.nodeData, 0)
  return lines.join('\n')
}

function describeEdits(ops, data) {
  const m = index(data)
  const name = (id) => (m.get(id) ? `[${id}] "${m.get(id).node.topic}"` : `[${id}]`)
  return ops.map((o) => {
    switch (o.op) {
      case 'add': return `- added ${name(o.id)} under ${name(o.parent)}${o.status ? ` with status ${o.status}` : ''}`
      case 'set': {
        const parts = []
        if ('topic' in o) parts.push(`renamed "${o.was}" → "${o.topic}"`)
        if ('status' in o) parts.push(`status → ${o.status || '(none)'}`)
        if ('note' in o) parts.push(`note → "${o.note}"`)
        if ('link' in o) parts.push(`link → ${o.link}`)
        if ('impl' in o) parts.push(`implementation → ${o.impl || '(unknown)'}`)
        if ('progress' in o) parts.push(`PRD progress → ${o.progress || '(open)'}`)
        if ('prose' in o) parts.push(o.prose ? 'your PRD text changed' : 'your PRD text was removed (the human took it over, see below)')
        let line = `- ${name(o.id)}: ${parts.join(', ')}`
        if ('human' in o) {
          line += `${parts.length ? '\n  ' : ''}the human's own PRD paragraphs in this section are now:`
          line += o.human.length ? o.human.map((h) => `\n    > ${h.text.replace(/\n/g, '\n    > ')}`).join('') : ' (none)'
        }
        return line
      }
      case 'move': return `- moved ${name(o.id)} under ${name(o.parent)}`
      case 'remove': return `- removed [${o.id}] "${o.topic}" (and its subtree)`
      default: return `- ${JSON.stringify(o)}`
    }
  }).join('\n')
}

function editsBlock(store, data) {
  const ops = store.takeHumanEdits()
  if (!ops.length) return ''
  return 'The human edited the mind map in the browser since you last looked. These edits are authoritative:\n' +
    describeEdits(ops, data)
}

// ---------- commands ----------

function cmdInit(dir, title, force) {
  const store = open(dir)
  try { store.init(title, { force }) } catch (e) { die(e.message) }
  console.log(`created ${store.file}`)
}

function cmdApply(dir, arg) {
  const store = open(dir)
  const raw = arg ?? fs.readFileSync(0, 'utf8')
  let ops = JSON.parse(raw)
  if (!Array.isArray(ops)) ops = [ops]
  const { errors, data } = store.apply(ops)
  if (errors.length) console.log('errors:\n' + errors.map((e) => '  ' + e).join('\n'))
  const edits = editsBlock(store, data)
  if (edits) console.log(edits + '\n')
  console.log(outline(data))
}

function cmdShow(dir) {
  const store = open(dir)
  const { data } = store.read()
  const edits = editsBlock(store, data)
  if (edits) console.log(edits + '\n')
  console.log(outline(data))
}

function cmdKinds(dir) {
  const store = open(dir)
  const lang = store.exists() ? langOf(store.read().data) : langOf({})
  const t = docStrings(lang)
  console.log(`starting sections in ${t.name} (${lang}):`)
  for (const [kind, { file }] of Object.entries(KINDS)) console.log(`  ${kind} (${file}): ${t.kinds[kind].sections.join(' · ')}`)
}

function cmdHook() {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
    const store = open(input.cwd || process.cwd())
    const out = []
    if (/grill/i.test(input.prompt || '')) {
      out.push('This project draws grilling sessions on a live mind map: load the `groundwork-prd-maker` skill alongside the grilling skill.')
    }
    if (store.exists()) {
      const edits = editsBlock(store, store.read().data)
      if (edits) out.push(edits)
    }
    if (out.length) console.log(out.join('\n\n'))
  } catch (e) {
    console.error(`mindmap hook: ${e.message}`)
  }
}

function die(msg) {
  console.error(msg)
  process.exit(1)
}

const [cmd, ...rest] = process.argv.slice(2)
const dir = process.env.MINDMAP_DIR || process.cwd()

switch (cmd) {
  case 'init': cmdInit(dir, rest.find((a) => !a.startsWith('--')), rest.includes('--force')); break
  case 'apply': cmdApply(dir, rest[0]); break
  case 'show': cmdShow(dir); break
  case 'kinds': cmdKinds(dir); break
  case 'hook': cmdHook(); break
  case 'serve': die('plan serve is gone: the core server serves the editor now. Run: npx groundwork'); break
  default: die('usage: groundwork plan init "<title>" | apply \'<ops json>\' | show | kinds | hook\n' +
    `statuses: ${Object.keys(STATUSES).join(', ')}\ndocument kinds: ${Object.keys(KINDS).join(', ')}\ncomponent types: ${COMPONENT_TYPES.join(', ')}\n` +
    `document languages: ${Object.keys(DOC_STRINGS).join(', ')}`)
}
