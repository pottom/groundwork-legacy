// The Excalidraw board, mounted with React (both from /vendor/, globals of their UMD builds). Our
// own code stays plain ES modules; React is only Excalidraw's.
//
//   const board = mountBoard(element, { scene, onChange })   scene: the .excalidraw file as read
//   board.set({ dark, lang })                                 re-renders with the shell's theme and language
//   board.api                                                 Excalidraw's imperative API once mounted, else null
//                                                             (updateScene, addFiles, getSceneElementsIncludingDeleted)
//
// Excalidraw's own file and theme actions are off: the sketch is saved by the page, and light or
// dark follows the OS like the shell. Embeds are off too: no iframe of another site, and so
// Excalidraw's tweet template (the one far URL in its bundle, core/offline.test.mjs) never runs.

export function boardProps({ scene, onChange, onApi, dark, lang }) {
  return {
    initialData: { elements: scene.elements, appState: scene.appState, files: scene.files, scrollToContent: true },
    onChange,
    excalidrawAPI: onApi,
    theme: dark ? 'dark' : 'light',
    langCode: lang === 'hu' ? 'hu-HU' : 'en',
    validateEmbeddable: false,
    UIOptions: {
      canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: { saveFileToDisk: true } },
    },
  }
}

// Excalidraw 0.17.6 offers only the languages it has translated to 85% or more; its Hungarian is at
// 70%, so it is not in `languages`, though its locale ships (excalidraw-assets/locales/hu-HU-json-*.js).
// Added here, the board speaks Hungarian, and a label not translated yet stays English.
export function offerHungarian(languages) {
  if (!languages.some((l) => l.code === 'hu-HU')) languages.push({ code: 'hu-HU', label: 'Magyar' })
}

export function mountBoard(element, { scene, onChange }) {
  const { React, ReactDOM, ExcalidrawLib } = window
  offerHungarian(ExcalidrawLib.languages)
  const root = ReactDOM.createRoot(element)
  let state = { dark: false, lang: 'en' }
  let api = null
  const onApi = (a) => { api = a }
  const render = () => root.render(React.createElement(ExcalidrawLib.Excalidraw, boardProps({ scene, onChange, onApi, ...state })))
  return {
    get api() { return api },
    set(next) {
      state = { ...state, ...next }
      render()
    },
  }
}
