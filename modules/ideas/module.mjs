// The Ideas module as the core server loads it: manifest, view and endpoints.
//
//   GET /ideas/               the kanban (index.html)
//   GET /api/ideas/list       { ideas: [{ id: 'I-12', n, file, title, body, author, source, kind, status, created }] }
//
// Every idea is a Markdown file under docs/product/ideas/items/ (store.mjs); that folder is the only
// one Ideas may write to. `groundwork ideas add|list` (ideas.mjs) writes and reads the same files.
//
// Live updates (core/events.mjs): an idea file changing is the topic "ideas.items"; the page then
// asks /api/ideas/list again.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { send } from '../../core/http.mjs'
import { VERSION } from '../../core/version.mjs'
import { ITEMS, openIdeas } from './store.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export default {
  id: 'ideas',
  name: 'Ideas',
  tagline: { en: 'Numbered ideas on a board', hu: 'Számozott ötletek táblán' },
  icon: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',   // a light bulb
  version: VERSION,   // the package's: one version for Groundwork and its modules
  // The page: a thin index.html, its own modules under view/ (lit-html templates; view/main.mjs is the
  // entry), and the modules it shares with the server.
  view: { dir: HERE, files: [
    'index.html', 'view/ideas.css', 'view/main.mjs', 'view/board.mjs', 'view/strings.mjs',
    'ui-strings.mjs', 'fields.mjs',
  ] },
  // The only folder Ideas may write to: the idea files.
  writes: [ITEMS],
  // Nothing another module may read yet (modules/README.md).
  public: [],
  // `groundwork ideas <command>` runs ideas.mjs.
  cli: path.join(HERE, 'ideas.mjs'),
  // `groundwork init` installs this skill: Claude files its side observations as ideas through the CLI.
  claude: { skills: [path.join(HERE, 'skills', 'groundwork-ideas')] },
  watch: (p) => (p.startsWith(ITEMS + '/') && p.endsWith('.md') ? 'ideas.items' : null),
  api({ root, files }) {
    const store = openIdeas(root, files)
    return async (req, res, sub) => {
      if (sub !== '/list') return false
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method not allowed' }), true
      return send(res, 200, { ideas: store.list() }), true
    }
  },
}
