// Which ideas a new text is likely to repeat: `groundwork ideas similar "<text>"` asks this
// before Claude files an idea, so a near duplicate is linked to the old one instead of filed twice.
//
//   similar(text, ideas, { min = 0.3, limit = 5 })   [{ idea, score }] the closest first; score 0..1
//
// No dependencies, no model: the words of the text against the words of each idea. Words are
// lower-cased, without accents, without the short and the most common ones, and without a plain
// English ending (switching, switches -> switch). The score weighs the title most:
//   0.6 x Jaccard(text, title) + 0.4 x (share of the text's words found in title and description)
// so a long description neither hides an idea nor makes it look similar to everything.

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'when', 'than', 'then', 'not', 'are', 'was',
  'can', 'should', 'would', 'could', 'have', 'has', 'all', 'any', 'its', 'our', 'out', 'use', 'via',
  'egy', 'hogy', 'nem', 'meg', 'van', 'ami', 'ahol', 'amikor', 'csak', 'mint', 'vagy', 'lesz', 'kell',
])

function stem(w) {
  for (const end of ['ing', 'es', 'ed', 's']) {
    if (w.endsWith(end) && w.length - end.length >= 3) return w.slice(0, -end.length)
  }
  return w
}

export function words(text) {
  const plain = String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return new Set(plain.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem))
}

const shared = (a, b) => [...a].filter((w) => b.has(w)).length

export function similar(text, ideas, { min = 0.3, limit = 5 } = {}) {
  const asked = words(text)
  if (!asked.size) return []
  return ideas.map((idea) => {
    const title = words(idea.title)
    const all = words(`${idea.title} ${idea.body ?? ''}`)
    const common = shared(asked, title)
    const jaccard = common / (asked.size + title.size - common || 1)
    const found = shared(asked, all) / asked.size
    return { idea, score: Math.round((0.6 * jaccard + 0.4 * found) * 100) / 100 }
  }).filter((r) => r.score >= min).sort((a, b) => b.score - a.score || a.idea.n - b.idea.n).slice(0, limit)
}
