// The core server's Build endpoints (/api/build/, module.mjs): one request lists every markdown
// file (path, size, time) and each folder's count of other files; a file's text is asked for only
// when it changed. Anything else answering is not our server: as good as stopped.

import { SERVER_ID, SERVER_API, SERVER_TIMEOUT_MS } from './config.mjs';
import { ui } from './text.mjs';
import { treeAdapter, treeDir } from './folder.mjs';

export class ServerDownError extends Error {
  constructor(message) { super(message); this.name = 'ServerDownError'; }
}

async function serverFetch(path) {
  const stop = new AbortController();
  const timeout = setTimeout(() => stop.abort(), SERVER_TIMEOUT_MS);
  try {
    return await fetch(SERVER_API + path, { cache: 'no-store', signal: stop.signal });
  } catch (err) {
    throw new ServerDownError(ui('error.server-down'));
  } finally {
    clearTimeout(timeout);
  }
}

export async function serverJson(path) {
  const res = await serverFetch(path);
  let data = null;
  try { data = res.ok ? await res.json() : null; } catch (err) { data = null; }
  if (!data || data.server !== SERVER_ID) throw new ServerDownError(ui('error.not-our-server'));
  return data;
}

async function serverText(path) {
  const res = await serverFetch('/file?path=' + encodeURIComponent(path));
  if (!res.ok) throw new Error(path + ': HTTP ' + res.status);
  return res.text();
}

function treeFromListing(listing) {
  const root = { children: new Map() };
  for (const [path, others] of Object.entries(listing.dirs || {})) {
    const dir = treeDir(root, path ? path.split('/') : []);
    // Stand-ins for the files that are not markdown: only their number is known.
    // No real file name holds a slash.
    for (let i = 0; i < others; i++) dir.children.set('/' + i, { name: '/' + i, isDir: false, node: {} });
  }
  for (const f of listing.files || []) {
    const parts = f.path.split('/');
    const last = parts.pop();
    treeDir(root, parts).children.set(last, { name: last, isDir: false, node: { file: { size: f.size, lastModified: f.mtime, text: () => serverText(f.path) } } });
  }
  return root;
}

// Is the page loaded from the core server? Asked, not guessed from the protocol: served by
// anything else, the page falls back to the folder picker.
export async function findServer() {
  if (!/^https?:$/.test(location.protocol)) return null;
  try { return await serverJson('/hello'); } catch (err) { return null; }
}

export function serverSource(hello) {
  const src = { adapter: treeAdapter, root: { children: new Map() }, name: hello.name || '', live: true, server: location.host, launcher: hello.launcher || '', version: hello.version || '', git: !!hello.git, github: !!hello.github };
  src.reload = async () => {
    const listing = await serverJson('/list');
    src.root = treeFromListing(listing);
    src.name = listing.name || src.name;
    src.roots = null;   // the tree is new: find the tracker in it again
  };
  return src;
}
