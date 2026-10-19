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
//   PUT /api/sketch/scene?name=<name>   the page's save: the scene as Excalidraw serialises it;
//                                       needs content-type application/json (415 otherwise), 400 when
//                                       it is not a scene or the name is not a plain name, 413 when an
//                                       embedded image is too large; nothing is written then
//
// <name> is a plain name (sketches.mjs) and defaults to "main". Every write must be JSON (415), so
// another site cannot post a form into the sketches. The module is a tool, not a step
// of the workflow: the shell shows its tab after the others, behind a separator (`tool: true`).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { openSketches, SketchError, DIR } from './sketch-store.mjs'
import { openLinks, LINKS_FILE } from './links-store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// The page's files, the only ones served under /sketch/.
const VIEW_FILES = ['index.html', 'sketch.css', 'ui-strings.mjs', 'view/asset-path.js', 'view/main.mjs', 'view/board.mjs', 'view/saver.mjs', 'view/theme.mjs', 'view/sketches.mjs', 'view/targets.mjs', 'view/links.mjs']

export default {
  id: 'sketch',
  name: 'Sketch',
  tagline: { en: 'Draw it out together', hu: 'Rajzold le közösen' },
  icon: '<path d="M4.5 19.5l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.9 18.3z"/><path d="M14 7l3 3"/><path d="M13 19.5h6.5"/>',   // a pencil drawing a line
  version: VERSION,
  tool: true,
  view: { dir: HERE, files: VIEW_FILES },
  writes: [DIR],
  public: ['GET /api/sketch/links'],   // who links to what (README.md, "Public endpoints")
  watch: (p) => (p === LINKS_FILE ? 'sketch.links' : null),
  api({ root, files }) {
    const store = openSketches(files, root)
    const links = openLinks(files)
    return async (req, res, sub, url) => {
      if (sub === '/list') return send(res, 200, { sketches: store.list().map((name) => ({ name })) }), true
      if (sub === '/links') return send(res, 200, links.index()), true
      if (sub === '/create') return change(req, res, async (body) => (store.create(body.name), links.created(body.name), send(res, 201, { name: body.name })))
      if (sub === '/rename') return change(req, res, async ({ from, to }) => (store.rename(from, to), links.renamed(from, to), send(res, 200, { name: to })))
      if (sub === '/link') return change(req, res, async ({ name, target }) => (links.add(name, target), send(res, 200, links.index())))
      if (sub === '/unlink') return change(req, res, async ({ name, target }) => (links.remove(name, target), send(res, 200, links.index())))
      if (sub !== '/scene') return false
      try {
        const name = url.searchParams.get('name') ?? 'main'
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

// A write must say it is JSON, so another site cannot post a form into the sketches.
const isJson = (req) => /^application\/json\b/i.test(req.headers['content-type'] ?? '')

// A request's JSON body; what does not parse is the client's error (400).
async function body(req) {
  try {
    return await readJson(req)
  } catch (e) {
    throw new SketchError(e.message)
  }
}

// A POST that changes which sketches there are (create, rename): fn gets its JSON body.
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
