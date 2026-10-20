// @ts-check
// `groundwork migrate`: the old single-map Groundwork to the record model (migrate.mjs), from the
// command line. Run without --yes, it prints what it would write and writes nothing; the milestone
// states in it are proposals (Claude checks them against the tickets, the human approves):
//
//   groundwork migrate [--root DIR] [--roadmap <section id> | none] [--json]
//                                 the plan: Spec documents, changes, milestones with proposed
//                                 states, ideas to move, generated documents to remove; --json
//                                 prints it as JSON (for Claude)
//   groundwork migrate --yes --milestones <states> [...]
//                                 writes it, with the approved milestone states: `proposed`,
//                                 `M-1=done,r-8=in-progress` (by number or map id; with
//                                 `proposed` for the rest), or one per milestone in order
//                                 (`done,done,in-progress`)
//
// Non-interactive: nothing asks. The project folder is --root, else MINDMAP_DIR, else the current
// folder. A refusal (already migrated, no map, a missing state) prints why and exits with 1.

import path from 'node:path'
import { MODULES } from '../modules.mjs'
import { planMigration, applyMigration, checkRecords } from './migrate.mjs'
import { openRecords } from '../records/store.mjs'
import { CORE_RECORDS } from '../records/changes.mjs'

const USAGE = [
  'usage: groundwork migrate [--root DIR] [--roadmap <section id>|none] [--json]',
  '       groundwork migrate --yes --milestones proposed|M-1=done,...|done,done,... [--root DIR] [--roadmap ...]',
].join('\n')
const VALUED = ['root', 'roadmap', 'milestones']
const SWITCHES = ['yes', 'json']

/** @param {string[]} args */
function parse(args) {
  /** @type {Record<string, string | boolean>} */
  const opts = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    const name = a.startsWith('--') ? a.slice(2) : ''
    if (VALUED.includes(name)) {
      if (i + 1 >= args.length) throw new Error(`${a} needs a value`)
      opts[name] = args[++i]
    } else if (SWITCHES.includes(name) || a === '-y') opts[name || 'yes'] = true
    else throw new Error(`unknown argument: ${a}`)
  }
  return opts
}

/** @param {import('./migrate.mjs').Plan} plan @returns {string[]} */
function describe(plan) {
  const c = plan.converted
  const out = [`From ${plan.map}: ${c.parts.length} parts, ${c.docs.length} documents (language ${c.lang})`, '', 'Spec:']
  for (const w of plan.spec) out.push(`  ${w.rel}`)
  out.push('', 'Changes:')
  for (const ch of plan.changes) out.push(`  ${ch.id} ${ch.title} (${ch.status}) ${ch.file}`)
  if (c.questions.length) out.push(`    open questions: ${c.questions.map((q) => q.id).join(', ')}`)
  out.push('', c.roadmap ? `Milestones, from the roadmap section ${c.roadmap} (proposed states: check them against the tickets):` : 'Milestones: none (no roadmap section)')
  for (const m of plan.milestones) out.push(`  ${m.id.padEnd(5)} ${m.from.padEnd(14)} ${m.proposed.padEnd(11)} ${m.title}  (${m.why})`)
  if (plan.ideas.length) {
    out.push('', `Ideas, to ${path.posix.dirname(plan.ideas[0].rel)}/:`)
    for (const i of plan.ideas) out.push(`  ${i.from}${i.accepted ? ' (to-develop → accepted)' : ''}`)
  }
  if (c.dropped.length) out.push('', 'Dropped (the idea lives in its own record):', ...c.dropped.map((d) => `  ${d.id} → ${d.idea} ${d.topic}`))
  out.push('', 'Removed (generated from the map):', ...plan.remove.map((r) => `  ${r}`), `  ${plan.map} → ${plan.mapTo}`)
  if (c.warnings.length) out.push('', 'Kept differently:', ...c.warnings.map((w) => `  ${w}`))
  return out
}

/** @param {string[]} argv */
function run(argv) {
  const opts = parse(argv)
  const root = path.resolve(String(opts.root ?? (process.env.MINDMAP_DIR || process.cwd())))
  const modules = [...MODULES, CORE_RECORDS]
  const plan = planMigration(root, { modules, roadmap: /** @type {string | undefined} */ (opts.roadmap) })
  if (!opts.yes) {
    if (opts.json) {
      const { converted, spec, changes, ...rest } = plan
      console.log(JSON.stringify({
        ...rest,
        spec: spec.map((w) => w.rel),
        changes: changes.map(({ text, ...c }) => c),
        ideas: plan.ideas.map(({ text, ...i }) => i),
        lang: converted.lang, roadmap: converted.roadmap, parts: converted.parts, questions: converted.questions,
        dropped: converted.dropped, ids: converted.ids, warnings: converted.warnings,
      }, null, 2))
    } else {
      console.log([...describe(plan), '', 'Nothing written. To write it: groundwork migrate --yes --milestones <states> (proposed, or M-1=done,...)'].join('\n'))
    }
    return
  }
  const done = applyMigration(plan, { states: /** @type {string | undefined} */ (opts.milestones) })
  const check = checkRecords(openRecords(root, modules))
  console.log([
    `Migrated: ${done.written.length} files written, ${done.removed.length} generated documents removed.`,
    ...done.moved.map((m) => `  ${m}`),
    `record check: ${check.duplicates.length} duplicate ids, ${check.problems.length} non-canonical lines, ${check.unknown.length} unknown references`,
  ].join('\n'))
  if (check.duplicates.length || check.problems.length || check.unknown.length) process.exitCode = 1
}

try {
  run(process.argv.slice(2))
} catch (e) {
  console.error(`groundwork migrate: ${/** @type {Error} */ (e).message}\n${USAGE}`)
  process.exitCode = 1
}
