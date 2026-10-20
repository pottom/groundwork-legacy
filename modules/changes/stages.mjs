// @ts-check
// The stage of a change, and the row the list shows for it. Server side: module.mjs (the list it
// answers) and page.mjs (a change's page builds on the row); the page gets both ready.
//
//   STAGES                         the stages, in the order of the list's groups
//   questionsOf(text)    -> { questions: [{ key, text, done }], text }   the questions of a change's
//                                  Kérdések section: its top-level list items (`- `, `* `, `1. `) with
//                                  their indented lines; a checked one (`- [x] …`) is done (answered).
//                                  key: the text, lower case, blanks folded (compare.mjs knows a
//                                  question by it); text: the section's prose, which is no question
//   openQuestions(text)  -> n      how many of them are open
//   mapQuestions(nodes)  -> n      the ? nodes of a thought map, at any depth (d-map-questions)
//   stageOf(status, questions)     the stage: the two interview stages are computed (open questions,
//                                  the map's and an old list's together →
//                                  grilling, none → awaiting-approval, d-changes-stage-interview);
//                                  implementing, done and dropped still come from the status field,
//                                  until the merge (C-5) and the tickets (C-8) can compute them
//   changeRow(shown) -> Row        { id, n, title, status, stage, questions, items, ideas, milestone }
//                                  from the store's show(): items is the number of proposed items;
//                                  ideas and milestone are the resolved links ({ id, name?, module?,
//                                  title? }: a plain { id } when no module declares the type)

import { readChange } from '../../core/records/changes.mjs'
import { CHANGE_TYPE } from './type.mjs'

// the stages are the type's states: two of them computed, the rest still set
export const STAGES = [...CHANGE_TYPE.lifecycle.states]
const LATER = new Set(['implementing', 'done', 'dropped'])
const QUESTION = /^(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(\S.*)$/

/** @typedef {{ key: string, text: string, done: boolean }} Question */
/** @param {string} text */
export const questionKey = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase()

/** @param {string | undefined} section @returns {{ questions: Question[], text: string }} */
export function questionsOf(section) {
  /** @type {Array<{ done: boolean, lines: string[] }>} */
  const found = []
  /** @type {string[]} */
  const prose = []
  /** @type {{ done: boolean, lines: string[] } | null} */
  let at = null
  for (const line of String(section ?? '').split(/\r?\n/)) {
    const m = QUESTION.exec(line)
    if (m) { at = { done: m[1] === 'x' || m[1] === 'X', lines: [m[2].trimEnd()] }; found.push(at) }
    else if (at && (/^\s/.test(line) || !line.trim())) at.lines.push(line.trim() ? line.replace(/^ {1,4}|^\t/, '').trimEnd() : '')
    else { at = null; prose.push(line) }
  }
  const questions = found.map(({ done, lines }) => {
    const text = lines.join('\n').replace(/\n+$/, '')
    return { key: questionKey(text), text, done }
  })
  return { questions, text: prose.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}

/** @param {string | undefined} text */
export const openQuestions = (text) => questionsOf(text).questions.filter((q) => !q.done).length

/** @param {import('../../core/records/types.mjs').ThoughtNode[] | undefined} nodes @returns {number} */
export const mapQuestions = (nodes) => (nodes ?? []).reduce((n, t) => n + (t.kind === 'question' ? 1 : 0) + mapQuestions(t.children), 0)

/** @param {unknown} status @param {number} questions */
export function stageOf(status, questions) {
  const s = String(status ?? '')
  if (LATER.has(s)) return s
  return questions > 0 ? 'grilling' : 'awaiting-approval'
}

/** @typedef {{ id: string, name?: string, module?: string, title?: string }} Chip */
/** @param {import('../../core/records/types.mjs').ResolvedLink} l @returns {Chip} */
export const chip = ({ id, name, module, title }) => ({ id, ...(name ? { name } : {}), ...(module ? { module } : {}), ...(title ? { title } : {}) })

/**
 * @param {{ id: string, n: number, fields: Record<string, unknown>, body: string, links: import('../../core/records/types.mjs').ResolvedLink[] }} shown
 */
export function changeRow(shown) {
  const parts = readChange(shown.body)
  const questions = mapQuestions(parts.thoughts) + openQuestions(parts.questions)
  const status = String(shown.fields.status ?? '')
  const milestone = shown.links.find((l) => l.field === 'milestone')
  return {
    id: shown.id,
    n: shown.n,
    title: String(shown.fields.title ?? ''),
    status,
    stage: stageOf(status, questions),
    questions,
    items: parts.items.length,
    ideas: shown.links.filter((l) => l.field === 'ideas').map(chip),
    milestone: milestone ? chip(milestone) : null,
  }
}
