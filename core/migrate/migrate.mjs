// @ts-check
// `groundwork migrate`: one step from the old single-map Groundwork to the record model, for any
// project (the rules are the map's, convert.mjs; nothing here knows this repository).
//
//   const plan = planMigration(root, { modules, roadmap?, split?, today? })   reads, writes nothing
//   applyMigration(plan, { states })                                         writes it all
//
// What it writes, from docs/product/mindmap.json:
//   docs/product/spec/parts.md, spec/SYSTEM.md, spec/<part>/<KIND>.md   the Spec (convert.mjs)
//   docs/product/changes/C-001-<slug>.md   C-1 Initial state, merged (done), with the migration line
//                                          in its history, and the map ids that are no Spec ids, each
//                                          with what it became; its items are the Spec's (origin C-1).
//                                          Tickets without a **Change:** line, made before C-1, are
//                                          C-1's by the store's rule: no ticket is rewritten.
//   docs/product/changes/C-00n-<slug>.md   with `split` (split.mjs: the split plan, Claude proposes it,
//                                          the human approves): a change per entry, C-2…, awaiting
//                                          approval, its branches as proposed items with their place as
//                                          the target and the implementation missing; C-1 lists where
//                                          each branch went
//   docs/product/changes/C-00n-<slug>.md   Open questions from the migration (after the split ones): every todo that did not
//                                          point to an idea, as a question of a change being grilled
//   docs/product/milestones/M-00n-<slug>.md   a milestone per decision of the roadmap section, in order,
//                                          in the state the human approved (`states`)
//   docs/product/ideas/I-00n-<slug>.md     the ideas, from ideas/items/, with their numbers and history;
//                                          to-develop becomes accepted (a history line says so)
// and it removes the documents Plan generated from the map (only files with Plan's mark: what the
// human wrote stays) and moves the map to .groundwork/migrate/mindmap.json, so nothing reads it.
// Every write goes through the core's writer, limited to docs/product/ and .groundwork/.
//
// Milestone states: Claude proposes each from the tickets, the human approves. The plan proposes one
// from the roadmap item's implementation (done → done, partial → in-progress, else planned), for
// Claude to check against the tickets; `states` is what was approved, and every milestone needs one:
//   'proposed'                         the plan's proposal for each
//   'M-1=done,r-8=in-progress,...'     by number or by the map id; with `proposed` among them, the
//                                      proposal for the rest
//   'done,done,in-progress'            one per milestone, in order
//
// Refused (code, nothing written): 'no-map' without docs/product/mindmap.json; 'migrated' when the
// project already has a Spec, changes or milestones (a second run); 'conflict' when an idea's new
// file exists already; 'form' when a document would not read back as written; 'states' for missing
// or unknown milestone states; 'bad' for an unknown --roadmap section; 'split' for a split plan
// naming an id that is no branch of the map, a branch twice, an unknown idea or milestone, or a
// change without a title or a branch.

import fs from 'node:fs'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { projectFiles } from '../files.mjs'
import { mapToSpec, ORIGIN } from './convert.mjs'
import { proposedItems } from './split.mjs'
import { writeSpecDoc, readSpecDoc, writeParts, SPEC_DIR, PARTS_FILE } from '../records/spec-format.mjs'
import { readRecord, writeRecord, fileName, slugOf } from '../records/format.mjs'
import { CHANGES, MILESTONES, CHANGE_TYPE, MILESTONE_TYPE, CORE_RECORDS, changeBody } from '../records/changes.mjs'

/** @typedef {import('./convert.mjs').Converted} Converted */
/** @typedef {import('./split.mjs').SplitEntry} SplitEntry */
/** @typedef {import('../records/types.mjs').RecordType} RecordType */
/** @typedef {import('../records/types.mjs').RecordFormat} RecordFormat */
/** @typedef {{ rel: string, text: string }} Write */
/**
 * @typedef {Object} PlannedChange
 * @property {string} id
 * @property {string} title
 * @property {string} status
 * @property {string} file
 * @property {string} text
 * @property {import('../records/types.mjs').ProposedItem[]} [items]   a split change's proposed items
 */
/**
 * @typedef {Object} PlannedMilestone
 * @property {string} id         'M-1'
 * @property {number} n
 * @property {string} from       the map id of the roadmap decision
 * @property {string} title
 * @property {string} proposed   the proposed state
 * @property {string} why        what the proposal is from
 * @property {string} file
 * @property {string} body
 */
