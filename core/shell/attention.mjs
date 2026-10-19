// What needs the user's attention, on the module tabs of the shell. Served at /shell/attention.mjs.
//
// A module whose manifest names an `attention` endpoint (Agents: '/api/agents/attention') gets a
// count on its tab, and the shell shows a toast once for each new thing, even while another
// module is shown. The endpoint answers
//   { items: [{ key, reason, text: { en, hu } }], recheck: ISO | null }
// key: one per episode (a toast is shown once per key); text: the toast's line per UI language;
// reason 'failed' is toasted in the bad tone, the rest as info; recheck: when the answer changes
// by time alone, so the shell asks again then, once (no polling).
//
//   const w = watchAttention({ sources: [{ id, url, show(count) }], toast, lang: () => i18n.lang })
//   w.refresh()            on hello: ask every source
//   w.refresh(topics)      on a change: ask the sources whose module the topics belong to ('agents.events')
//
// What is there when the page opens is counted, not toasted: a toast is for what starts needing
// attention while one looks. A source that does not answer ok (its module missing) counts 0.
// fetch, timer, clearTimer and now stand in for the browser's in the tests.

const MAX_DELAY = 2 ** 31 - 1
const SLACK_MS = 1000   // ask a moment after the change, not just before it

export function watchAttention({ sources, toast, lang, fetch = globalThis.fetch, timer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
  const state = new Map(sources.map((s) => [s.id, { seen: null, timer: null, busy: null, again: false }]))

  async function read(source) {
    const st = state.get(source.id)
    let answer = null
    try {
      const res = await fetch(source.url, { cache: 'no-store' })
      if (res.ok) answer = await res.json()
    } catch { /* nothing to show */ }
    const items = Array.isArray(answer?.items) ? answer.items : []
    source.show(items.length)
    const first = st.seen == null
    const seen = new Set(items.map((i) => i.key))
    if (!first) {
      for (const i of items) if (!st.seen.has(i.key)) toast(i.text?.[lang()] ?? i.text?.en ?? '', i.reason === 'failed' ? 'bad' : 'info')
    }
    st.seen = seen
    clearTimer(st.timer)
    st.timer = null
    const at = answer?.recheck ? Date.parse(answer.recheck) : NaN
    if (!Number.isNaN(at)) st.timer = timer(() => ask(source), Math.min(MAX_DELAY, Math.max(0, at - now()) + SLACK_MS))
  }

  // One read per source at a time; a change during it asks once more after.
  async function ask(source) {
    const st = state.get(source.id)
    if (st.busy) { st.again = true; return st.busy }
    st.busy = read(source)
    await st.busy
    st.busy = null
    if (st.again) { st.again = false; await ask(source) }
  }

  return {
    refresh(topics) {
      const mine = (s) => !topics || topics.some((t) => t.startsWith(s.id + '.'))
      return Promise.all(sources.filter(mine).map(ask))
    },
  }
}
