// The Sketch module as the core server loads it: a drawing board (Excalidraw) whose sketches are
// standard .excalidraw files in git, under docs/product/sketches/.
//
//   GET /sketch/                        the board (index.html); Excalidraw and React load only here
//   GET /api/sketch/scene?name=<name>   the sketch's scene (the .excalidraw file), or an empty one
//   PUT /api/sketch/scene?name=<name>   the page's save: the scene, deleted elements included;
//                                       needs content-type application/json (415 otherwise), 400 when
//                                       it is not a scene or the name is not a plain name, 413 when an
//                                       embedded image is too large; nothing is written then. A save
//                                       merges with the file element by element (merge.mjs)
//
// Claude reads and draws with `groundwork sketch show | apply` (sketch.mjs), taught by the
// groundwork-sketch skill that `groundwork init` installs. A change of a sketch file is the topic
// sketch.files, on which the open page reads the sketch again, so Claude's drawing shows at once.
//
// <name> defaults to "main", the one sketch of this first version. The module is a tool, not a step
// of the workflow: the shell shows its tab after the others, behind a separator (`tool: true`).

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send, readJson } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { openSketches, SketchError, DIR } from './sketch-store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// The page's files, the only ones served under /sketch/.
const VIEW_FILES = ['index.html', 'sketch.css', 'ui-strings.mjs', 'view/asset-path.js', 'view/main.mjs', 'view/board.mjs', 'view/saver.mjs', 'view/follow.mjs', 'view/theme.mjs', 'merge.mjs']

export default {
  id: 'sketch',
  name: 'Sketch',
  tagline: { en: 'Draw it out together', hu: 'Rajzold le közösen' },
  icon: '<path d="M4.5 19.5l1.2-4.4L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.9 18.3z"/><path d="M14 7l3 3"/><path d="M13 19.5h6.5"/>',   // a pencil drawing a line
  version: VERSION,
  tool: true,
  view: { dir: HERE, files: VIEW_FILES },
  writes: [DIR],
  watch: (p) => (p.startsWith(DIR + '/') ? 'sketch.files' : null),   // the open page reads the sketch again
  cli: path.join(HERE, 'sketch.mjs'),   // groundwork sketch show | apply
  claude: { skills: [path.join(HERE, 'skills', 'groundwork-sketch')] },
  public: [],   // nothing another module may read yet (modules/README.md)
  api({ files }) {
    const store = openSketches(files)
    return async (req, res, sub, url) => {
      if (sub !== '/scene') return false
      try {
        const name = url.searchParams.get('name') ?? 'main'
        if (req.method === 'GET' || req.method === 'HEAD') return send(res, 200, store.read(name)), true
        if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed' }), true
        if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return send(res, 415, { error: 'expected application/json' }), true
        let scene
        try {
          scene = await readJson(req)
        } catch (e) {
          throw new SketchError(e.message)
        }
        store.save(name, scene)
        send(res, 200, { saved: true })
      } catch (e) {
        send(res, e instanceof SketchError ? e.status : 500, { error: e.message })
      }
      return true
    }
  },
}
