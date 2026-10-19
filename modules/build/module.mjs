// The Build module as the core server loads it: the development dashboard and
// its read-only endpoints.
//
//   GET /build/                          the dashboard (index.html)
//   GET /api/build/hello                 { server, api, version, git, name, launcher }: the page checks it talks to us
//   GET /api/build/list                  { files: [{ path, size, mtime }], dirs: { folder: count of other files } }
//   GET /api/build/file?path=<p>         the text of a listed markdown file
//   GET /api/build/git[?limit=n&known=f] branches, tags, commits and merges when the root is the top of a
//                                        git repository; { unchanged: true } while nothing moved since `known`
//   GET /api/build/issues[?known=f]      the GitHub issues of the "origin" remote's repository (github-source.mjs):
//                                        { available, repo, issues, fingerprint, error? }, or { available: false,
//                                        reason }; { unchanged: true } while they are the same as `known`
//   GET /api/build/prd                   { items: { <PRD item id>: { total, done, tickets } } }: per item of
//                                        Plan's map, the tickets naming it on their PRD line, read with the
//                                        page's ticket reader (project-tickets.mjs); Plan shows the counts
//
// Live updates (core/events.mjs): a markdown file changing is the topic "build.files", a git ref
// or HEAD "build.git"; while a page listens, the server asks GitHub afresh every
// ISSUES_CHECK_MS and pushes "build.issues" when the issues changed. The page then asks again
// and gets the answer the re-check kept: a change on GitHub shows within one re-check.
//
// GitHub is asked by the server only (gh CLI, or GITHUB_TOKEN): no token ever reaches the page.
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
import { githubRepo, openGitHub } from './github-source.mjs';
import { openTickets, prdProgress } from './project-tickets.mjs';
import { VERSION } from '../../core/version.mjs';
import { send, TYPES } from '../../core/http.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// What the page checks to know it talks to this module. The same values are
// SERVER_ID and SERVER_API in index.html. The version is the package's (core/version.mjs): the
// page and this server ship together, so the page shows the one it gets from /hello.
const SERVER_ID = 'development-status';
const API_VERSION = 1;

// Once a minute, as GitHub's answer is kept for the pages' own reads (github-source.mjs): without a
// token GitHub allows 60 requests an hour.
const ISSUES_CHECK_MS = 60000;
const MARKDOWN = /\.(md|markdown)$/i;
const NEVER = /(^|\/)(node_modules|\.git|\.hg|\.svn)\//;
const GIT_REF = /^\.git\/(HEAD|packed-refs|refs\/.+)$/;

const GIT_LIMIT = 400;
const GIT_MAX_LIMIT = 5000;

// The core's send (core/http.mjs): no-store, nosniff, and to a HEAD request Node sends the headers only.
const sendText = (res, status, text) => send(res, status, text + '\n', TYPES['.txt']);
const sendJson = (res, value) => send(res, 200, { server: SERVER_ID, api: API_VERSION, ...value });

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

// The issues of the project's GitHub repository, when its origin is on GitHub.
function issuesOf(project, githubRequest, ttlMs) {
  let source = null;
  return async (options) => {
    source ??= project.gitRemoteUrl().then((remote) => openGitHub({ repo: githubRepo(remote), ...(githubRequest ? { request: githubRequest } : {}), ...(ttlMs != null ? { ttlMs } : {}) }));
    return (await source).issues(options);
  };
}

// The live-update topic of a changed file (path relative to the root, "/"-separated).
function watch(p) {
  if (GIT_REF.test(p)) return 'build.git';
  return MARKDOWN.test(p) && !NEVER.test(p) && !p.startsWith('docs/product/') ? 'build.files' : null;
}

// The manifest; githubRequest replaces how GitHub is asked, githubTtlMs how long its answer is
// kept and issuesCheckMs how often it is asked again for the live updates (tests).
export function buildModule({ githubRequest, githubTtlMs, issuesCheckMs = ISSUES_CHECK_MS } = {}) {
  return {
    id: 'build',
    name: 'Build',
    tagline: { en: 'Tickets, progress & branches', hu: 'Jegyek, haladás és ágak' },
    icon: '<rect x="3.5" y="4" width="7" height="7" rx="1.6"/><rect x="13.5" y="4" width="7" height="7" rx="1.6"/><rect x="3.5" y="14" width="7" height="6" rx="1.6"/><path d="M14 17.5l2 2 4-4.5"/>',   // a board with a ticked card
    version: VERSION,
    view: { dir: HERE, files: ['index.html', 'i18n.js', 'ui-strings.js', 'ticket-reader.js'] },
    watch,
    api({ root, events }) {
      const project = openProject(root, { stamp: events?.stamp });
      const name = path.basename(project.root);
      const issues = issuesOf(project, githubRequest, githubTtlMs);
      const tickets = openTickets(project);
      let lastIssues;   // the fingerprint of the issues last seen by the live check
      events?.every(issuesCheckMs, async () => {
        const answer = await issues({ fresh: true });
        const now = answer.available ? answer.fingerprint : '';
        if (lastIssues !== undefined && now !== lastIssues) events.publish('build.issues');
        lastIssues = now;
      });
      return async (req, res, sub, url) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed'), true;
        if (sub === '/hello') return sendJson(res, { version: VERSION, git: true, github: true, name, launcher: 'npx @pottom/groundwork' }), true;
        if (sub === '/list') return sendJson(res, { name, ...project.list() }), true;
        if (sub === '/file') {
          const body = project.readFile(url.searchParams.get('path') || '');
          return (body ? send(res, 200, body, TYPES['.txt']) : sendText(res, 404, 'Not found')), true;
        }
        if (sub === '/git') return sendJson(res, await git(project, url)), true;
        if (sub === '/issues') {
          const answer = await issues();
          const known = url.searchParams.get('known');
          return sendJson(res, known && answer.fingerprint === known ? { available: true, unchanged: true, fingerprint: known } : answer), true;
        }
        if (sub === '/prd') {
          const gh = await issues();
          const model = tickets.read(gh.available ? { repo: gh.repo, issues: gh.issues } : null);
          return sendJson(res, { items: prdProgress(model) }), true;
        }
        return false;
      };
    },
  };
}

export default buildModule();
