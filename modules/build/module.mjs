// The Build module as the core server loads it: the development dashboard and
// its read-only endpoints.
//
//   GET /build/                          the dashboard (index.html)
//   GET /api/build/hello                 { server, api, version, git, name, launcher }: the page checks it talks to us
//   GET /api/build/list                  { files: [{ path, size, mtime }], dirs: { folder: count of other files } }
//   GET /api/build/file?path=<p>         the text of a listed markdown file
//   GET /api/build/git[?limit=n&known=f] branches, tags, commits and merges when the root is the top of a
//                                        git repository; { unchanged: true } while nothing moved since `known`
//
// HEAD is answered too; every other method gets 405. Nothing is ever written
// into the project: files are only read (project-reader.mjs keeps them inside
// the root), git is only asked to read.
//
// Opened by double click instead, index.html asks for the project folder
// (Chromium) and needs none of this; only the git view needs the server.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openProject } from './project-reader.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// What the page checks to know it talks to this module. The same values are
// SERVER_ID, SERVER_API and VERSION in index.html.
const SERVER_ID = 'development-status';
const API_VERSION = 1;
const VERSION = '2.0.0';

const GIT_LIMIT = 400;
const GIT_MAX_LIMIT = 5000;

function send(res, status, type, body, head) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(head ? undefined : data);
}
const sendText = (res, status, text, head) => send(res, status, 'text/plain; charset=utf-8', text + '\n', head);
const sendJson = (res, value, head) => send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ server: SERVER_ID, api: API_VERSION, ...value }), head);

async function git(project, url) {
  if (!(await project.gitAvailable())) return { available: false };
  const limit = Math.min(GIT_MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || GIT_LIMIT));
  try {
    // The page says what it has: unchanged, the answer is only that.
    const known = url.searchParams.get('known');
    if (known && known === project.cachedFingerprint(limit) && known === (await project.gitFingerprint())) {
      return { available: true, unchanged: true, fingerprint: known };
    }
    return await project.gitHistory(limit);
  } catch (error) {
    return { available: false, error: String(error && error.message ? error.message : error).split('\n')[0] };
  }
}

export default {
  id: 'build',
  name: 'Build',
  version: VERSION,
  view: { dir: HERE, files: ['index.html'] },
  api({ root }) {
    const project = openProject(root);
    const name = path.basename(project.root);
    return async (req, res, sub, url) => {
      const head = req.method === 'HEAD';
      if (req.method !== 'GET' && !head) return sendText(res, 405, 'Method not allowed'), true;
      if (sub === '/hello') return sendJson(res, { version: VERSION, git: true, name, launcher: 'node core/groundwork.mjs' }, head), true;
      if (sub === '/list') return sendJson(res, { name, ...project.list() }, head), true;
      if (sub === '/file') {
        const body = project.readFile(url.searchParams.get('path') || '');
        return (body ? send(res, 200, 'text/plain; charset=utf-8', body, head) : sendText(res, 404, 'Not found', head)), true;
      }
      if (sub === '/git') return sendJson(res, await git(project, url), head), true;
      return false;
    };
  },
};
