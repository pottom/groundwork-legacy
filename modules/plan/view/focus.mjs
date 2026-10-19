// What the map shows (the whole map, one component, or one document: Mind Elixir's focus mode),
// in step with the document in the panel, and the deep link (?node=<id>) that points at one node.
//   applyFocus({ keepView })  the map shows state.focus again (after a reload of the map)
//   setFocus(id), pickDoc(docId), focusLinked()
//   groupDocs(docs), docName(doc)  the documents as the pickers list them

import { listDocs } from '../documents.mjs'
import { linkTarget } from '../deep-link.mjs'
import { state, remember, mapData, findNode, ele } from './state.mjs'
import { update, showNotice } from './chrome.mjs'
import { renderPrd, highlightInPrd, resetFlash } from './document.mjs'
import { decorate, fitMap, reveal, selectOnMap } from './map.mjs'

// The documents by component, in map order: { doc } on its own, or { component, docs }.
export function groupDocs(docs) {
  const groups = [], byComp = new Map()
  for (const d of docs) {
    if (!d.component) { groups.push({ doc: d }); continue }
    if (!byComp.has(d.component.id)) { const g = { component: d.component, docs: [] }; byComp.set(d.component.id, g); groups.push(g) }
    byComp.get(d.component.id).docs.push(d)
  }
  return groups
}
// A document's name in a picker: "Component › Document", so a closed picker is never ambiguous.
export const docName = (d) => (d.component ? `${d.component.topic} › ${d.label}` : d.label)

export function applyFocus({ keepView = true } = {}) {
  const mind = state.mind
  if (!mind) return
  const target = state.focus !== 'all' ? findNode(state.focus) : null
  if (!target) state.focus = 'all'
  const transform = mind.map.style.transform
  if (mind.isFocusMode) mind.cancelFocus()
  if (target) { reveal(target.id); const el = ele(target.id); if (el) mind.focusNode(el) }
  if (keepView) mind.map.style.transform = transform
  decorate()
}

const toTop = () => { document.getElementById('prd').scrollTop = 0 }

// focusing a document shows it in the panel; focusing a component shows its first document
export function setFocus(id) {
  state.focus = id
  remember('focus', id)
  const docs = listDocs(mapData())
  const asDoc = docs.find((d) => d.id === id)
  const inComp = docs.filter((d) => d.component?.id === id)
  if (asDoc) state.doc = asDoc.id
  else if (inComp.length && !inComp.some((d) => d.id === state.doc)) state.doc = inComp[0].id
  resetFlash()
  applyFocus({ keepView: false })
  requestAnimationFrame(fitMap)
  renderPrd()
  toTop()
}

// choosing a document in the panel moves the map focus along, unless the map shows everything
export function pickDoc(docId) {
  const d = listDocs(mapData()).find((x) => x.id === docId)
  if (state.focus === 'all' || (d?.component && d.component.id === state.focus)) {
    state.doc = docId
    resetFlash()
    renderPrd()
    toTop()
    return
  }
  setFocus(docId)
}

// The document the panel starts with: the one focused, the first of the component focused, or the first.
export function firstDoc() {
  const docs = listDocs(mapData())
  return (docs.find((d) => d.id === state.focus) || docs.find((d) => d.component?.id === state.focus) || docs[0]).id
}

// ---- deep link: ?node=<id> focuses that node (see deep-link.mjs) ----
// The node is brought into the map's focus layer, selected, flashed and shown in the
// document; an id the map does not have is said so in a notice under the toolbar.
export function focusLinked() {
  const target = linkTarget(location.search, mapData())
  if (!target) return
  if (!target.found) { showNotice('link.unknown', { id: target.id }); return }
  showNotice(null)
  const layer = state.focus !== 'all' ? findNode(state.focus) : null
  const inLayer = (n) => n.id === target.id || (n.children || []).some(inLayer)
  if (layer && !inLayer(layer)) setFocus(target.doc || 'all')
  selectOnMap(target.id)
  const el = ele(target.id)
  if (el) {
    el.classList.remove('mm-linked'); void el.offsetWidth; el.classList.add('mm-linked')
    requestAnimationFrame(() => requestAnimationFrame(() => state.mind.scrollIntoView(el, true))) // after setFocus's fit: centre it
  }
  highlightInPrd(target.id)
  update()
}
