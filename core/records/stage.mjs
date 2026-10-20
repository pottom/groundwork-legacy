// @ts-check
// The stage of a change (C-n), computed from its file (d-changes-stage-interview). The core's, so
// every module shows the same stage: the Changes module's list and page (modules/changes/stages.mjs
// re-exports these), and an accepted idea's card (the Ideas module's list).
//
//   questionsOf(text)    -> { questions: [{ key, text, done }], text }   the questions of a change's
//                                  Kérdések section: its top-level list items (`- `, `* `, `1. `) with
//                                  their indented lines; a checked one (`- [x] …`) is done (answered).
//                                  key: the text, lower case, blanks folded (questionKey); text: the
//                                  section's prose, which is no question
//   openQuestions(text)  -> n      how many of them are open
//   mapQuestions(nodes)  -> n      the ? nodes of a thought map, at any depth (d-map-questions)
//   stageOf(status, questions)     the stage: the two interview stages are computed (open questions,
//                                  the map's and an old list's together → grilling, none →
//                                  awaiting-approval); implementing, done and dropped still come from
//                                  the status field, until the merge (C-5) and the tickets (C-8)
//                                  can compute them
//   changeStage(rec)     -> { stage, questions }   of a change record ({ fields, body }), from its
//                                  map and its old questions list (readChange)

import { readChange } from './changes.mjs'

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

/** @param {import('./types.mjs').ThoughtNode[] | undefined} nodes @returns {number} */
export const mapQuestions = (nodes) => (nodes ?? []).reduce((n, t) => n + (t.kind === 'question' ? 1 : 0) + mapQuestions(t.children), 0)

/** @param {unknown} status @param {number} questions */
export function stageOf(status, questions) {
  const s = String(status ?? '')
  if (LATER.has(s)) return s
  return questions > 0 ? 'grilling' : 'awaiting-approval'
}

/** @param {{ fields: Record<string, unknown>, body: string }} rec @param {import('./types.mjs').ChangeParts} [parts] */
export function changeStage(rec, parts = readChange(rec.body)) {
  const questions = mapQuestions(parts.thoughts) + openQuestions(parts.questions)
  return { stage: stageOf(rec.fields.status, questions), questions }
}
