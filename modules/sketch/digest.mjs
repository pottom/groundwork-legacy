// What `groundwork sketch show` prints: a sketch as text Claude can reason about
// (f-board-claude-read). One line per element, with its id, so an op can name it:
//
//   Sketch main: 2 shapes, 1 arrow, 1 text
//   rectangle api "API" at 0,0 size 120x60
//   diamond ok "Valid?" at 300,0 size 192x96
//   arrow a1 "checks": api "API" -> ok "Valid?"
//   text note "Draft" at 0,200
//
// A shape's label shows on the shape, not as a text of its own; deleted elements are left out.
// For the picture itself Claude looks at the sketch in the browser pane (d-board-image).
//
//   digest(name, scene)   the text, lines joined with "\n"

const LINES = ['arrow', 'line']
const r = Math.round
const q = (s) => JSON.stringify(s)

export function digest(name, scene) {
  const live = (scene.elements ?? []).filter((e) => !e.isDeleted)
  const byId = new Map(live.map((e) => [e.id, e]))
  const labelOf = (e) => live.find((t) => t.type === 'text' && t.containerId === e.id)?.text
  const named = (e) => (labelOf(e) ? `${e.id} ${q(labelOf(e))}` : e.id)
  const link = (e) => (e.link ? ` link ${e.link}` : '')

  const texts = live.filter((e) => e.type === 'text' && !(e.containerId && byId.has(e.containerId)))
  const lines = live.filter((e) => LINES.includes(e.type))
  const shapes = live.filter((e) => e.type !== 'text' && !LINES.includes(e.type))
  if (!live.length) return `Sketch ${name}: empty. Draw on it with \`groundwork sketch apply ${name}\`.`

  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`
  const out = [`Sketch ${name}: ${[count(shapes.length, 'shape'), count(lines.length, 'arrow'), count(texts.length, 'text')].join(', ')}`]
  for (const e of shapes) {
    const label = labelOf(e) ? ` ${q(labelOf(e))}` : e.type === 'frame' && e.name ? ` ${q(e.name)}` : ''
    out.push(`${e.type} ${e.id}${label} at ${r(e.x)},${r(e.y)} size ${r(e.width)}x${r(e.height)}${link(e)}`)
  }
  for (const e of lines) {
    const end = (binding, [px, py]) => {
      const to = binding && byId.get(binding.elementId)
      return to ? named(to) : `${r(e.x + px)},${r(e.y + py)}`
    }
    const label = labelOf(e) ? ` ${q(labelOf(e))}` : ''
    const way = e.type === 'line' || (!e.endArrowhead && !e.startArrowhead) ? '--' : e.startArrowhead && e.endArrowhead ? '<->' : e.startArrowhead ? '<-' : '->'
    out.push(`${e.type} ${e.id}${label}: ${end(e.startBinding, e.points[0])} ${way} ${end(e.endBinding, e.points.at(-1))}${link(e)}`)
  }
  for (const e of texts) out.push(`text ${e.id} ${q(e.text)} at ${r(e.x)},${r(e.y)}${link(e)}`)
  return out.join('\n')
}
