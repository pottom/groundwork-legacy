// The module frames of the shell, in the browser. Served at /shell/frames.mjs.
//
// The shell keeps one frame per visited module and only hides the others, so a switch is
// instant and a module keeps its state (the map its zoom and selection, Build its scroll and
// filters). A hidden frame stays laid out at full size (shell.css hides it with `visibility`,
// not `display: none`, so nothing inside it is resized or scrolled back), and it is `inert`:
// it takes no focus, clicks or keys. The shell's live relay and language switch reach every
// frame, hidden or not (live.mjs, i18n.mjs).
//
//   const frames = moduleFrames(document.querySelector('.gw-main'))  // adopts the server's iframe.gw-view[data-module]
//   frames.show('build', { title: 'Build', query: '?ticket=12' })
//
// show() loads a module's view only on its first visit, or when a deep link brings a query
// other than the one its frame was opened with; an empty query keeps the frame as it is.

export function moduleFrames(main, { doc = main.ownerDocument } = {}) {
  const frames = new Map()   // id -> { el, query }
  const queryOf = (src) => { const i = (src ?? '').indexOf('?'); return i < 0 ? '' : src.slice(i) }
  for (const el of main.querySelectorAll('iframe.gw-view')) frames.set(el.dataset.module, { el, query: queryOf(el.getAttribute('src')) })
  const address = (id, query) => '/' + encodeURIComponent(id) + '/' + query

  return {
    show(id, { title, query = '' }) {
      let entry = frames.get(id)
      if (!entry) {
        const el = doc.createElement('iframe')
        el.className = 'gw-view'
        el.dataset.module = id
        el.title = title
        el.src = address(id, query)
        main.appendChild(el)
        entry = { el, query }
        frames.set(id, entry)
      } else if (query && query !== entry.query) {
        entry.query = query
        entry.el.contentWindow.location.replace(address(id, query))
      }
      for (const [other, { el }] of frames) {
        const hide = other !== id
        if (hide && doc.activeElement === el) el.blur()
        el.hidden = hide
        el.inert = hide
      }
      return entry.el
    },
  }
}
