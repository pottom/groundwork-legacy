// The rules of Plan's screen that need no browser (the page, view/, uses them):
//   resolveView(wanted, width)    the view a window of that width shows: 'map' | 'split' | 'prd'
//   fitScale(content, box, {min}) the zoom that fits the map in its box, never below a readable minimum
//   summaryBadges(count, t)       the document header's badges, in the UI language
//   coalesce(fn, schedule)        a function that runs fn at most once per frame, however often called

export const VIEWS = ['map', 'split', 'prd']
// Below this width the map and the document do not fit side by side.
export const SPLIT_MIN_WIDTH = 900
// With nothing chosen yet, a window this wide starts with both.
const SPLIT_DEFAULT_WIDTH = 1100

export function resolveView(wanted, width) {
  const view = VIEWS.includes(wanted) ? wanted : width >= SPLIT_DEFAULT_WIDTH ? 'split' : 'map'
  return view === 'split' && width < SPLIT_MIN_WIDTH ? 'map' : view
}

// Smaller than this, a node's text is no longer readable.
export const MIN_FIT_SCALE = 0.55

export function fitScale(content, box, { min = MIN_FIT_SCALE } = {}) {
  const fit = 1 / Math.max(1, content.width / box.width, content.height / box.height)
  return fit < min ? { scale: min, clamped: true } : { scale: fit, clamped: false }
}

// count: progressSummary() of documents.mjs; t: the UI translation.
export function summaryBadges(count, t) {
  const sections = count.done + count.active + count.untouched
  const badges = sections ? [{ tone: count.done ? 'ok' : 'neutral', text: t('summary.sections', { done: count.done, total: sections }) }] : []
  if (count.inferred) badges.push({ tone: 'info', text: t('summary.inferred', { n: count.inferred }) })
  if (count.impl.done) badges.push({ tone: 'ok', text: t('summary.built', { n: count.impl.done }) })
  if (count.impl.partial) badges.push({ tone: 'warn', text: t('summary.partial', { n: count.impl.partial }) })
  if (count.impl.missing) badges.push({ tone: 'bad', text: t('summary.missing', { n: count.impl.missing }) })
  return badges
}

export function coalesce(fn, schedule = (f) => requestAnimationFrame(f)) {
  let pending = false
  return () => {
    if (pending) return
    pending = true
    schedule(() => { pending = false; fn() })
  }
}
