// The project's files as a tree, made from the server's list (server.mjs): a node lists its
// children, a file node stands for a file (size, lastModified, text()). scan() walks the tracker
// and the ADR folder in it.

import { reader } from './config.mjs';

const { locateProject, keepsFolder, README_FILE, GLOSSARY_FILE, ALWAYS_SKIP, SKIP_DIRS, LOCATE_DEPTH } = reader;

const joinPath = (a, b) => (a ? a + '/' + b : b);

// A tree of paths: the list the server sends (server.mjs).
export const treeAdapter = {
  children: async (dir) => [...dir.children.values()],
  file: async (node) => node.file,
};

export function treeDir(root, parts) {
  let dir = root;
  for (const part of parts) {
    let child = dir.children.get(part);
    if (!child) { child = { name: part, isDir: true, node: { children: new Map() } }; dir.children.set(part, child); }
    dir = child.node;
  }
  return dir;
}

// The folders the reader's locateProject decides by, with their nodes: LOCATE_DEPTH levels
// down; a heavy folder (SKIP_DIRS) only with its own subfolders, as it may be an area.
async function listFolders(A, root) {
  const nodes = new Map([['', root]]);
  const visit = async (dir, path, depth, heavy) => {
    await Promise.all((await A.children(dir)).map(async (c) => {
      if (!c.isDir || ALWAYS_SKIP.has(c.name)) return;
      const p = joinPath(path, c.name);
      nodes.set(p, c.node);
      if (!heavy && depth + 1 < LOCATE_DEPTH) await visit(c.node, p, depth + 1, SKIP_DIRS.has(c.name));
    }));
  };
  await visit(root, '', 0, false);
  return nodes;
}

// The tracker and the ADR folder: the same rule as the server's (ticket-reader.mjs).
async function locate(src) {
  const nodes = await listFolders(src.adapter, src.root);
  const { trackerPath, adrPath } = locateProject([...nodes.keys()]);
  return {
    tracker: trackerPath == null ? null : { node: nodes.get(trackerPath), path: trackerPath },
    adr: adrPath == null ? null : { node: nodes.get(adrPath), path: adrPath },
  };
}

async function walk(A, dir, path, depth, skipFrom, out) {
  const kids = await A.children(dir);
  await Promise.all(kids.map(async (c) => {
    const p = joinPath(path, c.name);
    if (c.isDir) {
      if (!keepsFolder(c.name, depth, skipFrom === 0)) return;
      await walk(A, c.node, p, depth + 1, skipFrom, out);
    } else if (/\.(md|markdown)$/i.test(c.name)) {
      const f = await A.file(c.node);
      out.entries.push({ path: p, size: f.size, mtime: f.lastModified, file: f });
    } else {
      out.others.push(p);
    }
  }));
}

// One pass over the folder: every markdown file of the tracker and the ADR folder with its size
// and time, without reading any content.
export async function scan(src) {
  const A = src.adapter;
  if (src.reload) await src.reload();
  if (!src.roots || (!src.roots.tracker && Date.now() - src.located > 15000)) {
    src.roots = await locate(src);
    src.located = Date.now();
  }
  const out = { entries: [], others: [] };
  const top = await A.children(src.root);
  for (const c of top) {
    if (c.isDir || !(README_FILE.test(c.name) || GLOSSARY_FILE.test(c.name))) continue;
    const f = await A.file(c.node);
    out.entries.push({ path: c.name, size: f.size, mtime: f.lastModified, file: f });
  }
  const { tracker, adr } = src.roots;
  if (tracker) await walk(A, tracker.node, tracker.path, 0, 1, out);
  if (adr && !(tracker && (adr.path + '/').startsWith(tracker.path + '/'))) await walk(A, adr.node, adr.path, 0, 0, out);
  const seen = new Set();
  out.entries = out.entries.filter((e) => !seen.has(e.path) && seen.add(e.path));
  out.trackerPath = tracker ? tracker.path : null;
  out.adrPath = adr ? adr.path : null;
  return out;
}
