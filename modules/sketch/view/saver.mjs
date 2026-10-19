// When the page writes the sketch. Excalidraw calls onChange on every pointer move and every
// scroll; the sketch is saved only when the drawing changed (an element's id or version, an
// embedded image), and only once the changes rest for DELAY_MS. A failed save leaves the
// drawing unsaved, so the next change tries again.
//
//   const saver = createSaver({ save })        save(elements, appState, files): a promise
//   saver.loaded(elements, files)              the drawing as read: nothing to save yet
//   saver.change(elements, appState, files)    Excalidraw's onChange
//   saver.flush()                              save now what is waiting (leaving the page)

export const DELAY_MS = 700

// What tells one drawing from another: its elements' versions and its images.
const signature = (elements, files) =>
  elements.map((e) => `${e.id}:${e.version}`).join(',') + '|' + Object.keys(files ?? {}).sort().join(',')

export function createSaver({ save, delay = DELAY_MS, timers = globalThis }) {
  let saved = null      // the signature on disk
  let pending = null    // [elements, appState, files] waiting to be saved
  let timer = 0

  async function flush() {
    timers.clearTimeout(timer)
    timer = 0
    if (!pending) return
    const [elements, appState, files] = pending
    pending = null
    const sig = signature(elements, files)
    if (sig === saved) return
    try {
      await save(elements, appState, files)
      saved = sig
    } catch {
      // stays unsaved: the next change tries again (save() shows the error)
    }
  }

  return {
    loaded(elements, files) {
      saved = signature(elements, files)
    },
    change(elements, appState, files) {
      if (signature(elements, files) === saved) return
      pending = [elements, appState, files]
      timers.clearTimeout(timer)
      timer = timers.setTimeout(flush, delay)
    },
    flush,
  }
}
