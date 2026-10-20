// project-tickets.mjs: the project's tickets read on the server, with the same ticket reader the
// Build page uses (ticket-reader.mjs), so Plan sees what Build sees.
//
//   const tickets = openTickets(project);       project: openProject(root) (project-reader.mjs)
//   tickets.read(github)                        the reader's model of the local tickets (.scratch)
//                                               and, when given, the GitHub issues { repo, issues }
//   prdProgress(model)                          { [PRD item id]: { total, done, tickets: [{ path,
//                                               label, title, status, done, url? }] } }
//   ideaTickets(model)                          { ['I-12']: [{ path, label, title, status, closed,
//                                               url? }] }: per idea, the tickets naming it on their
//                                               "**Idea:**" line (the Ideas module shows them)
//   changeTickets(model)                        { ['C-6']: { total, done } }: per change, how many
//                                               tickets name it on their "**Change:**" line and how
//                                               many of them are done (an idea's card shows it)
//
// Which folder holds the tickets and which files are tickets is the ticket reader's own rule
// (locateProject, ticketPath), the one the page uses too: Plan counts exactly the ticket files
// Build shows. Only those files are read, each again only when its size or time changed.
//
// A dropped ticket (wontfix, legacy) does not count for its PRD items; a done one is done,
// resolved or closed (the reader's DROPPED and DONE).

import { readTickets, locateProject, ticketPath, isDone, isDropped, isClosed } from './ticket-reader.mjs';


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

// Like the PRD counts: a dropped ticket does not count, a change with only dropped ones is left out.
export function changeTickets(model) {
  const items = {};
  for (const [id, tickets] of model.byChange) {
    const counted = tickets.filter((t) => !isDropped(t));
    if (counted.length) items[id] = { total: counted.length, done: counted.filter(isDone).length };
  }
  return items;
}

// Every ticket naming an idea counts here, a dropped one too: the idea shows what became of it.
export function ideaTickets(model) {
  const items = {};
  for (const [id, tickets] of model.byIdea) {
    items[id] = tickets.map((t) => ({ path: t.path, label: t.label, title: t.title, status: t.status, closed: isClosed(t), ...(t.url ? { url: t.url } : {}) }));
  }
  return items;
}
