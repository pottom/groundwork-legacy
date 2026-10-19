// Plan's page: the entry module index.html loads. It wires the parts together; each lives in a
// module of its own:
//   state.mjs     what the page holds              strings.mjs   the UI language
//   data.mjs      the map from the server, saving, live updates
//   map.mjs       the map (Mind Elixir): lines, theme, decoration, pan, fit
//   focus.mjs     what the map shows, the deep link
//   chrome.mjs    renders the chrome: toolbar.mjs, legend.mjs, dock.mjs, the notice, toasts, empty state
//   document.mjs  the document panel; editor.mjs its paragraph editor
//   icons.mjs     the icons
// The chrome and the document render with lit-html (/vendor/lit-html/); Mind Elixir draws the map.

import { i18n } from './strings.mjs'
import { installNodeIcons } from './icons.mjs'
import { state } from './state.mjs'
import { update, toggleLegend } from './chrome.mjs'
import { closeLegendOutside } from './legend.mjs'
import { setView, observeToolbar } from './toolbar.mjs'
import { showNoteTips, labelMap, decorate } from './map.mjs'
import { resetFlash } from './document.mjs'
import { connect } from './data.mjs'

installNodeIcons()
document.documentElement.lang = i18n.lang
document.body.dataset.mode = state.mode
setView(state.wantedView, { fit: false, remember: false }) // draws the chrome
observeToolbar()
closeLegendOutside(() => toggleLegend(false))
showNoteTips(document.getElementById('tip'))
addEventListener('resize', () => setView(state.wantedView, { remember: false }))

// Says everything again in the language chosen (in the shell, or in another page of Groundwork).
i18n.onChange(() => {
  document.documentElement.lang = i18n.lang
  update()
  labelMap()
  if (!state.mind) return
  resetFlash() // a new language is not a change of content
  decorate()
})

connect()
