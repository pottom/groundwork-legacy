// @ts-check
// The change page as the server gives it (d-changes-page-readonly): every part of the change's file,
// its Markdown rendered for the page, and the marks of what changed since a base version (the file
// at the last commit, since.mjs; d-changes-since-commit).
//
//   contentOf({ fields, body })    the content compare.mjs compares: { title, sections: { problem?,
//                                  solution?, scope?, outOfScope?, questionsText? }, questions, items,
//                                  thoughts } (thoughts: the map's nodes, flat, thoughts.mjs)
//                                  read through the core's readChange, so a file written by hand in
//                                  the patient form (English headings, `->`) reads the same
//   baseOf(text)  -> Content|null  the content of a change file's whole text (front matter and all),
//                                  or null without one
//   changePage(shown, { base?, merged?, waits? })   the list's row (stages.mjs: changeRow; questions
//                                  is the number of open ones; merged: store.merged's answer) and { file,
//                                  version, tickets, history, content, html, marks, waits }: waits, the
//                                  items that wait for another change to be merged first
//                                  (d-merge-in-order; store.waits): [{ id, waitsFor: 'C-3', on, title }],
//                                  title that change's; version is the
//                                  file's, which approving sends back as its base
//                                  shown: the store's show(); base: a Content or null. html holds the
//                                  rendered Markdown, by key: sections[key], questions[key], notes[id],
//                                  of the parts shown and of the removed ones the marks keep; raw HTML
//                                  in a change shows as text (core/records/render.mjs). marks: a Diff
//                                  (compare.mjs), null without a base

import { readChange } from '../../core/records/changes.mjs'
import { readRecord } from '../../core/records/format.mjs'
import { renderMarkdown } from '../../core/records/render.mjs'
import { CHANGE_TYPE } from './type.mjs'
import { questionsOf, changeRow } from './stages.mjs'
import { compareChanges } from './compare.mjs'
import { flatThoughts } from './thoughts.mjs'

/** @typedef {import('./compare.mjs').Content} Content */
/** @typedef {import('./compare.mjs').Diff} Diff */
/** @typedef {{ id: string, waitsFor: string, on: string, title: string }} Wait */

const TEXT_PARTS = /** @type {const} */ (['problem', 'solution', 'scope', 'outOfScope'])

/** @param {{ fields: Record<string, unknown>, body: string }} rec @returns {Content} */
export function contentOf({ fields, body }) {
  const parts = readChange(body)
  /** @type {Record<string, string>} */
  const sections = {}
  for (const k of TEXT_PARTS) if (parts[k]) sections[k] = String(parts[k])
  const { questions, text } = questionsOf(parts.questions)
  if (text) sections.questionsText = text
  const items = parts.items.map((i) => ({ op: i.op, id: i.id, target: i.target, ...(i.text ? { text: i.text } : {}), ...(i.note ? { note: i.note } : {}) }))
  return { title: String(fields.title ?? ''), sections, questions, items, thoughts: flatThoughts(parts.thoughts) }
}

/** @param {string | null | undefined} text @returns {Content | null} */
export function baseOf(text) {
  if (text == null) return null
  const rec = readRecord(text, CHANGE_TYPE)
  return rec.id ? contentOf(rec) : null
}

/** @param {{ sections: Record<string, string>, questions: Record<string, string>, notes: Record<string, string> }} html @param {Content['sections']} sections @param {import('./compare.mjs').Question[]} questions @param {import('./compare.mjs').Item[]} items */
function render(html, sections, questions, items) {
  for (const [k, t] of Object.entries(sections)) if (t) html.sections[k] = renderMarkdown(t)
  for (const q of questions) html.questions[q.key] = renderMarkdown(q.text)
  for (const i of items) if (i.note) html.notes[i.id] = renderMarkdown(i.note)
}

/**
 * @param {import('../../core/records/types.mjs').ShownRecord} shown
 * @param {{ base?: Content | null, merged?: boolean, waits?: Wait[] }} [opts]
 */
export function changePage(shown, { base = null, merged = false, waits = [] } = {}) {
  const content = contentOf(shown)
  const marks = base ? compareChanges(base, content) : null
  const html = { sections: {}, questions: {}, notes: {} }
  render(html, content.sections, content.questions, content.items)
  if (marks) render(html, marks.removed.sections, marks.removed.questions, marks.removed.items)
  return {
    ...changeRow(shown, { merged }),
    file: shown.file,
    version: shown.version,
    tickets: readChange(shown.body).tickets,
    history: [...shown.history],
    content,
    html,
    marks,
    waits,
  }
}
