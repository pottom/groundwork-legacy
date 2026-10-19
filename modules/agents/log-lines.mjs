// The event log's lines (what hook.mjs writes, one JSON object per line, oldest first), read by
// agents-log.mjs and timeline.mjs.
//
//   logEvents(text) -> the lines' objects, in order; a line that is not a JSON object is skipped

export function* logEvents(text) {
  for (const line of String(text).split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    if (e && typeof e === 'object' && !Array.isArray(e)) yield e
  }
}