/**
 * @typedef {Object} Plan
 * @property {string} root
 * @property {string} today
 * @property {Converted} converted
 * @property {Write[]} spec               parts.md and the documents
 * @property {PlannedChange[]} changes
 * @property {PlannedMilestone[]} milestones
 * @property {Array<Write & { id: string, from: string, accepted: boolean }>} ideas
 * @property {string[]} remove            the old generated documents
 * @property {string} map
 * @property {string} mapTo
 */

export const MAP = 'docs/product/mindmap.json'
export const MAP_BACKUP = '.groundwork/migrate/mindmap.json'
const OLD_IDEAS = 'docs/product/ideas/items'
const NEW_IDEAS = 'docs/product/ideas'
const GENERATED = ['<!-- generated by Groundwork Plan', '<!-- generated by prd-maker:']
const WHO = 'human'   // the human runs the migration and approves what it writes

/** @param {string} msg @param {string} code */
const fail = (msg, code) => Object.assign(new Error(msg), { code })

// The texts migrate writes, in the document language.
/** @type {Record<string, any>} */
const TEXT = {
  hu: {
    initial: 'Kiinduló állapot',
    questions: 'Nyitott kérdések az átállásból',
    initialProblem: 'A projekt a régi, egyetlen gondolattérképes Groundworkkel készült (docs/product/mindmap.json).',
    initialSolution: 'A `groundwork migrate` a térkép minden csomópontját a Specbe írta: minden elem eredete C-1, a megvalósítási állapota az átálláskori. A változás beolvasztva, a Spec ezzel az állapottal indul. A C-1 előtt készült, **Change:** sor nélküli jegyek a C-1-hez tartoznak.',
    idsIntro: 'A térkép azonosítói, amelyek nem Spec-azonosítók, és amivé lettek:',
    kinds: { root: 'gyökér', part: 'rész', document: 'dokumentum', roadmap: 'megszűnt fejezet, a tartalma a dokumentum elején', milestone: 'mérföldkő', dropped: 'elmaradt, az ötlet a saját rekordjában', question: 'nyitott kérdés', split: 'külön változásban' },
    nothing: 'nincs',
    questionsProblem: 'Az átálláskor ezek a kérdések nyitottak voltak a térképen; a Specben nem lehet eldöntetlen elem, ezért itt várnak döntésre.',
    oldId: 'A térképen',
    splitProblem: (/** @type {string} */ ids) => `Az átálláskor a térkép ezen ágai nem a C-1 Kiinduló állapotba kerültek, hanem ebbe a változásba, jóváhagyásra várva: ${ids}.`,
    splitSolution: 'Az ágak csomópontjai javasolt elemek, mindegyik a térképen elfoglalt helyével mint célhellyel, hiányzó megvalósítással. Egy jóváhagyással olvadnak be a Specbe.',
  },
  en: {
    initial: 'Initial state',
    questions: 'Open questions from the migration',
    initialProblem: 'The project was made with the old, single-map Groundwork (docs/product/mindmap.json).',
    initialSolution: '`groundwork migrate` wrote every node of the map into the Spec: every item comes from C-1, with its implementation state at the time of the migration. The change is merged: the Spec starts in this state. Tickets made before C-1, without a **Change:** line, belong to C-1.',
    idsIntro: 'The ids of the map that are no Spec ids, and what they became:',
    kinds: { root: 'root', part: 'part', document: 'document', roadmap: 'section gone, its content at the start of the document', milestone: 'milestone', dropped: 'dropped, the idea lives in its own record', question: 'open question', split: 'in a change of its own' },
    nothing: 'none',
    questionsProblem: 'These questions were open on the map at the migration; the Spec holds nothing undecided, so they wait for a decision here.',
    oldId: 'On the map',
    splitProblem: (/** @type {string} */ ids) => `At the migration these branches of the map did not go to C-1 Initial state but to this change, awaiting approval: ${ids}.`,
    splitSolution: 'The nodes of the branches are proposed items, each with its place on the map as its target and its implementation missing. They merge into the Spec with one approval.',
  },
}

/** @param {string} root @param {string} rel */
const has = (root, rel) => fs.existsSync(path.join(root, rel))
/** @param {string} root @param {string} rel @returns {string[]} */
const filesIn = (root, rel) => { try { return fs.readdirSync(path.join(root, rel)) } catch { return [] } }

