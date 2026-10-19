#!/usr/bin/env node
// development-status.mjs: the launcher of development-status.html.
//
// Starts a small read-only web server for the folder this file is in (or the
// one given with --root), opens the status page in the default browser, and
// stops when you leave it.
// With it the page needs no folder picker and works in every browser.
//
//   start:  node development-status.mjs      (macOS, Linux: ./development-status.mjs too)
//   stop:   Ctrl+C
//
//   --no-open  do not open the browser (also: DEVELOPMENT_STATUS_NO_OPEN=1)
//   --port N   first port to try (also: DEVELOPMENT_STATUS_PORT=N; default 8641)
//   --version  print the version and stop
//   --root DIR the project folder to show instead of this file's folder
//              (also: DEVELOPMENT_STATUS_ROOT=DIR); a relative DIR is taken
//              from the current folder. Only that folder is read, as always:
//              nothing outside it is listed or served, nothing is written.
//              Example: node development-status.mjs --root ../my-project
//
// Needs Node.js 20 or newer and nothing else: only Node's built-in modules,
// no npm install. Keep the two files together: copied into another project
// that keeps its tickets in markdown the same way, they work there too.
// Nothing about a particular project is written here.
//
// The server listens on 127.0.0.1 only and serves exactly four things: the
// page, the list of the project's markdown files, the text of a listed file,
// and the project's git history (branches, commits, merges) when the folder is
// the top of a git repository. It never writes: git is only asked to read.
//
// Version: VERSION below, the same as in development-status.html. Bump both
// together; the page's header comment lists what each version brought.

import { createServer } from 'node:http';
import { connect } from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the page checks to know it talks to this server, and where it asks.
// The same two values are SERVER_ID and SERVER_API in development-status.html.
const SERVER_ID = 'development-status';
const API = '/development-status-api';
const API_VERSION = 1;
const VERSION = '1.0.0';

const DEFAULT_PORT = 8641;
const PORT_TRIES = 20;

// Folders that are never listed. The same two sets are SKIP_DIRS and
// ALWAYS_SKIP in development-status.html: change them together. The page
// decides what a listed file means; the server only keeps the heavy and the
// private folders out of the list.
const ALWAYS_SKIP = new Set(['node_modules', '.git', '.hg', '.svn']);
const SKIP_DIRS = new Set([...ALWAYS_SKIP, 'target', 'dist', 'build', 'out', 'vendor', 'worktrees', '.cache', '.next', '.venv', '__pycache__']);
const MARKDOWN = /\.(md|markdown)$/i;
const MAX_DEPTH = 12;

const SCRIPT = fileURLToPath(import.meta.url);
const PAGE = join(dirname(SCRIPT), basename(SCRIPT, extname(SCRIPT)) + '.html');
const OPTS = options();
const ROOT = projectRoot(OPTS.root);
const ROOT_ID = createHash('sha256').update(ROOT).digest('hex').slice(0, 16);

