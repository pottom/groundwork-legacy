// The page's two calls to the Ideas server (module.mjs).
//
//   listIdeas()                 the ideas, as GET /api/ideas/list gives them; throws when it cannot
//   saveIdea(idea, changes)     PUT /api/ideas/item/<id> on the version the page saw (idea.version):
//                               { ok: true, idea } | { stale: true, idea } (saved elsewhere meanwhile)
//                               | { error } (a wrong value, or no answer)

export async function listIdeas() {
  const res = await fetch('/api/ideas/list', { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()).ideas
}

export async function saveIdea(idea, changes) {
  try {
    const res = await fetch(`/api/ideas/item/${idea.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base: idea.version, changes }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 409) return { stale: true, idea: body.idea }
    if (!res.ok) return { error: body.error || `HTTP ${res.status}` }
    return { ok: true, idea: body.idea }
  } catch (e) {
    return { error: e.message }
  }
}