/**
 * What the migration would write, read from the project; nothing is written.
 * @param {string} root
 * @param {{ modules?: Array<{ id: string, records?: RecordType[] }>, roadmap?: string, split?: SplitEntry[], today?: () => string }} [options]
 * @returns {Plan}
 */
export function planMigration(root, { modules = [], roadmap, split = [], today = () => new Date().toISOString().slice(0, 10) } = {}) {
  root = path.resolve(root)
  const done = [
    filesIn(root, SPEC_DIR).length ? `${SPEC_DIR}/` : '',
    filesIn(root, CHANGES).some((f) => /^C-\d+.*\.md$/.test(f)) ? `${CHANGES}/` : '',
    filesIn(root, MILESTONES).some((f) => /^M-\d+.*\.md$/.test(f)) ? `${MILESTONES}/` : '',
  ].filter(Boolean)
  if (done.length) throw fail(`already migrated: the project has ${done.join(', ')}`, 'migrated')
  if (!has(root, MAP)) throw fail(`nothing to migrate: no ${MAP}`, 'no-map')

  const data = JSON.parse(fs.readFileSync(path.join(root, MAP), 'utf8'))
  const splitIds = split.flatMap((e) => e.split)
  split.forEach((e, i) => {
    if (!String(e.title ?? '').trim()) throw fail(`split change ${i + 1} needs a title (--as)`, 'split')
    if (!e.split?.length) throw fail(`split change ${i + 1} (${e.title}) names no branch`, 'split')
  })
  const twice = splitIds.filter((id, i) => splitIds.indexOf(id) !== i)
  if (twice.length) throw fail(`${[...new Set(twice)].join(', ')}: a branch goes to one change only`, 'split')
  const converted = mapToSpec(data, { roadmap, split: splitIds })
  const gone = splitIds.filter((id) => !converted.split.some((s) => s.id === id))
  if (gone.length) throw fail(`${gone.join(', ')}: no component, document, section or item of the map has that id`, 'split')
  const t = TEXT[converted.lang] ?? TEXT.en
  const day = today()

  // the Spec, checked to read back exactly as written
  /** @type {Write[]} */
  const spec = [{ rel: PARTS_FILE, text: writeParts({ lang: converted.lang, parts: converted.parts, human: [] }) }]
  for (const { doc } of converted.docs) {
    const text = writeSpecDoc(doc)
    const back = readSpecDoc(text, { file: doc.file })
    if (back.problems.length || !isDeepStrictEqual(back.doc, doc)) {
      throw fail(`${doc.file} would not read back as written: ${back.problems.map((p) => `${p.line}: ${p.why}: ${p.text}`).join('; ') || 'content differs'}`, 'form')
    }
    spec.push({ rel: doc.file, text })
  }

  /** @type {PlannedMilestone[]} */
  const milestones = converted.milestones.map((m) => {
    const proposed = m.impl === 'done' ? 'done' : m.impl === 'partial' ? 'in-progress' : 'planned'
    const body = [m.note ?? '', m.link ? `<${m.link}>` : '', `${t.oldId}: \`${m.id}\``].filter(Boolean).join('\n\n')
    return { id: `M-${m.n}`, n: m.n, from: m.id, title: m.title, proposed, why: `impl: ${m.impl ?? 'none'}`, file: `${MILESTONES}/${fileName('M', m.n, slugOf(m.title))}`, body }
  })

  // the ideas, to the Ideas type's folder
  const ideaType = modules.flatMap((m) => m.records ?? []).find((x) => x.prefix === 'I')
  /** @type {RecordFormat} */
  const format = ideaType ?? { fields: ['title', 'status'] }
  const ideasTo = ideaType?.folder ?? NEW_IDEAS
  const ideas = filesIn(root, OLD_IDEAS).filter((f) => /^I-\d+(-.*)?\.md$/.test(f)).sort().map((name) => {
    const from = `${OLD_IDEAS}/${name}`
    const rel = `${ideasTo}/${name}`
    if (has(root, rel)) throw fail(`${rel} exists already: the idea ${from} cannot move there`, 'conflict')
    const rec = readRecord(fs.readFileSync(path.join(root, from), 'utf8'), format)
    rec.id ??= `I-${Number(/^I-(\d+)/.exec(name)?.[1])}`
    const accepted = rec.fields.status === 'to-develop'
    if (accepted) {
      rec.fields.status = 'accepted'
      rec.history = [...rec.history, `${day} · ${WHO} · status: to-develop → accepted`]
    }
    return { id: rec.id, from, rel, text: writeRecord(rec, format), accepted }
  })

  // the changes: C-1, the split ones (C-2…, in the plan's order), then the open questions
  /** @type {PlannedChange[]} */
  const changes = []
  const splitAt = 2
  const questionsId = converted.questions.length ? `C-${splitAt + split.length}` : ''
  const kind = (/** @type {string} */ k) => t.kinds[k] ?? k
  const mapped = converted.ids.map((x) => {
    const to = x.kind === 'question' ? questionsId : x.to
    return `- \`${x.from}\` → ${to ? (/^[IMC]-\d+$/.test(to) ? to : `\`${to}\``) : t.nothing} (${kind(x.kind)})`
  })
  // a split section or item keeps its id; C-1 says where it went (a part or document is above)
  split.forEach((e, i) => {
    for (const id of e.split) if (!converted.ids.some((x) => x.from === id)) mapped.push(`- \`${id}\` → C-${splitAt + i} (${kind('split')})`)
  })
  const count = countItems(converted)
  changes.push(change(1, t.initial, 'done', {
    problem: t.initialProblem,
    solution: t.initialSolution,
    scope: [t.idsIntro, '', ...mapped].join('\n'),
  }, `created by migrate from ${MAP}; status: done (merged, ${count} items)`))

  const ideaIds = new Set(ideas.map((x) => x.id))
  split.forEach((e, i) => {
    const n = splitAt + i
    /** @type {Record<string, any>} */
    const fields = { title: String(e.title).trim() }
    const named = e.ideas ?? []
    const unknownIdeas = named.filter((x) => !ideaIds.has(x))
    if (unknownIdeas.length) throw fail(`${e.title}: no idea ${unknownIdeas.join(', ')} in ${OLD_IDEAS}/`, 'split')
    if (named.length) fields.ideas = named
    if (e.milestone) {
      const m = milestones.find((x) => x.id === e.milestone || x.from === e.milestone)
      if (!m) throw fail(`${e.title}: no milestone ${e.milestone} (${milestones.map((x) => `${x.id} ${x.from}`).join(', ') || 'the map has no roadmap'})`, 'split')
      fields.milestone = m.id
    }
    fields.status = 'awaiting-approval'
    const branches = e.split.map((id) => /** @type {import('./convert.mjs').Split} */ (converted.split.find((s) => s.id === id)))
    const items = proposedItems(branches, converted.lang)
    const ids = e.split.map((id) => `\`${id}\``).join(', ')
    changes.push(change(n, fields.title, 'awaiting-approval', {
      problem: e.problem ?? t.splitProblem(ids),
      solution: e.solution ?? t.splitSolution,
      scope: e.scope, outOfScope: e.outOfScope, items,
    }, `created by migrate from ${MAP} (split: ${e.split.join(', ')}; ${items.length} proposed items)`, fields))
  })

  if (questionsId) {
    const lines = converted.questions.flatMap((q) => [
      `- ${q.topic} · \`${q.id}\` · ${q.document} › ${q.section}`,
      ...(q.note ? q.note.split('\n').map((l) => (l ? `  ${l}` : '')) : []),
      ...(q.link ? [`  <${q.link}>`] : []),
    ])
    changes.push(change(splitAt + split.length, t.questions, 'grilling', { problem: t.questionsProblem, questions: lines.join('\n') },
      `created by migrate from ${MAP} (${converted.questions.length} open questions)`))
  }

  const remove = [...new Set(converted.oldFiles)].filter((rel) => {
    if (!has(root, rel)) return false
    const text = fs.readFileSync(path.join(root, rel), 'utf8')
    return GENERATED.some((m) => text.startsWith(m))
  })

  return { root, today: day, converted, spec, changes, milestones, ideas, remove, map: MAP, mapTo: MAP_BACKUP }

  /** @param {number} n @param {string} title @param {string} status @param {import('../records/types.mjs').ChangeParts} parts @param {string} what @param {Record<string, any>} [fields] @returns {PlannedChange} */
  function change(n, title, status, parts, what, fields = { title, status }) {
    const id = `C-${n}`
    const file = `${CHANGES}/${fileName('C', n, slugOf(title))}`
    const text = writeRecord({ id, fields, body: changeBody(parts, id), history: [`${day} · ${WHO} · ${what}`] }, CHANGE_TYPE)
    return { id, title, status, file, text, ...(parts.items?.length ? { items: parts.items } : {}) }
  }
}

