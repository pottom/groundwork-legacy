// @ts-check
// The stage of a change, and the row the list shows for it. Server side: module.mjs (the list it
// answers) and page.mjs (a change's page builds on the row); the page gets both ready. The stage
// itself is the core's (core/records/stage.mjs, re-exported here), so an idea's card shows the same.
//
//   STAGES                         the stages, in the order of the list's groups
//   questionsOf, openQuestions, mapQuestions, stageOf, questionKey   the core's (stage.mjs): the
//                                  questions of a change, and its stage from them and its status
//   changeRow(shown, { merged? }) -> Row   { id, n, title, status, stage, questions, items, merged,
//                                  ideas, milestone } from the store's show(): items is the number
//                                  of proposed items; merged whether they are all in the Spec
//                                  (store.merged, computed by the core; false when not given);
//                                  ideas and milestone are the resolved links ({ id, name?, module?,
//                                  title? }: a plain { id } when no module declares the type)

import { readChange } from '../../core/records/changes.mjs'
import { changeStage } from '../../core/records/stage.mjs'
import { CHANGE_TYPE } from './type.mjs'

export { questionKey, questionsOf, openQuestions, mapQuestions, stageOf } from '../../core/records/stage.mjs'

// the stages are the type's states: two of them computed, the rest still set
export const STAGES = [...CHANGE_TYPE.lifecycle.states]

/** @typedef {{ id: string, name?: string, module?: string, title?: string }} Chip */
/** @param {import('../../core/records/types.mjs').ResolvedLink} l @returns {Chip} */
export const chip = ({ id, name, module, title }) => ({ id, ...(name ? { name } : {}), ...(module ? { module } : {}), ...(title ? { title } : {}) })

/**
 * @param {{ id: string, n: number, fields: Record<string, unknown>, body: string, links: import('../../core/records/types.mjs').ResolvedLink[] }} shown
 * @param {{ merged?: boolean }} [opts]
 */
export function changeRow(shown, { merged = false } = {}) {
  const parts = readChange(shown.body)
  const { stage, questions } = changeStage(shown, parts)
  const status = String(shown.fields.status ?? '')
  const milestone = shown.links.find((l) => l.field === 'milestone')
  return {
    id: shown.id,
    n: shown.n,
    title: String(shown.fields.title ?? ''),
    status,
    stage,
    questions,
    items: parts.items.length,
    merged,
    ideas: shown.links.filter((l) => l.field === 'ideas').map(chip),
    milestone: milestone ? chip(milestone) : null,
  }
}
