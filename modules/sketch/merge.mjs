// Two versions of one sketch's elements, merged element by element (d-board-merge). Excalidraw
// 0.17.6 does not export its own reconcileElements, so this is ours, by the same rule: every edit
// of an element raises its `version`, so of two copies of an element the higher version is the
// newer one; on the same version the lower `versionNonce` wins, so both sides end the same.
// A deletion is an edit too (`isDeleted: true`, a higher version), kept in the file as such, so
// the other side cannot bring the element back.
//
//   mergeElements(theirs, mine)   the merged list; front to back in `mine`'s order, and an element
//                                 only `theirs` has stays right after its neighbour there
//
// Plain JavaScript without imports: the server (a save, `groundwork sketch apply`) and the page
// (a change on disk while drawing) merge the same way.

const newer = (a, b) => a.version > b.version || (a.version === b.version && a.versionNonce < b.versionNonce)

export function mergeElements(theirs, mine) {
  const theirsById = new Map(theirs.map((e) => [e.id, e]))
  const mineIds = new Set(mine.map((e) => e.id))
  const pick = (e) => {
    const other = theirsById.get(e.id)
    return other && newer(other, e) ? other : e
  }
  const out = mine.map(pick)
  // Elements only theirs has: after the nearest element before them (in theirs) that is placed.
  let after = -1
  for (const e of theirs) {
    if (mineIds.has(e.id)) {
      after = out.findIndex((o) => o.id === e.id)
      continue
    }
    out.splice(++after, 0, e)
  }
  return out
}
