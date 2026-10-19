// What Plan's page holds: one object every view module reads and changes, and the
// look-ups into the map that need the Mind Elixir instance. No rendering here.

const KEY = 'groundwork-plan:'
// The browser remembers the mode, the view and the focus across reloads (when it may).
export function recall(name) { try { return localStorage.getItem(KEY + name) } catch { return null } }
export function remember(name, value) { try { localStorage.setItem(KEY + name, value) } catch {} }

export const state = {
  page: 'loading',        // 'loading' | 'empty' (no map file yet) | 'ready'
  mind: null,             // the Mind Elixir instance, once the map is loaded
  version: null,          // the version of the map file the page has (the server's)
  dirty: false,           // an edit is waiting to be saved
  saving: false,
  // Per map item, the tickets naming it on their PRD line: { id: { total, done, tickets } } from
  // /api/build/prd (the Build module reads them with its ticket reader). {} without Build.
  ticketCounts: {},
  // Per map item, the sketches that link to it: { id: [name] } from /api/sketch/links (the Sketch
  // module's public endpoint). {} without Sketch.
  sketchLinks: {},
  glossary: '',           // the project's GLOSSARY.md, shown under a PRD or a system overview
  mode: recall('mode') === 'edit' ? 'edit' : 'view',
  wantedView: recall('view'), // the view chosen; a narrow window may show another (view-rules.mjs)
  focus: recall('focus') || 'all', // what the map shows: 'all', a component's id or a document's id
  doc: null,              // id of the document shown in the panel
  editor: null,           // the open paragraph editor: { section, which: 'claude' | 'new' | <paragraph id> }
  notice: null,           // the notice under the toolbar: { key, vars }
  legendOpen: false,
}

export const isEditMode = () => state.mode === 'edit'
// Something is being typed: a node's name on the map, or a paragraph in the document.
export const editing = () => !!document.getElementById('input-box') || !!state.editor

// In focus mode Mind Elixir's nodeData is just the focused branch; this is always the whole map.
export const fullTree = () => (state.mind.isFocusMode ? state.mind.nodeDataBackup : state.mind.nodeData)
export const mapData = () => ({ nodeData: fullTree() })
// Mind Elixir's findEle throws when a node is not on screen (collapsed or outside the focused layer).
export const ele = (id) => { try { return state.mind.findEle(id) } catch { return null } }
export function findNode(id) {
  const f = (n) => (n.id === id ? n : (n.children || []).map(f).find(Boolean))
  return f(fullTree())
}
