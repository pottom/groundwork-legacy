// The page's calls to the Ideas server (module.mjs), and to the modules it reads.
//
//   listIdeas()                 the ideas, as GET /api/ideas/list gives them; throws when it cannot
//   sketchLinks()               the sketches that link to each idea: { 'I-12': ['flow'] }, from the
//                               Sketch module's public GET /api/sketch/links; {} without Sketch
//   saveIdea(idea, changes)     PUT /api/ideas/item/<id> on the version the page saw (idea.version):
//                               { ok: true, idea } | { stale: true, idea } (saved elsewhere meanwhile)
//                               | { error } (a wrong value, or no answer)
//   acceptIdea(idea, route)     POST /api/ideas/accept?id=<id> on the version the page saw: the idea
//                               accepted and the change it opens, { ok: true, idea, change } |
//                               { stale: true, idea } | { error } (the server's refusal, e.g. a route
//                               not built yet, or no answer)
//   ideaTickets()               { 'I-12': [{ label, title, status, closed, url? }] }: the tickets naming
//                               each idea, from Build's public GET /api/build/ideas; {} without Build
//                               or without an answer (nothing to show, no error)
//   changeTickets()             { 'C-6': { total, done } }: the tickets naming each change on their
//                               "**Change:**" line, done out of all, from Build's public
//                               GET /api/build/changes; {} without Build or without an answer

export async function listIdeas() {
  const res = await fetch('/api/ideas/list', { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()).ideas
}

export async function sketchLinks() {
  try {
    const res = await fetch('/api/sketch/links', { cache: 'no-store' })
    return res.ok ? (await res.json()).linked?.idea ?? {} : {}
  } catch {
    return {}
  }
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

export async function acceptIdea(idea, route) {
  try {
    const res = await fetch(`/api/ideas/accept?id=${encodeURIComponent(idea.id)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ route, base: idea.version }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.status === 409 && body.code === 'stale' && body.idea) return { stale: true, idea: body.idea }
    if (!res.ok) return { error: body.error || `HTTP ${res.status}` }
    return { ok: true, idea: body.idea, change: body.change }
  } catch (e) {
    return { error: e.message }
  }
}

export async function changeTickets() {
  try {
    const res = await fetch('/api/build/changes', { cache: 'no-store' })
    return res.ok ? ((await res.json()).items ?? {}) : {}
  } catch {
    return {}
  }
}

export async function ideaTickets() {
  try {
    const res = await fetch('/api/build/ideas', { cache: 'no-store' })
    return res.ok ? ((await res.json()).items ?? {}) : {}
  } catch {
    return {}
  }
}
