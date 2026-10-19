// project-tickets.mjs: the project's tickets read on the server, with the same ticket reader the
// Build page uses (ticket-reader.js), so Plan sees what Build sees.
//
//   const tickets = openTickets(project);       project: openProject(root) (project-reader.mjs)
//   tickets.read(github)                        the reader's model of the local tickets (.scratch)
//                                               and, when given, the GitHub issues { repo, issues }
//   prdProgress(model)                          { [PRD item id]: { total, done, tickets: [{ path,
//                                               label, title, status, done, url? }] } }
//
// Which folder holds the tickets is found the way the page finds it (index.html, locate()):
// ".scratch" when its subfolders hold an "issues" folder, else the root itself when they do,
// else the first such folder within three levels; ".scratch" anyway when it exists. Only the
// tickets are read (<tracker>/<area>/issues/*.md), each file again only when its size or time
// changed.
//
// A dropped ticket (wontfix, legacy) does not count for its PRD items; a done one is done,
// resolved or closed.

import './ticket-reader.js';

const { readTickets } = globalThis.GroundworkTickets;

// The same sets as in index.html (SKIP_DIRS, ALWAYS_SKIP, DEFAULT_TRACKER_DIR).
const DEFAULT_TRACKER_DIR = '.scratch';
const ALWAYS_SKIP = new Set(['node_modules', '.git', '.hg', '.svn']);
const SKIP_DIRS = new Set([...ALWAYS_SKIP, 'target', 'dist', 'build', 'out', 'vendor', 'worktrees', '.cache', '.next', '.venv', '__pycache__']);
const DONE = new Set(['done', 'resolved', 'closed']);
const DROPPED = new Set(['wontfix', 'legacy']);

const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const nameOf = (p) => p.slice(p.lastIndexOf('/') + 1);

// The tracker folder among the listed folders ('' is the root), or null.
export function findTracker(folders) {
  const children = new Map();
  for (const f of folders) {
    if (f === '') continue;
    const parent = parentOf(f);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(f);
  }
  const kids = (dir, skip) => (children.get(dir) || []).filter((c) => !skip.has(nameOf(c)));
  const looksLikeTracker = (dir) => kids(dir, ALWAYS_SKIP).some((area) => (children.get(area) || []).some((c) => nameOf(c).toLowerCase() === 'issues'));
  const has = new Set(folders);
  if (has.has(DEFAULT_TRACKER_DIR) && looksLikeTracker(DEFAULT_TRACKER_DIR)) return DEFAULT_TRACKER_DIR;
  if (looksLikeTracker('')) return '';
  let level = [''];
  for (let depth = 0; depth < 3; depth++) {
    const next = [];
    for (const at of level) {
      for (const c of kids(at, SKIP_DIRS)) {
        if (looksLikeTracker(c)) return c;
        next.push(c);
      }
    }
    level = next;
  }
  return has.has(DEFAULT_TRACKER_DIR) ? DEFAULT_TRACKER_DIR : null;
}

export function openTickets(project) {
  const cache = new Map();   // path → { size, mtime, text }

  function read(github) {
    const listing = project.list();
    const tracker = findTracker(Object.keys(listing.dirs));
    const prefix = tracker ? tracker + '/' : '';
    const entries = new Map();
    if (tracker != null) {
      for (const f of listing.files) {
        if (!f.path.startsWith(prefix) || !/\/issues\/[^/]+\.(md|markdown)$/i.test(f.path)) continue;
        let kept = cache.get(f.path);
        if (!kept || kept.size !== f.size || kept.mtime !== f.mtime) {
          const body = project.readFile(f.path);
          if (!body) continue;
          kept = { size: f.size, mtime: f.mtime, text: body.toString('utf8') };
          cache.set(f.path, kept);
        }
        entries.set(f.path, kept);
      }
    }
    for (const p of [...cache.keys()]) if (!entries.has(p)) cache.delete(p);
    return readTickets({ name: '', files: { entries, others: [], trackerPath: tracker, adrPath: null }, github: github || null });
  }

  return { read };
}

export function prdProgress(model) {
  const items = {};
  for (const [id, tickets] of model.byPrd) {
    const counted = tickets.filter((t) => !DROPPED.has(t.status));
    if (!counted.length) continue;
    items[id] = {
      total: counted.length,
      done: counted.filter((t) => DONE.has(t.status)).length,
      tickets: counted.map((t) => ({ path: t.path, label: t.label, title: t.title, status: t.status, done: DONE.has(t.status), ...(t.url ? { url: t.url } : {}) })),
    };
  }
  return items;
}
