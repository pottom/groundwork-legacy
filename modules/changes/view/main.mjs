// The Changes page: the entry module index.html loads. Without a query it shows the list of changes
// (GET /api/changes/list, <gw-changes-list>); with ?change=C-3 (the shell's deep link
// /?module=changes&change=C-3) that change's page (GET /api/changes/show, <gw-change-page>).
// Either reads again when the shell says a change file changed (topic "changes.items"), a record it
// names changed ("records": an idea's or a milestone's title), a commit moved the base of the
// marks ("changes.commit"), or the connection came back. The language follows the shell (strings.mjs).
//
// What a read changed flashes for a few seconds (d-changes-flash): on the page, the parts, questions
// and proposed items the last write added or changed (compare.mjs, against the page read before);
// in the list, the rows that changed. A read that fails keeps the last good page and says so; so
// does a change that is gone for a moment once its page was read (an editor saving by rename).

import { subscribe } from '/shell/live.mjs'
import { compareChanges, anyChange } from '../compare.mjs'
import { i18n } from './strings.mjs'
import './changes-list.mjs'
import './change-page.mjs'

const FLASH_MS = 3500
const list = /** @type {any} */ (document.getElementById('list'))
const page = /** @type {any} */ (document.getElementById('page'))
const wanted = new URLSearchParams(location.search).get('change')
let flashTimer = 0

// the highlight of what changed, cleared after a moment (changes.css fades it out)
/** @param {() => void} set @param {() => void} clear */
function flash(set, clear) {
  set()
  clearTimeout(flashTimer)
  flashTimer = window.setTimeout(clear, FLASH_MS)
}

/** @param {string} url */
async function get(url) {
  const res = await fetch(url, { cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function readList() {
  try {
    const { stages, changes } = await get('/api/changes/list')
    const before = new Map((list.changes ?? []).map((/** @type {any} */ c) => [c.id, JSON.stringify(c)]))
    const changed = list.changes ? changes.filter((/** @type {any} */ c) => before.get(c.id) !== JSON.stringify(c)).map((/** @type {any} */ c) => c.id) : []
    Object.assign(list, { stages, changes, error: null })
    if (changed.length) flash(() => { list.fresh = new Set(changed) }, () => { list.fresh = new Set() })
  } catch (e) {
    list.error = e instanceof Error ? e.message : String(e)
  }
  document.body.dataset.state = list.error ? 'error' : 'ready'
}

async function readPage() {
  try {
    const next = await get(`/api/changes/show?id=${encodeURIComponent(String(wanted))}`)
    if (!next) {
      if (page.page) page.error = 'HTTP 404'   // gone for now: the last good page stays
      else Object.assign(page, { missing: wanted, error: null })
      return
    }
    const diff = page.page ? compareChanges(page.page.content, next.content) : null
    Object.assign(page, { page: next, missing: null, error: null })
    document.title = `${next.id} · ${next.title}`
    if (diff && anyChange(diff)) flash(() => { page.flash = diff }, () => { page.flash = null })
  } catch (e) {
    page.error = e instanceof Error ? e.message : String(e)   // the last good page stays
  } finally {
    document.body.dataset.state = page.error && !page.page ? 'error' : 'ready'
  }
}

const read = wanted ? readPage : readList
list.hidden = Boolean(wanted)
page.hidden = !wanted

const showLang = () => { document.documentElement.lang = i18n.lang; list.lang = i18n.lang; page.lang = i18n.lang }
showLang()
i18n.onChange(showLang)
subscribe({
  onHello: read,
  onChange: (topics) => { if (topics.some((t) => t === 'changes.items' || t === 'changes.commit' || t === 'records')) read() },
})
