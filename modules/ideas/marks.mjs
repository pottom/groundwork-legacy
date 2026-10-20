// @ts-check
// The quiet marks of an idea: computed on each read from its fields and history, never written to
// its file, and never asking for attention (the tab counts none of them).
//
//   marks(idea, now)        the marks the idea carries at `now` (a Date), in this order:
//     'snooze-passed'       snoozed, and its `until` date has passed; it stays Snoozed until the
//                           human brings it back (d-snooze-manual)
//     'stale'               in Considering for more than STALE_DAYS days (d-stale-quiet)
//   consideringSince(idea)  the date (YYYY-MM-DD) of the last history line that moved it to
//                           considering, else its `created` date, else ''
//
// Days are whole UTC calendar days, as the record store dates its history lines.

export const STALE_DAYS = 90

const DATE = /^\d{4}-\d\d-\d\d$/
const DAY = 24 * 60 * 60 * 1000
const MOVED_IN = /^(\d{4}-\d\d-\d\d) · [^·]* · (?:.*; )?status: \S+ → considering(?:;|$)/

/** @typedef {{ status?: string, until?: string, created?: string, history?: string[] }} Idea */

/** @param {Idea} idea */
export function consideringSince(idea) {
  const moved = (idea.history ?? []).map((h) => MOVED_IN.exec(h)?.[1]).filter(Boolean).at(-1)
  if (moved) return moved
  return DATE.test(idea.created ?? '') ? String(idea.created) : ''
}

/** @param {Idea} idea @param {Date} now @returns {string[]} */
export function marks(idea, now) {
  const today = now.toISOString().slice(0, 10)
  const out = []
  if (idea.status === 'snoozed' && DATE.test(idea.until ?? '') && String(idea.until) < today) out.push('snooze-passed')
  if (idea.status === 'considering') {
    const since = consideringSince(idea)
    if (since && (Date.parse(today) - Date.parse(since)) / DAY > STALE_DAYS) out.push('stale')
  }
  return out
}
