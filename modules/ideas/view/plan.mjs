// The page's way to Plan's map. Ideas never writes the map: it asks Plan through the one endpoint
// Plan declares for it (POST /api/plan/todo, d-ideas-plan-endpoint), then links the idea to the node
// Plan made; the node links back to the idea. Without Plan, or without a map, the answer is "the map
// is unavailable", not an error: Ideas keeps working (d-module-endpoints).
//
//   toMap(idea, { status: 'todo' | 'excluded', reason? }, save)
//     -> { id, idea }        the node, and the idea as saved with the node among its links
//      | { unavailable: true }
//      | { error, id? }      Plan refused it, or the link could not be saved
//     save: saveIdea from api.mjs
//   mapLinks(idea)  [{ id, href }] the idea's links that are map nodes, with Plan's deep link: a link
//                   that is not an idea (I-3), a ticket (#42) or an address
//   planLink(id)    the address that opens Plan with that node focused
//   mapStep(before, idea, { nonGoal }?)  what a change of status sends to the map, wherever it was
//                   made (move, drawer, reject dialog): { status: 'todo' } for a product idea that
//                   became To develop, { status: 'excluded', reason } for a rejected one when the human
//                   asked (nonGoal), else null. before: the status the idea had.

export const mapStep = (before, idea, { nonGoal = false } = {}) => {
  if (idea.status === 'rejected') return nonGoal ? { status: 'excluded', reason: idea.reason } : null
  if (idea.status === 'to-develop' && before !== 'to-develop' && (idea.kind || 'product') === 'product') return { status: 'todo' }
  return null
}

export const planLink = (id) => '/?module=plan&node=' + encodeURIComponent(id)

const NOT_A_NODE = /^(I-\d+|#\d+|[a-z][\w+.-]*:|\/)/i

export const mapLinks = (idea) => (idea.links ?? []).filter((l) => !NOT_A_NODE.test(l)).map((id) => ({ id, href: planLink(id) }))

export async function toMap(idea, { status, reason }, save) {
  let res
  try {
    res = await fetch('/api/plan/todo', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: idea.id, title: idea.title, status, reason }),
    })
  } catch {
    return { unavailable: true }
  }
  const body = await res.json().catch(() => ({}))
  if (res.status === 404) return { unavailable: true }
  if (!res.ok || !body.id) return { error: body.error || `HTTP ${res.status}` }
  if ((idea.links ?? []).includes(body.id)) return { id: body.id, idea }
  const saved = await save(idea, { links: [...(idea.links ?? []), body.id] })
  return saved.ok ? { id: body.id, idea: saved.idea } : { id: body.id, error: saved.error ?? 'stale' }
}
