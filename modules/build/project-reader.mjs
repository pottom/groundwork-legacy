// project-reader.mjs: what the Build module reads from a project, and only reads.
//
//   const project = openProject(root, { stamp });   stamp: the core's events.stamp (core/events.mjs), optional
//   project.list()           every markdown file below root ({ path, size, mtime }) and each folder's count of
//                            other files; kept while stamp() says nothing below root changed (the folder is
//                            watched), walked afresh otherwise
//   project.readFile(path)   the bytes of a listed file, or null
//   project.gitAvailable()   is root the top of a git repository?
//   project.gitFingerprint() what changes when any ref or HEAD does
//   project.gitHistory(n)    branches, tags, the newest n commits, merges
//   project.gitRemoteUrl()   the URL of the "origin" remote, or ''
//
// Nothing outside root is listed or served, links included (realpath checks),
// and nothing is written: git is only asked to read.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import './ticket-reader.js';

// Folders that are never listed: the ticket reader's (ticket-reader.js), the sets the page
// walks by. The page decides what a listed file means; the server only keeps the heavy and the
// private folders out of the list.
const { ALWAYS_SKIP, SKIP_DIRS } = globalThis.GroundworkTickets;
const MARKDOWN = /\.(md|markdown)$/i;
const MAX_DEPTH = 12;

const GIT_MAX_BRANCHES = 60;
const US = '\x1f', RS = '\x1e';

export function openProject(asked, { stamp = () => null } = {}) {
  let ROOT = asked;
  try { ROOT = realpathSync(asked); } catch { /* listed as empty below */ }

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
  let kept = null;          // { stamp, listing }: the last list, and how the project looked then
  const walk = () => {
    const now = stamp();
    const listing = listProject();
    listed = new Set(listing.files.map((f) => f.path));
    kept = { stamp: now, listing };
    return listing;
  };
  const list = () => {
    const now = stamp();
    return now !== null && kept?.stamp === now ? kept.listing : walk();
  };

  function readFile(path) {
    // Only what the list holds is served: that is the one rule for what may be
    // read. A listed path is made of real names joined by "/", so "..", a drive
    // letter or a backslash can never match. A path the last list did not have
    // is checked against a fresh one, so a new file is readable at once.
    if (!listed.has(path)) walk();
    if (!listed.has(path)) return null;
    const full = join(ROOT, ...path.split('/'));
    try {
      if (!realInsideRoot(full) || !statSync(full).isFile()) return null;
      return readFileSync(full);
    } catch {
      return null;
    }
  }

  // ───────── Git: read only ─────────
  //
  // Only when the root is itself the top of a repository: a root below a
  // repository must not show the history of the folders around it.
  // GIT_OPTIONAL_LOCKS=0 keeps git from refreshing the index on the side.

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

  // Where git keeps this checkout's HEAD (own) and the refs every worktree shares (common): .git
  // itself, or for a linked worktree the folder its .git file names and that folder's commondir.
  function gitDirs() {
    const dotGit = join(ROOT, '.git');
    const info = statSync(dotGit, { throwIfNoEntry: false });
    if (!info) return null;
    if (info.isDirectory()) return { own: dotGit, common: dotGit };
    const named = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, 'utf8'));
    if (!named) return null;
    const own = resolve(ROOT, named[1]);
    let common = own;
    try { common = resolve(own, readFileSync(join(own, 'commondir'), 'utf8').trim()); } catch { /* no commondir: not a linked worktree */ }
    return { own, common };
  }

  // Every file below dir, by path, with its bytes (the loose refs; reftable's tables).
  function readTree(dir, into, prefix) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const at = join(dir, e.name);
      if (e.isDirectory()) readTree(at, into, prefix + e.name + '/');
      else if (e.isFile()) { try { into.push(prefix + e.name + '\0' + readFileSync(at, 'latin1')); } catch { /* gone meanwhile */ } }
    }
  }

  // What changes when any ref or HEAD does: the bytes git keeps them in (HEAD, packed-refs, the
  // loose refs, or the reftable), read from disk, so no git process runs. The page asks with it on
  // every refresh. A layout this cannot read falls back to asking git.
  async function gitFingerprint() {
    const dirs = gitDirs();
    if (dirs) {
      try {
        const parts = ['HEAD\0' + readFileSync(join(dirs.own, 'HEAD'), 'latin1')];
        try { parts.push('packed-refs\0' + readFileSync(join(dirs.common, 'packed-refs'), 'latin1')); } catch { /* none yet */ }
        readTree(join(dirs.common, 'refs'), parts, 'refs/');
        readTree(join(dirs.common, 'reftable'), parts, 'reftable/');
        return 'f' + createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 15);
      } catch { /* fall back to git */ }
    }
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

  // The fingerprint of the last history sent for this limit, if any.
  const cachedFingerprint = (limit) => (gitCache && gitCache.limit === limit ? gitCache.fingerprint : null);

  // The URL of a remote ("origin"), or '' when there is none.
  async function gitRemoteUrl(name = 'origin') {
    if (!(await gitAvailable())) return '';
    return (await gitOr(['remote', 'get-url', name], '')).trim();
  }

  return { root: ROOT, list, readFile, gitAvailable, gitFingerprint, gitHistory, cachedFingerprint, gitRemoteUrl };
}
