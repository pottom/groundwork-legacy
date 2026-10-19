// The impact–effort matrix (f-ideas-matrix), shared by the page and the tests: a 2×2 of the open
// ideas (New and Considering) with the quick wins first. An estimate has three levels (fields.mjs
// LEVELS) and the matrix two halves per axis: `high` and `low` sit in their own half, and `medium`
// leans to the less favourable one (low impact, high effort), so only a sure quick win shows as one.
//
//   QUADRANTS              [{ id, impact, effort }]: quick-wins, big-bets, fill-ins, time-sinks
//   quadrantOf(idea)       the quadrant id, or null when impact or effort is not set yet
//   placeOnMatrix(ideas)   { 'quick-wins': [...], 'big-bets', 'fill-ins', 'time-sinks', unestimated: [...] }
//   estimateFor(idea, q)   the changes a move to quadrant q makes: only the half that differs, set to
//                          that half's level ({} when the idea is already there)

export const QUADRANTS = [
  { id: 'quick-wins', impact: 'high', effort: 'low' },
  { id: 'big-bets', impact: 'high', effort: 'high' },
  { id: 'fill-ins', impact: 'low', effort: 'low' },
  { id: 'time-sinks', impact: 'low', effort: 'high' },
]
const OPEN = ['new', 'considering']

// The half an estimate falls in: the favourable one only when it is sure.
const impactHalf = (level) => (level === 'high' ? 'high' : level === 'low' || level === 'medium' ? 'low' : null)
const effortHalf = (level) => (level === 'low' ? 'low' : level === 'high' || level === 'medium' ? 'high' : null)

export function quadrantOf(idea) {
  const impact = impactHalf(idea.impact)
  const effort = effortHalf(idea.effort)
  if (!impact || !effort) return null
  return QUADRANTS.find((q) => q.impact === impact && q.effort === effort).id
}

export function placeOnMatrix(ideas) {
  const placed = Object.fromEntries([...QUADRANTS.map((q) => [q.id, []]), ['unestimated', []]])
  for (const idea of ideas) if (OPEN.includes(idea.status)) placed[quadrantOf(idea) ?? 'unestimated'].push(idea)
  return placed
}

export function estimateFor(idea, quadrant) {
  const q = QUADRANTS.find((x) => x.id === quadrant)
  if (!q) throw new Error(`no such quadrant: ${quadrant}`)
  const changes = {}
  if (impactHalf(idea.impact) !== q.impact) changes.impact = q.impact
  if (effortHalf(idea.effort) !== q.effort) changes.effort = q.effort
  return changes
}