/** @param {Converted} c */
function countItems(c) {
  let n = 0
  /** @param {import('../records/spec-format.mjs').SpecItem[]} items */
  const walk = (items) => { for (const it of items) { n++; walk(it.items) } }
  for (const { doc } of c.docs) { walk(doc.items); for (const s of doc.sections) walk(s.items) }
  return n
}

/**
 * The approved state of every milestone, from `states` (see the top); refused when one is missing.
 * @param {PlannedMilestone[]} milestones
 * @param {string | undefined} states
 * @returns {string[]}
 */
export function milestoneStates(milestones, states) {
  const allowed = MILESTONE_TYPE.lifecycle.states
  const words = String(states ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  /** @type {Array<string | undefined>} */
  let out = milestones.map(() => undefined)
  if (words.length && words.every((w) => allowed.includes(w))) {
    if (words.length !== milestones.length) throw fail(`${words.length} states for ${milestones.length} milestones: give one per milestone, in order`, 'states')
    out = words
  } else {
    const rest = words.includes('proposed')
    for (const w of words.filter((x) => x !== 'proposed')) {
      const m = /^([^=\s]+)=(\S+)$/.exec(w)
      const i = m ? milestones.findIndex((x) => x.id === m[1] || x.from === m[1]) : -1
      if (!m || i < 0) throw fail(`${w}: not a milestone's state (M-1=done, or its map id: r-1=done)`, 'states')
      out[i] = m[2]
    }
    if (rest) out = out.map((s, i) => s ?? milestones[i].proposed)
  }
  const bad = out.filter((s) => s !== undefined && !allowed.includes(s))
  if (bad.length) throw fail(`unknown milestone state ${bad.join(', ')}: one of ${allowed.join(', ')}`, 'states')
  const missing = milestones.filter((_, i) => out[i] === undefined)
  if (missing.length) {
    throw fail(`every milestone needs an approved state; missing: ${missing.map((m) => `${m.id} (${m.from}, proposed ${m.proposed})`).join(', ')}. Pass --milestones proposed, or M-1=done,...`, 'states')
  }
  return /** @type {string[]} */ (out)
}

/**
 * Writes the plan: the Spec, the changes, the milestones, the ideas; removes the generated documents
 * and moves the map away. Refused, without writing anything, when a milestone has no approved state.
 * @param {Plan} plan
 * @param {{ states?: string }} [options]
 * @returns {{ written: string[], removed: string[], moved: string[] }}
 */
export function applyMigration(plan, { states } = {}) {
  const chosen = milestoneStates(plan.milestones, states)
  const { root } = plan
  const files = projectFiles(root, ['docs/product', '.groundwork'])
  /** @type {string[]} */
  const written = []
  /** @param {string} rel @param {string} text */
  const write = (rel, text) => { files.write(rel, text); written.push(rel) }

  for (const w of plan.spec) write(w.rel, w.text)
  for (const c of plan.changes) write(c.file, c.text)
  plan.milestones.forEach((m, i) => {
    const history = [`${plan.today} · ${WHO} · created by migrate from ${m.from}; status: ${chosen[i]}`]
    write(m.file, writeRecord({ id: m.id, fields: { title: m.title, status: chosen[i] }, body: m.body, history }, MILESTONE_TYPE))
  })
  /** @type {string[]} */
  const moved = []
  for (const idea of plan.ideas) {
    write(idea.rel, idea.text)
    files.remove(idea.from)
    moved.push(`${idea.from} → ${idea.rel}`)
  }
  // A folder under docs/product/ left empty by the migration goes too (through the writer's checks).
  /** @param {string} rel */
  const removeEmpty = (rel) => { if (rel.startsWith('docs/product/') && rel.split('/').length >= 3) files.removeEmptyDir(rel) }
  removeEmpty(OLD_IDEAS)
  for (const rel of plan.remove) {
    files.remove(rel)
    removeEmpty(path.posix.dirname(rel))
  }
  write(plan.mapTo, fs.readFileSync(path.join(root, plan.map), 'utf8'))
  files.remove(plan.map)
  moved.push(`${plan.map} → ${plan.mapTo}`)
  return { written, removed: plan.remove, moved }
}

export { ORIGIN, CORE_RECORDS }
