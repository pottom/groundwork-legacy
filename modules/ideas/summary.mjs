// What became of an accepted idea, per change, as one line of its card (d-idea-summary): the
// change's stage, how many of its items are in the Spec, and its tickets done out of all where
// Build knows them, e.g. `→ C-12 · Implementing, 4 items in the Spec · 2/5 tickets done`. Nothing
// is kept by hand: the change comes from the list (stage, items, inSpec: computed by the server on
// each read), the tickets from Build's public GET /api/build/changes. Shared by the page
// (view/changes.mjs) and the tests.
//
//   changeSummary(change, tickets, t)  the line; tickets: { total, done } or undefined (no Build,
//                                      no GitHub, or no ticket names the change: left out);
//                                      t: the translation, (key, vars) → text

export function changeSummary(change, tickets, t) {
  let line = t('card.change', { id: change.id, stage: t(`change.${change.stage || change.status}`) })
  const { items = 0, inSpec = 0 } = change
  if (inSpec > 0) {
    line += inSpec >= items ? t(items === 1 ? 'card.change-spec-one' : 'card.change-spec', { n: items })
      : t('card.change-spec-part', { n: inSpec, of: items })
  }
  if (tickets?.total > 0) line += t('card.change-tickets', { done: tickets.done, total: tickets.total })
  return line
}
