// @ts-check
// The stage of a change, and the row the list shows for it. Shared by the server (module.mjs, the
// list it answers) and nothing else yet; the page gets the rows ready.
//
//   STAGES                         the stages, in the order of the list's groups
//   openQuestions(text)  -> n      the open questions of a change's Kérdések section: its top-level
//                                  list items (`- `, `* `, `1. `), but a checked one (`- [x] …`) is
//                                  answered; prose is no question
//   stageOf(status, questions)     the stage: the two interview stages are computed (open questions →
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
const QUESTION = /^(?:[-*+]|\d+[.)])\s+(?!\[[xX]\])\S/

/** @param {string | undefined} text */
export function openQuestions(text) {
  return String(text ?? '').split(/\r?\n/).filter((line) => QUESTION.test(line)).length
}

/** @param {unknown} status @param {number} questions */
export function stageOf(status, questions) {
  const s = String(status ?? '')
  if (LATER.has(s)) return s
  return questions > 0 ? 'grilling' : 'awaiting-approval'
}

/** @typedef {{ id: string, name?: string, module?: string, title?: string }} Chip */
/** @param {import('../../core/records/types.mjs').ResolvedLink} l @returns {Chip} */
const chip = ({ id, name, module, title }) => ({ id, ...(name ? { name } : {}), ...(module ? { module } : {}), ...(title ? { title } : {}) })

/**
 * @param {{ id: string, n: number, fields: Record<string, unknown>, body: string, links: import('../../core/records/types.mjs').ResolvedLink[] }} shown
 */
export function changeRow(shown) {
  const parts = readChange(shown.body)
  const questions = openQuestions(parts.questions)
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
