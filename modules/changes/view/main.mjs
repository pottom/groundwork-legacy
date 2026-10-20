// The Changes page: the entry module index.html loads. It reads the list (GET /api/changes/list)
// into <gw-changes-list> (changes-list.mjs), and reads it again when the shell says a change file
// changed (topic "changes.items"), a record it names changed ("records": an idea's or a milestone's
// title), or the connection came back. The language follows the shell (strings.mjs).

import { subscribe } from '/shell/live.mjs'
import { i18n } from './strings.mjs'
import './changes-list.mjs'

const list = /** @type {any} */ (document.getElementById('list'))

async function read() {
  try {
    const res = await fetch('/api/changes/list', { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const { stages, changes } = await res.json()
    Object.assign(list, { stages, changes, error: null })
  } catch (e) {
    list.error = e instanceof Error ? e.message : String(e)
  }
  document.body.dataset.state = list.error ? 'error' : 'ready'
}

const showLang = () => { document.documentElement.lang = i18n.lang; list.lang = i18n.lang }
showLang()
i18n.onChange(showLang)
subscribe({
  onHello: read,
  onChange: (topics) => { if (topics.includes('changes.items') || topics.includes('records')) read() },
})
