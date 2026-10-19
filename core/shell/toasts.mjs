// Short messages of a module page: saved, could not save, copied. Served at /shell/toasts.mjs.
// Each is a .gw-toast (feedback.css) in the page's <div class="gw-toasts" id="toasts" aria-live="polite">,
// and goes by itself after a while: transient activity, never a second live indicator.
//
//   import { createToasts } from '/shell/toasts.mjs'
//   const toast = createToasts(document.getElementById('toasts'), { ms: 3600 })
//   toast('Saved I-12')                 tone 'ok' (default), 'info' or 'bad'; a 'bad' one is an alert,
//   toast('Could not save', 'bad')      any other a status
//
// timer stands in for setTimeout in the tests. Without a box (null) a toast is dropped.

export function createToasts(box, { ms = 3600, timer = setTimeout } = {}) {
  return function toast(text, tone = 'ok') {
    if (!box) return
    const el = box.ownerDocument.createElement('div')
    el.className = `gw-toast gw-toast--${tone}`
    el.setAttribute('role', tone === 'bad' ? 'alert' : 'status')
    el.textContent = text
    box.append(el)
    timer(() => el.remove(), ms)
  }
}
