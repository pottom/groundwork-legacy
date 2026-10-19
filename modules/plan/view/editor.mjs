// The paragraph editor of the document panel (edit mode). Section text lives on the main topic
// node: metadata.prose (Claude's) and metadata.humanProse (yours). Editing Claude's text turns it into yours.
//   openEditor(sectionId, which)  which: 'claude', 'new' or a paragraph id of yours
//   isOpen(sectionId, which), editorView()  for the panel's template

import { html, nothing } from '/vendor/lit-html/lit-html.js'
import { state, isEditMode, ele } from './state.mjs'
import { ui } from './strings.mjs'
import { renderPrd } from './document.mjs'

const newId = () => Math.random().toString(16).slice(2, 10)

export const isOpen = (sectionId, which) => state.editor?.section === sectionId && state.editor.which === which

function updateSection(sectionId, fn) {
  const tpc = ele(sectionId)
  if (!tpc) return
  const m = { ...(tpc.nodeObj.metadata || {}) }
  m.humanProse = [...(m.humanProse || [])]
  fn(m)
  if (!m.humanProse.length) delete m.humanProse
  if (!m.prose) delete m.prose
  state.mind.reshapeNode(tpc, { metadata: m })
}

export function openEditor(sectionId, which) {
  const node = ele(sectionId)?.nodeObj
  if (!node || state.editor || !isEditMode()) return
  const m = node.metadata || {}
  const text = which === 'claude' ? m.prose : which === 'new' ? '' : (m.humanProse || []).find((h) => h.id === which)?.text
  state.editor = { section: sectionId, which, text: text || '' }
  renderPrd({ force: true })
  document.querySelector('#prd .editor textarea')?.focus()
}

// result: the new text ('' deletes the paragraph), or undefined to cancel
function close(result) {
  const { section, which } = state.editor
  state.editor = null
  if (result !== undefined) updateSection(section, (m) => {
    if (which === 'claude') {
      delete m.prose
      if (result) m.humanProse.unshift({ id: newId(), text: result })
    } else if (which === 'new') {
      if (result) m.humanProse.push({ id: newId(), text: result })
    } else {
      const i = m.humanProse.findIndex((h) => h.id === which)
      if (i >= 0) { if (result) m.humanProse[i] = { ...m.humanProse[i], text: result }; else m.humanProse.splice(i, 1) }
    }
  })
  renderPrd()
}

const typed = (e) => e.target.closest('.editor').querySelector('textarea').value.trim()

export function editorView() {
  const { which, text } = state.editor
  return html`<div class="editor"><textarea class="gw-field" .value=${text} @keydown=${(e) => {
      if (e.key === 'Escape') close(undefined)
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) close(typed(e))
    }}></textarea>
    <div class="tip">${which === 'claude' ? ui('editor.tipClaude') : ui('editor.tip')}</div>
    <div class="row"><button type="button" class="gw-btn gw-btn--primary gw-btn--sm" @click=${(e) => close(typed(e))}>${ui('editor.save')}</button><button
      type="button" class="gw-btn gw-btn--sm" @click=${() => close(undefined)}>${ui('editor.cancel')}</button>${which !== 'new'
      ? html`<button type="button" class="gw-btn gw-btn--danger gw-btn--sm" @click=${() => close('')}>${ui('editor.delete')}</button>` : nothing}</div>
  </div>`
}
