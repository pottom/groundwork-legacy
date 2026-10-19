// project-tickets.mjs: the project's tickets read on the server, with the same ticket reader the
// Build page uses (ticket-reader.js), so Plan sees what Build sees.
//
//   const tickets = openTickets(project);       project: openProject(root) (project-reader.mjs)
//   tickets.read(github)                        the reader's model of the local tickets (.scratch)
//                                               and, when given, the GitHub issues { repo, issues }
//   prdProgress(model)                          { [PRD item id]: { total, done, tickets: [{ path,
//                                               label, title, status, done, url? }] } }
//
// Which folder holds the tickets and which files are tickets is the ticket reader's own rule
// (locateProject, ticketPath), the one the page uses too: Plan counts exactly the ticket files
// Build shows. Only those files are read, each again only when its size or time changed.
//
// A dropped ticket (wontfix, legacy) does not count for its PRD items; a done one is done,
// resolved or closed (the reader's DROPPED and DONE).

import './ticket-reader.js';

const { readTickets, locateProject, ticketPath, isDone, isDropped } = globalThis.GroundworkTickets;

export function openTickets(project) {
  const cache = new Map();   // path → { size, mtime, text }

  function read(github) {
    const listing = project.list();
    const tracker = locateProject(Object.keys(listing.dirs)).trackerPath;
    const entries = new Map();
    if (tracker != null) {
      for (const f of listing.files) {
        if (!ticketPath(f.path, tracker)) continue;
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
    const counted = tickets.filter((t) => !isDropped(t));
    if (!counted.length) continue;
    items[id] = {
      total: counted.length,
      done: counted.filter(isDone).length,
      tickets: counted.map((t) => ({ path: t.path, label: t.label, title: t.title, status: t.status, done: isDone(t), ...(t.url ? { url: t.url } : {}) })),
    };
  }
  return items;
}
