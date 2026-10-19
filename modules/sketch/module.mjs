// The Sketch module as the core server loads it: a drawing board (Excalidraw) whose sketches are
// standard .excalidraw files in git, under docs/product/sketches/.
//
//   GET /sketch/?sketch=<name>          the board (index.html); Excalidraw and React load only here
//   GET  /api/sketch/list               { sketches: [{ name }] }, in name order
//   POST /api/sketch/create             { name }: a new empty sketch (201; 409 when it exists)
//   POST /api/sketch/rename             { from, to }: moves the file (409 when `to` exists)
//   GET /api/sketch/scene?name=<name>   the sketch's scene (the .excalidraw file), or an empty one
//   GET  /api/sketch/links              (public) who links to what: { sketches: { name: [target] },
//                                       linked: { idea|node|ticket|sketch: { ref: [names] } },
//                                       renamed: { old: new } } (links-store.mjs)
//   POST /api/sketch/link               { name, target }: the sketch links to target
//                                       (groundwork://idea/I-12, view/targets.mjs); 400 when it is not one
//   POST /api/sketch/unlink             { name, target }: the link goes again
//   PUT /api/sketch/scene?name=<name>   the page's save: the scene, deleted elements included;
//                                       needs content-type application/json (415 otherwise), 400 when
//                                       it is not a scene or the name is not a plain name, 413 when an
//                                       embedded image is too large; nothing is written then. A save
//                                       merges with the file element by element (merge.mjs)
//   GET  /api/sketch/threads?name=<name> { threads: [{ element, closed, orphaned, comments: [{ author, at, text }] }] }
//   POST /api/sketch/comment?name=<name> { element, text, author? }: a comment on the shape's thread,
//                                       starting it; without an author it is the developer's (git
//                                       user.name, else the OS user); 404 when there is no such shape
//   POST /api/sketch/close?name=<name>   { element, closed? }: closes the thread (closed: false reopens)
//
// Threads pinned to shapes live beside the sketch in <name>.threads.json (threads.mjs).
// Claude reads and draws with `groundwork sketch show | apply` and answers with `threads | comment` (sketch.mjs), taught by the
// groundwork-sketch skill that `groundwork init` installs. A change of a sketch file is the topic
// sketch.files, on which the open page reads the sketch again, so Claude's drawing shows at once.
//
// <name> is a plain name (sketches.mjs) and defaults to "main". The reads answer GET (and HEAD) only,
// 405 otherwise. Every write must be JSON (415, core/http.mjs isJson), so
// another site cannot post a form into the sketches. The module is a tool, not a step
// of the workflow: the shell shows its tab after the others, behind a separator (`tool: true`).

import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { send, readJson, isJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { openSketches, SketchError, DIR } from './sketch-store.mjs'
import { openThreads } from './threads.mjs'
import { openLinks, LINKS_FILE } from './links-store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// The page's files, the only ones served under /sketch/.
const VIEW_FILES = ['index.html', 'sketch.css', 'ui-strings.mjs', 'view/asset-path.js', 'view/main.mjs', 'view/board.mjs', 'view/saver.mjs', 'view/follow.mjs', 'view/theme.mjs', 'view/sketches.mjs', 'view/pins.mjs', 'view/thread-panel.mjs', 'view/targets.mjs', 'view/links.mjs', 'merge.mjs']

export default {
  id: 'sketch',
  name: 'Sketch',
  tagline: { en: 'Draw it out together', hu: 'Rajzold le közösen' },
  icon: '<path d="M4.5 19.5l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.9 18.3z"/><path d="M14 7l3 3"/><path d="M13 19.5h6.5"/>',   // a pencil drawing a line
  version: VERSION,
  tool: true,
  view: { dir: HERE, files: VIEW_FILES },
  writes: [DIR],
  // the links file is its own topic; any other file there is a sketch, which the open page reads again
  watch: (p) => (p === LINKS_FILE ? 'sketch.links' : p.startsWith(DIR + '/') ? 'sketch.files' : null),
  cli: path.join(HERE, 'sketch.mjs'),   // groundwork sketch list | show | apply
  claude: { skills: [path.join(HERE, 'skills', 'groundwork-sketch')] },
  public: ['GET /api/sketch/links'],   // who links to what (README.md, "Public endpoints")
  api({ root, files }) {
    const store = openSketches(files, root)
    const threads = openThreads(files, store)
    const nameIn = (url) => url.searchParams.get('name') ?? 'main'
    const links = openLinks(files)
    return async (req, res, sub, url) => {
      if (sub === '/threads') return read(req, res, () => ({ threads: threads.list(nameIn(url)) }))
      if (sub === '/comment') return change(req, res, async (b) => send(res, 200, threads.comment(nameIn(url), b.element, { text: b.text, author: b.author || developer(root) })))
      if (sub === '/close') return change(req, res, async (b) => send(res, 200, threads.close(nameIn(url), b.element, b.closed)))
      if (sub === '/list') return read(req, res, () => ({ sketches: store.list().map((name) => ({ name })) }))
      if (sub === '/links') return read(req, res, () => links.index())
      if (sub === '/create') return change(req, res, async (body) => (store.create(body.name), links.created(body.name), send(res, 201, { name: body.name })))
      if (sub === '/rename') return change(req, res, async ({ from, to }) => (store.rename(from, to), links.renamed(from, to), send(res, 200, { name: to })))
      if (sub === '/link') return change(req, res, async ({ name, target }) => (links.add(name, target), send(res, 200, links.index())))
      if (sub === '/unlink') return change(req, res, async ({ name, target }) => (links.remove(name, target), send(res, 200, links.index())))
      if (sub !== '/scene') return false
      try {
        const name = nameIn(url)
        if (req.method === 'GET' || req.method === 'HEAD') return send(res, 200, store.read(name)), true
        if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed' }), true
        if (!isJson(req)) return send(res, 415, { error: 'expected application/json' }), true
        store.save(name, await body(req))
        send(res, 200, { saved: true })
      } catch (e) {
        send(res, e instanceof SketchError ? e.status : 500, { error: e.message })
      }
      return true
    }
  },
}

// A request's JSON body; what does not parse is the client's error (400).
async function body(req) {
  try {
    return await readJson(req)
  } catch (e) {
    throw new SketchError(e.message)
  }
}

// A read (GET or HEAD; 405 otherwise) that answers what fn gives; its SketchError (a name that is
// not a plain name) is the client's.
function read(req, res, fn) {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' }), true
    send(res, 200, fn())
  } catch (e) {
    send(res, e instanceof SketchError ? e.status : 500, { error: e.message })
  }
  return true
}

// Who comments from the page: the developer, as git knows them in this project, else the OS user.
let who
function developer(root) {
  if (who) return who
  try { who = execFileSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim() } catch {}
  if (!who) try { who = os.userInfo().username } catch {}
  return (who ||= 'developer')
}

// A POST that changes the sketches (create, rename) or their threads (comment, close): fn gets its JSON body.
async function change(req, res, fn) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }), true
    if (!isJson(req)) return send(res, 415, { error: 'expected application/json' }), true
    const b = await body(req)
    await fn(b && typeof b === 'object' ? b : {})
  } catch (e) {
    send(res, e instanceof SketchError ? e.status : 500, { error: e.message })
  }
  return true
}