// Where a path really is, links followed: inside the project? path.relative
// answers for both kinds of path (on Windows another drive comes back absolute).
function realInsideRoot(path) {
  const rel = relative(ROOT, realpathSync(path));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

function isSkipped(dir, name) {
  if (ALWAYS_SKIP.has(name)) return true;
  // The page lets a ticket area carry any other name ("build", "out"):
  // a folder that holds an "issues" folder is one.
  return SKIP_DIRS.has(name) && !existsSync(join(dir, name, 'issues'));
}

// A linked folder that leaves the project, or leads back to where we are.
function leadsOutOrBack(link, parent) {
  if (!realInsideRoot(link)) return true;
  const rel = relative(realpathSync(link), realpathSync(parent));
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}

// Every markdown file below the root, and each folder's count of other files.
// Paths in the list always use "/", whatever the system's separator is.
function listProject() {
  const files = [];
  const dirs = {};
  const stack = [{ rel: '', full: ROOT, depth: 0 }];
  while (stack.length) {
    const { rel, full, depth } = stack.pop();
    let entries;
    try { entries = readdirSync(full, { withFileTypes: true }); } catch { continue; }
    let others = 0;
    for (const entry of entries) {
      const path = rel ? rel + '/' + entry.name : entry.name;
      const at = join(full, entry.name);
      try {
        const linked = entry.isSymbolicLink();
        const info = linked || entry.isFile() ? statSync(at) : null;   // statSync follows the link
        if (info ? info.isDirectory() : entry.isDirectory()) {
          if (depth >= MAX_DEPTH || isSkipped(full, entry.name)) continue;
          if (linked && leadsOutOrBack(at, full)) continue;
          stack.push({ rel: path, full: at, depth: depth + 1 });
        } else if (!info || !info.isFile()) {
          continue;
        } else if (!MARKDOWN.test(entry.name)) {
          others++;
        } else if (!linked || realInsideRoot(at)) {
          files.push({ path, size: info.size, mtime: Math.floor(info.mtimeMs) });
        }
      } catch { /* gone meanwhile, or a dangling link */ }
    }
    dirs[rel] = others;
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files, dirs };
}

let listed = new Set();   // the paths of the last list: the only files that are served
const remember = (listing) => { listed = new Set(listing.files.map((f) => f.path)); return listing; };

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
const sendJson = (res, value, head) => send(res, 200, 'application/json; charset=utf-8', JSON.stringify(value), head);

function sendFile(res, path, head) {
  // Only what the list holds is served: that is the one rule for what may be
  // read. A listed path is made of real names joined by "/", so "..", a drive
  // letter or a backslash can never match. A path the last list did not have
  // is checked against a fresh one, so a new file is readable at once.
  if (!listed.has(path)) remember(listProject());
  if (!listed.has(path)) return sendText(res, 404, 'Not found', head);
  const full = join(ROOT, ...path.split('/'));
  let body;
  try {
    if (!realInsideRoot(full) || !statSync(full).isFile()) return sendText(res, 404, 'Not found', head);
    body = readFileSync(full);
  } catch {
    return sendText(res, 404, 'Not found', head);
  }
  return send(res, 200, 'text/plain; charset=utf-8', body, head);
}

// ───────── Git: read only ─────────
//
// Only when the served folder is itself the top of a repository: a --root
// below a repository must not show the history of the folders around it.
// GIT_OPTIONAL_LOCKS=0 keeps git from refreshing the index on the side.

const GIT_LIMIT = 400;
const GIT_MAX_LIMIT = 5000;
const GIT_MAX_BRANCHES = 60;
const US = '\x1f', RS = '\x1e';

const git = (args) => new Promise((resolve, reject) => {
  execFile('git', ['--no-pager', '-c', 'core.quotepath=off', ...args], {
    cwd: ROOT, timeout: 10000, maxBuffer: 64 * 1024 * 1024, windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
  }, (error, stdout) => (error ? reject(error) : resolve(stdout)));
});
const gitOr = (args, fallback) => git(args).catch(() => fallback);

let gitTop;   // undefined: not asked yet; null: not a repository (or not its top)
async function gitAvailable() {
  if (gitTop === undefined) {
    const top = (await gitOr(['rev-parse', '--show-toplevel'], '')).trim();
    // path.relative, not ===: on Windows the drive letter's case may differ.
    try { gitTop = top && relative(ROOT, realpathSync(top)) === '' ? top : null; } catch { gitTop = null; }
  }
  return gitTop !== null;
}

// What changes when anything in the history does: every ref and HEAD.
async function gitFingerprint() {
  const refs = await git(['for-each-ref', '--format=%(refname) %(objectname)']);
  const head = (await gitOr(['symbolic-ref', '-q', 'HEAD'], '')).trim() + ' ' + (await gitOr(['rev-parse', '-q', '--verify', 'HEAD'], '')).trim();
  return createHash('sha256').update(refs + '\n' + head).digest('hex').slice(0, 16);
}

// The branch the others are measured against: what origin/HEAD points to, else main or master.
async function baseBranch(locals) {
  const origin = (await gitOr(['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], '')).trim().replace(/^refs\/remotes\/origin\//, '');
  for (const name of [origin, 'main', 'master', 'trunk', 'develop']) if (name && locals.has(name)) return name;
  return locals.size ? [...locals][0] : '';
}

let gitCache = null;   // { fingerprint, limit, value }

async function gitHistory(limit) {
  const fingerprint = await gitFingerprint();
  if (gitCache && gitCache.fingerprint === fingerprint && gitCache.limit === limit) return gitCache.value;

  const refLines = (await git(['for-each-ref', `--format=%(refname)${US}%(objectname)${US}%(*objectname)${US}%(committerdate:unix)${US}%(upstream)${US}%(HEAD)`, 'refs/heads', 'refs/remotes', 'refs/tags'])).split('\n').filter(Boolean);
  const refs = refLines.map((line) => {
    const [ref, object, peeled, date, upstream, head] = line.split(US);
    const kind = ref.startsWith('refs/heads/') ? 'branch' : ref.startsWith('refs/tags/') ? 'tag' : 'remote';
    const name = ref.replace(/^refs\/(heads|tags|remotes)\//, '');
    return { kind, name, ref, hash: peeled || object, date: Number(date) || 0, upstream: upstream.replace(/^refs\/(heads|remotes)\//, ''), head: head === '*' };
  }).filter((r) => !(r.kind === 'remote' && r.name.endsWith('/HEAD')));
  const headHash = (await gitOr(['rev-parse', '-q', '--verify', 'HEAD'], '')).trim();
  const headBranch = (await gitOr(['symbolic-ref', '-q', '--short', 'HEAD'], '')).trim();

  const locals = new Set(refs.filter((r) => r.kind === 'branch').map((r) => r.name));
  const base = await baseBranch(locals);

  // Branches checked out in a worktree (an agent may be working there). Only
  // the branch names leave the server, not the folders.
  const worktrees = new Set((await gitOr(['worktree', 'list', '--porcelain'], '')).split('\n')
    .filter((l) => l.startsWith('branch refs/heads/')).map((l) => l.slice('branch refs/heads/'.length)));
  for (const r of refs) if (r.kind === 'branch') r.worktree = worktrees.has(r.name);

  // Ahead of and behind the base, for the newest branches.
  if (base) {
    const measured = refs.filter((r) => r.kind !== 'tag' && !(r.kind === 'branch' && r.name === base)).sort((a, b) => b.date - a.date).slice(0, GIT_MAX_BRANCHES);
    await Promise.all(measured.map(async (r) => {
      const counts = (await gitOr(['rev-list', '--left-right', '--count', `refs/heads/${base}...${r.ref}`], '')).trim().split(/\s+/);
      if (counts.length === 2) { r.behind = Number(counts[0]); r.ahead = Number(counts[1]); }
    }));
  }

  const log = await git(['log', '--all', '--date-order', '-n', String(limit), `--format=%H${US}%P${US}%an${US}%at${US}%s${RS}`]);
  const commits = log.split(RS).map((c) => c.replace(/^\s+/, '')).filter(Boolean).map((c) => {
    const [hash, parents, author, date, subject] = c.split(US);
    return { hash, parents: parents ? parents.split(' ') : [], author, date: Number(date) || 0, subject: subject || '' };
  });
  const total = Number((await gitOr(['rev-list', '--all', '--count'], '0')).trim()) || commits.length;

  const value = { available: true, fingerprint, base, head: headHash, headBranch, refs, commits, total, limit };
  gitCache = { fingerprint, limit, value };
  return value;
}

async function sendGit(res, url, head) {
  const answer = (value) => sendJson(res, { server: SERVER_ID, api: API_VERSION, ...value }, head);
  if (!(await gitAvailable())) return answer({ available: false });
  const limit = Math.min(GIT_MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit')) || GIT_LIMIT));
  try {
    // The page says what it has: unchanged, the answer is only that.
    const known = url.searchParams.get('known');
    if (known && gitCache && gitCache.limit === limit && known === gitCache.fingerprint && known === (await gitFingerprint())) {
      return answer({ available: true, unchanged: true, fingerprint: known });
    }
    return answer(await gitHistory(limit));
  } catch (error) {
    return answer({ available: false, error: String(error && error.message ? error.message : error).split('\n')[0] });
  }
}

function route(req, res, port) {
  const head = req.method === 'HEAD';
  if (req.method !== 'GET' && !head) return sendText(res, 405, 'Method not allowed');
  // A page of another site must not reach this server under its own name.
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return sendText(res, 403, 'Forbidden', head);
  const url = new URL(req.url, 'http://127.0.0.1');
  // req.url is compared as sent: new URL() would fold "/../x" into "/x".
  const asked = req.url.split('?')[0];
  if (asked === '/' || asked === '/' + basename(PAGE)) return send(res, 200, 'text/html; charset=utf-8', readFileSync(PAGE), head);
  if (asked === API + '/hello') {
    return sendJson(res, { server: SERVER_ID, api: API_VERSION, version: VERSION, git: true, root_id: ROOT_ID, pid: process.pid, name: basename(ROOT), launcher: 'node ' + basename(SCRIPT) + (OPTS.root ? ' --root ' + OPTS.root : '') }, head);
  }
  if (asked === API + '/list') return sendJson(res, { server: SERVER_ID, api: API_VERSION, name: basename(ROOT), ...remember(listProject()) }, head);
  if (asked === API + '/file') return sendFile(res, url.searchParams.get('path') || '', head);
  if (asked === API + '/git') return sendGit(res, url, head);
  return sendText(res, 404, 'Not found', head);
}

const portAnswers = (port) => new Promise((resolve) => {
  const socket = connect({ host: '127.0.0.1', port });
  const done = (answer) => { socket.destroy(); resolve(answer); };
  socket.setTimeout(1000, () => done(false));
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
});

// The hello of a development-status server on this port, or null.
async function runningInstance(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${API}/hello`, { signal: AbortSignal.timeout(2000) });
    const hello = await res.json();
    return hello && hello.server === SERVER_ID ? hello : null;
  } catch {
    return null;
  }
}

const listen = (server, port) => new Promise((resolve) => {
  const failed = () => resolve(false);
  server.once('error', failed);
  server.listen(port, '127.0.0.1', () => { server.off('error', failed); resolve(true); });
});

// A server on the first free port, or the hello of the one already serving this folder.
async function bind(server, firstPort) {
  for (let port = firstPort; port < firstPort + PORT_TRIES; port++) {
    // Asked first, not left to listen(): where the system lets an address be
    // reused, a taken port can still be bound.
    if (await portAnswers(port)) {
      const hello = await runningInstance(port);
      if (hello && hello.root_id === ROOT_ID) return { port, other: hello };
      continue;
    }
    if (await listen(server, port)) return { port };
  }
  if (await listen(server, 0)) return { port: server.address().port };
  throw new Error('no free port');
}

function openBrowser(url) {
  // "start" is a cmd built-in; its first quoted argument is a window title.
  const [command, args, options] = process.platform === 'darwin' ? ['open', [url], { detached: true }]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url], { windowsVerbatimArguments: true, windowsHide: true }]
    : ['xdg-open', [url], { detached: true }];
  const failed = () => console.error('  Could not open the browser; open the address yourself.');
  try {
    const child = spawn(command, args, { stdio: 'ignore', ...options });
    child.once('error', failed);
    child.unref();
  } catch {
    failed();
  }
}

function options() {
  const env = process.env;
  const opts = {
    open: !env.DEVELOPMENT_STATUS_NO_OPEN || env.DEVELOPMENT_STATUS_NO_OPEN === '0',
    port: Number(env.DEVELOPMENT_STATUS_PORT) || DEFAULT_PORT,
    root: env.DEVELOPMENT_STATUS_ROOT || '',
  };
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-open') opts.open = false;
    else if (args[i] === '--port' && Number(args[i + 1]) > 0) opts.port = Number(args[++i]);
    else if (args[i] === '--root' && args[i + 1]) opts.root = args[++i];
    else if (args[i] === '--version' || args[i] === '-v') { console.log(`development-status ${VERSION}`); process.exit(0); }
    else if (args[i].startsWith('--root=') && args[i].length > 7) opts.root = args[i].slice(7);
    else {
      console.log(`usage: node ${basename(SCRIPT)} [--no-open] [--port N] [--root DIR] [--version]`);
      process.exit(args[i] === '--help' || args[i] === '-h' ? 0 : 2);
    }
  }
  return opts;
}

// The folder served: --root (from the current folder), or the one this file is in.
function projectRoot(asked) {
  const dir = asked ? resolve(process.cwd(), asked) : dirname(SCRIPT);
  try {
    if (statSync(dir).isDirectory()) return realpathSync(dir);
  } catch { /* reported below */ }
  console.error(`development-status: ${asked || dir} is not a folder.`);
  process.exit(2);
}

async function main() {
  const opts = OPTS;
  if (!existsSync(PAGE)) {
    console.error(`development-status: ${basename(PAGE)} is missing; it must be next to this file.`);
    process.exit(1);
  }

  // A failure of ours: say it once, keep serving.
  const failed = (req, res, error) => {
    console.error(`error: ${req.method} ${req.url}: ${error && error.message ? error.message : error}`);
    try { if (!res.headersSent) sendText(res, 500, 'Internal error'); else res.destroy(); } catch { res.destroy(); }
  };
  const server = createServer((req, res) => {
    try {
      Promise.resolve(route(req, res, server.address().port)).catch((error) => failed(req, res, error));
    } catch (error) {
      failed(req, res, error);
    }
  });
  server.on('clientError', (error, socket) => socket.destroy());

  const { port, other } = await bind(server, opts.port);
  const url = `http://127.0.0.1:${port}/`;
  if (other) {
    console.log(`development-status: already running for this folder (pid ${other.pid}), not starting a second one.`);
    console.log('  ' + url);
    if (opts.open) {
      openBrowser(url);
      console.log('  Opened it. Stop it with Ctrl+C where it runs.');
    }
    return;
  }

  // Ctrl+C is SIGINT on every system; the other two exist where the system has them.
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      try { console.log('\ndevelopment-status: stopped.'); } catch { /* the terminal is gone */ }
      process.exit(0);
    });
    server.closeAllConnections();
  };
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
  // Output into a closed terminal must not turn into a stack trace.
  for (const stream of [process.stdout, process.stderr]) stream.on('error', () => {});

  console.log(`development-status ${VERSION}: serving ${ROOT}`);
  console.log('  ' + url + (port === opts.port ? '' : `   (port ${opts.port} was taken)`));
  console.log('  Stop with Ctrl+C.');
  if (opts.open) openBrowser(url);
}

main().catch((error) => {
  console.error('development-status: ' + (error && error.message ? error.message : error));
  process.exit(1);
});
