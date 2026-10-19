// The open board following its sketch on disk (f-board-live): when the file changes (Claude drew
// with `groundwork sketch apply`, or another page saved), the page reads it again and merges it
// into the board element by element (merge.mjs), so what the developer is drawing right now,
// a higher version on the board, is not undone.
//
//   followDisk(board, disk)   the elements for the board, or null when the file brings nothing new
//                             (such as the page's own save coming back)

import { mergeElements } from '../merge.mjs'

export function followDisk(board, disk) {
  const merged = mergeElements(disk, board)
  const now = new Map(board.map((e) => [e.id, e]))
  return merged.some((e) => now.get(e.id) !== e) ? merged : null
}
