// ticket-reader.js: what Build knows about a project's tickets, read from a ticket source.
//
//   const model = GroundworkTickets.readTickets(source);
//
// The one entry point. A source has a name and one or both of:
//
//   files:  { entries, others, trackerPath, adrPath }   the project's Markdown files
//           entries: Map (or [path, { text }] pairs) of every markdown file read, by path;
//           others: paths of the other files; trackerPath: the folder holding the areas
//           (".scratch"), adrPath: the ADR folder; either may be null
//   github: { repo, issues }                           the repository's issues, as the server's
//           /api/build/issues sends them: { number, title, state ("open" | "closed"),
//           stateReason, labels: [name], milestone: title | null, body, blockedBy:
//           [{ number, repo }] | null (GitHub's own dependency links; null when unknown),
//           createdAt, closedAt, updatedAt, url }
//
// and, when the page could read Plan's map, mapIds: the ids of its nodes (mapIds(map) makes
// them from the map's JSON). PRD references are checked against it: an id not among them is an
// "unknown-prd" problem; without mapIds no id is unknown. An open ticket without a PRD line is
// a "no-prd" problem once the project links tickets to a PRD (it has a map, or a ticket names
// an id).
//
// The model (what every view draws):
//
//   tickets      [{ kind: 'ticket', source: 'file' | 'github', path, area, label, title, status,
//                   statusNote, issue, local, blockedBy, blockers: [{ raw, ticket | null }],
//                   dependents, blocked, notes, checks: { done, total }, comments: [{ date,
//                   title, event?, order }], lastComment, text, fields, hay, url?, labels?,
//                   milestone?, prd: [id] }]   prd: the ids of the PRD items (Plan's map nodes)
//                   named on the ticket's "**PRD:** a, b" line, [] without one
//   areas        Map name → { name, spec, tickets, docs, extras, open, closed, local }; a local
//                ticket's area is its folder, a GitHub issue's is its milestone ('' without one)
//   areaList, docs, adrs, readme, glossaries, byPath, byIssue, byLocal, resolveIssue(n),
//   resolveLocal(area, n), areaRef, statusCounts, open, comments, projectName
//   byPrd        Map PRD item id → [tickets naming it on their PRD line]
//   problems     [{ kind, tickets, key, params }]: the inconsistencies; key and params are the
//                UI string that tells it (the page translates)
//
// A ticket's state: a local file's Status line (the first word; the rest is the note); a GitHub
// issue's state: closed is "closed" ("wontfix" when closed as not planned or duplicate), open is
// its first state label (ready-for-agent, needs-triage, ...), else "needs-triage". "Blocked by": the
// "Blocked by:" line or a "## Blocked by" section in the text, and for an issue also GitHub's
// own dependency links. "#12" names an issue (global), "core 3" or "3" a local ticket of an
// area; a title or a file name names a ticket too.
//
// Where the files are, one rule for the page and the server (project-tickets.mjs), so Build
// and Plan's counts read the same tickets:
//
//   locateProject(folders)          { trackerPath, adrPath } among the project's folders (paths
//                                   relative to the root, "/"-separated, '' the root itself)
//   ticketPath(path, trackerPath)   { area, name } when the file is a ticket, else null
//   keepsFolder(name, depth, strict)  is a folder walked (depth below the tracker or ADR folder;
//                                   strict: skip the heavy folders from the top, as for ADRs)
//
// A ticket's state, once: DONE (done, resolved, closed) and DROPPED (wontfix, legacy) are
// CLOSED; isDone(t), isDropped(t), isClosed(t).
//
// The links between Plan and Build: planLink(id) is Plan's deep link (the same as Plan's
// deep-link.mjs makes), prdFilter(location.search) the PRD item a Build link names (?prd=).
//
// A classic script, not an ES module: the page loads it with <script src> also when opened by
// double click (file://). It defines one global, GroundworkTickets; under Node, importing the
// file does the same (globalThis).

(function (root) {
'use strict';

const DONE = new Set(['done', 'resolved', 'closed']);
const DROPPED = new Set(['wontfix', 'legacy']);
const CLOSED = new Set([...DONE, ...DROPPED]);
const UNPARSED = '?';
// The project's own top-level documents: the README names the project; the
// domain glossary is GLOSSARY.md (CONTEXT.md before v1.3 of the skills).
const README_FILE = /^readme\.(md|markdown)$/i;
const GLOSSARY_FILE = /^(glossary|glossary-map|context)\.(md|markdown)$/i;

const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plainInline = (s) => s.replace(/`([^`]*)`/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/(\*\*|__)(.*?)\1/g, '$2').replace(/(^|[^\w\\])_([^_\s][^_]*?)_(?!\w)/g, '$1$2').trim();
const isClosed = (t) => CLOSED.has(t.status);
const isDone = (t) => DONE.has(t.status);
const isDropped = (t) => DROPPED.has(t.status);

// ───────────────────────── Where the files are ─────────────────────────

const DEFAULT_TRACKER_DIR = '.scratch';
const ADR_DIRS = ['docs/adr', 'doc/adr', 'docs/adrs', 'docs/decisions', 'adr'];
// Never walked into; the heavy ones (SKIP_DIRS) only from one level below the tracker, where
// an area may carry any name ("build", "out"). The server's file list (project-reader.mjs)
// keeps the same folders out.
const ALWAYS_SKIP = new Set(['node_modules', '.git', '.hg', '.svn']);
const SKIP_DIRS = new Set([...ALWAYS_SKIP, 'target', 'dist', 'build', 'out', 'vendor', 'worktrees', '.cache', '.next', '.venv', '__pycache__']);
const MAX_DEPTH = 8;        // folders below the tracker (or the ADR folder) that are walked
const TRACKER_DEPTH = 3;    // how deep a tracker is looked for

const keepsFolder = (name, depth, strict) => !ALWAYS_SKIP.has(name) && depth < MAX_DEPTH && !((strict || depth >= 1) && SKIP_DIRS.has(name));

const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const nameOf = (p) => p.slice(p.lastIndexOf('/') + 1);

// The tracker is a folder whose subfolders (the areas) hold an "issues" folder: ".scratch"
// when it is one, else the root when it is one, else the first one within three levels
// (heavy folders not searched); ".scratch" anyway when it exists. The ADR folder is the first
// of ADR_DIRS that exists.
function locateProject(folders) {
  const has = new Set(folders);
  const children = new Map();
  for (const f of has) {
    if (f === '') continue;
    const parent = parentOf(f);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(f);
  }
  const kids = (dir, skip) => (children.get(dir) || []).filter((c) => !skip.has(nameOf(c))).sort();
  const looksLikeTracker = (dir) => kids(dir, ALWAYS_SKIP).some((a) => (children.get(a) || []).some((c) => nameOf(c).toLowerCase() === 'issues'));
  const tracker = (() => {
    if (has.has(DEFAULT_TRACKER_DIR) && looksLikeTracker(DEFAULT_TRACKER_DIR)) return DEFAULT_TRACKER_DIR;
    if (looksLikeTracker('')) return '';
    let level = [''];
    for (let depth = 0; depth < TRACKER_DEPTH; depth++) {
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
  })();
  return { trackerPath: tracker, adrPath: ADR_DIRS.find((d) => has.has(d)) || null };
}

// The folders locateProject needs, from a tree walked lazily (the page's folder picker):
// down to the areas' "issues" folders of a tracker three levels deep. A heavy folder is listed
// with its own subfolders (it may be an area) but not walked further.
const LOCATE_DEPTH = TRACKER_DEPTH + 2;

// A ticket is <tracker>/<area>/issues/<name>.md, its area one or more folders the page walks.
function ticketPath(path, trackerPath) {
  if (trackerPath == null) return null;
  const prefix = trackerPath ? trackerPath + '/' : '';
  if (!path.startsWith(prefix)) return null;
  const m = /^(.+)\/issues\/([^/]+)\.(?:md|markdown)$/i.exec(path.slice(prefix.length));
  if (!m) return null;
  const dirs = [...m[1].split('/'), 'issues'];
  return dirs.every((d, i) => keepsFolder(d, i)) ? { area: m[1], name: m[2] } : null;
}

const FIELD = /^\s*(?:[-*+]\s+)?\*{0,2}(status|issue|blocked by|earlier name|type|prd)\*{0,2}\s*:\*{0,2}\s*(.*)$/i;
const COMMENTS_HEADING = /^##\s+(comments?|megjegyzések|hozzászólások)\s*$/i;   // reads Hungarian files too
const NO_BLOCKER = /^(none|nincs|semmi|nothing|n\/a|[—–-]+)(?![\p{L}\p{N}])/iu;

function firstHeading(lines) {
  for (const l of lines) {
    const m = /^#{1,6}\s+(.*?)\s*#*$/.exec(l);
    if (m) return plainInline(m[1]);
  }
  return '';
}

// "#41, 12 (#30), [other-area 3](…)" → references; free text is kept as a note.
function parseBlockedBy(raw) {
  let s = raw.replace(/`/g, '').trim();
  if (!s || NO_BLOCKER.test(s)) return { none: true, refs: [], raw };
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, (m, text) => {
    const list = /^([\w.-]+)\s+(\d+(?:\s*,\s*\d+)+)$/.exec(text.trim());
    return list ? list[2].split(/\s*,\s*/).map((n) => list[1] + ' ' + n).join(', ') : text;
  });
  // Split on top-level commas; stop at the first top-level ";" or ": ".
  const items = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ';' || (ch === ':' && /\s/.test(s[i + 1] || ' ')) || (/[—–]/.test(ch) && /\s/.test(s[i - 1] || '')))) break;
    if (depth === 0 && ch === ',') { items.push(cur); cur = ''; } else cur += ch;
  }
  items.push(cur);
  const refs = [];
  for (const item of items) {
    const outside = item.replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' ').trim();
    const inside = (item.match(/\(([^()]*)\)/) || [])[1] || '';
    const hashes = [...outside.matchAll(/#(\d+)/g)].map((m) => ({ kind: 'issue', num: +m[1], raw: '#' + m[1] }));
    if (hashes.length) { refs.push(...hashes); continue; }
    const m = /^(?:([\w.-]*[A-Za-z][\w.-]*)\s+)?(\d+)\b/.exec(outside);
    const alt = /^#(\d+)$/.exec(inside.trim());
    if (m) refs.push({ kind: 'local', area: m[1] || null, num: +m[2], raw: (m[1] ? m[1] + ' ' : '') + m[2], alt: alt ? +alt[1] : null });
    else if (alt) refs.push({ kind: 'issue', num: +alt[1], raw: '#' + alt[1] });
    else if (outside) refs.push({ kind: 'text', raw: outside });
  }
  return { none: false, refs, raw };
}

// "f-build-trace, `d-trace`; [x-own](…) and n-1" → the ids of the PRD items (map nodes), each once.
// A remark in parentheses is not an id, and only what looks like a map id counts (a hyphen,
// an underscore or a digit in it): "f-known needs a grilling" names f-known only. A line that
// is only a dash, "none" (nincs, n/a) or a remark says "deliberately no PRD": none is true.
const PRD_ID = /^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u;
const PRD_NONE = /^(?:[—–-]+|none|nincs|n\/a|nothing|semmi)(?![\p{L}\p{N}-])/iu;
function parsePrd(raw) {
  let s = String(raw).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '');
  for (let k = 0; k < 4 && /\([^()]*\)/.test(s); k++) s = s.replace(/\([^()]*\)/g, ' ');
  s = s.trim();
  if (!s || PRD_NONE.test(s)) return { ids: [], none: true };
  const ids = s.split(/[\s,;]+/).map((x) => x.replace(/[.)]+$/, '').replace(/^\(+/, ''))
    .filter((x) => PRD_ID.test(x) && /[-_\d]/.test(x));
  return { ids: [...new Set(ids)], none: false };
}

function parseTicket(path, area, fileName, text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const t = { kind: 'ticket', path, area, fileName, text, fields: {} };

  let headEnd = lines.findIndex((l, i) => i > 0 && /^##\s/.test(l));
  if (headEnd < 0 || headEnd > 40) headEnd = Math.min(lines.length, 40);
  for (let i = 0; i < headEnd; i++) {
    const m = FIELD.exec(lines[i]);
    if (m && !(m[1].toLowerCase() in t.fields)) t.fields[m[1].toLowerCase()] = m[2].trim();
  }

  const h1 = (lines.find((l) => /^#\s+/.test(l)) || '').replace(/^#\s+/, '').trim();
  const h1m = /^(#?)(\d+)\s*[:.–—-]\s*(.*)$/.exec(h1);
  t.title = plainInline(h1m ? h1m[3] : h1) || fileName;
  const fm = /^(\d+)/.exec(fileName);
  const issueField = /#?(\d+)/.exec(t.fields.issue || '');
  t.fileNum = fm ? fm[1] : null;
  t.issue = issueField ? +issueField[1] : h1m && h1m[1] ? +h1m[2] : fm && fm[1].length >= 3 ? +fm[1] : null;
  t.local = t.issue == null ? (fm ? fm[1] : h1m ? h1m[2] : null) : null;
  t.label = t.issue != null ? '#' + t.issue : t.local != null ? area + ' ' + t.local : fileName;
  t.mismatch = issueField && fm && fm[1].length >= 3 && +fm[1] !== +issueField[1] ? { file: +fm[1], field: +issueField[1] } : null;
  t.earlier = t.fields['earlier name'] || '';
  t.type = t.fields.type || '';
  const prd = 'prd' in t.fields ? parsePrd(t.fields.prd) : { ids: [], none: false };
  t.prd = prd.ids;
  t.prdNone = prd.none;

  const headingsEnd = (() => { const c = lines.findIndex((l) => COMMENTS_HEADING.test(l)); return c < 0 ? lines.length : c; })();
  // The issue template's form: a "## Blocked by" (or "## Status") heading with
  // the value, or a list of values, under it.
  const section = (name) => {
    const at = lines.findIndex((l, i) => i < headingsEnd && new RegExp('^#{2,4}\\s+' + name + '\\s*:?\\s*$', 'i').test(l));
    if (at < 0) return null;
    const items = [];
    for (let j = at + 1; j < lines.length && !/^#{1,6}\s/.test(lines[j]); j++) {
      const l = lines[j].trim();
      if (!l) { if (items.length) break; continue; }
      items.push(l.replace(/^(?:[-*+]|\d+[.)])\s+/, ''));
    }
    return items.length ? items : null;
  };
  if (!('status' in t.fields)) {
    const st = section('status');
    if (st) t.fields.status = st[0];
  }

  // Status: the first word is the state, the rest is the free-text note.
  t.statusLine = 'status' in t.fields;
  const sv = (t.fields.status || '').replace(/^[`*_\s]+/, '');
  const sm = /^([\p{L}][\p{L}\p{N}_-]*)[`*_]*\s*(.*)$/u.exec(sv);
  if (sm) {
    t.status = sm[1].toLowerCase();
    let note = sm[2].trim().replace(/^[—–\-:;,.]+\s*/, '');
    if (/^\(.*\)\.?$/.test(note) && balanced(note.replace(/\.$/, '').slice(1, -1))) note = note.replace(/\.$/, '').slice(1, -1);
    t.statusNote = note;
  } else {
    t.status = UNPARSED;
    t.statusNote = t.statusLine ? (t.fields.status || '') : '';
  }

  if ('blocked by' in t.fields) t.blockedBy = parseBlockedBy(t.fields['blocked by']);
  else {
    const list = section('blocked by');
    if (list) {
      t.fields['blocked by'] = list.join(', ');
      const parts = list.map(parseBlockedBy);
      const refs = parts.flatMap((p) => p.refs);
      t.blockedBy = { none: !refs.length, refs, raw: t.fields['blocked by'] };
    } else t.blockedBy = { none: true, refs: [], raw: '' };
  }

  // Checkboxes count in the whole file: a collector ticket (#45) adds its open items in dated
  // sections under the comments. Dated headings are the comments.
  let commentsAt = lines.findIndex((l) => COMMENTS_HEADING.test(l));
  const bodyEnd = commentsAt < 0 ? lines.length : commentsAt;
  let done = 0, total = 0, fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fence = !fence; continue; }
    if (fence) continue;
    const m = /^\s*(?:[-*+]|\d+[.)])\s+\[( |x|X)\]\s/.exec(lines[i]);
    if (m) { total++; if (m[1] !== ' ') done++; }
  }
  t.checks = { done, total };
  t.comments = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^#{3,5}\s+(.*?)(\d{4}-\d{2}-\d{2})(.*)$/.exec(lines[i]) || (i > bodyEnd ? /^\*\*()(\d{4}-\d{2}-\d{2})([^*]*)\*\*\s*$/.exec(lines[i]) : null);
    if (!m) continue;
    const title = plainInline((m[1] + ' ' + m[3]).replace(/^[\s,:.–—-]+/, '').replace(/\s+/g, ' '));
    t.comments.push({ date: m[2], title, order: i });
  }
  t.lastComment = t.comments.reduce((max, c) => (c.date > max ? c.date : max), '');
  t.hay = fold(t.label + ' ' + (t.issue != null ? t.issue + ' ' : '') + t.title + '\n' + text);
  return t;
}

function balanced(s) {
  let d = 0;
  for (const ch of s) { if (ch === '(') d++; else if (ch === ')' && --d < 0) return false; }
  return d === 0;
}

function parseAdr(path, text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const name = path.split('/').pop();
  const num = (/^(\d+)/.exec(name) || [])[1] || '';
  let status = '';
  const head = lines.slice(0, 30);
  for (let i = 0; i < head.length && !status; i++) {
    const l = head[i];
    let m = /^\s*(?:[-*]\s+)?\*{0,2}(?:status|státusz|állapot)\*{0,2}\s*:\*{0,2}\s*(.+)$/i.exec(l);   // reads Hungarian files too
    if (m) status = m[1];
    else if (/^##\s+(status|státusz|állapot)\s*$/i.test(l)) status = head.slice(i + 1).find((x) => x.trim()) || '';   // reads Hungarian files too
    else if ((m = /^>\s*\*\*([^*]+?)[.:]?\*\*/.exec(l))) status = m[1];
  }
  return { kind: 'adr', path, num, title: firstHeading(lines) || name, status: plainInline(status).slice(0, 60), text, hay: fold(name + ' ' + text) };
}

// Everything the views need, from the source alone.
function readTickets(source) {
  const files = source.files || {};
  const trackerPath = files.trackerPath == null ? null : files.trackerPath;
  const adrPath = files.adrPath || null;
  const m = {
    folderName: source.name || '', trackerPath, adrPath, repo: source.github ? source.github.repo : null,
    tickets: [], docs: [], adrs: [], glossaries: [], areas: new Map(),
    byPath: new Map(), byIssue: new Map(), byLocal: new Map(), byPrd: new Map(), problems: [],
  };
  const area = (name) => {
    if (!m.areas.has(name)) m.areas.set(name, { name, spec: null, tickets: [], docs: [], extras: 0, local: false });
    return m.areas.get(name);
  };
  const prefix = trackerPath ? trackerPath + '/' : '';

  for (const [path, file] of files.entries || []) {
    const topDoc = !path.includes('/') && (README_FILE.test(path) || GLOSSARY_FILE.test(path));
    const inTracker = trackerPath != null && path.startsWith(prefix) && (prefix || !topDoc);
    if (adrPath && path.startsWith(adrPath + '/')) {
      const adr = parseAdr(path, file.text);
      m.adrs.push(adr);
      m.byPath.set(path, adr);
    } else if (inTracker) {
      const rel = path.slice(prefix.length);
      const tm = ticketPath(path, trackerPath);
      if (tm) {
        const t = parseTicket(path, tm.area, tm.name, file.text);
        t.source = 'file';
        m.tickets.push(t);
        area(tm.area).tickets.push(t);
        area(tm.area).local = true;
        m.byPath.set(path, t);
        continue;
      }
      const seg = rel.includes('/') ? rel.slice(0, rel.indexOf('/')) : '';
      const lines = file.text.split('\n', 60);
      const isSpec = /^spec\.(md|markdown)$/i.test(rel.slice(seg.length + 1)) && seg !== '';
      // The /to-spec template has no title line: it starts at "## Problem Statement".
      const h1 = lines.find((l) => /^#\s+\S/.test(l));
      const title = isSpec ? (h1 ? plainInline(h1.replace(/^#\s+/, '').replace(/\s*#*\s*$/, '')) : seg + ' – spec') : firstHeading(lines) || rel;
      const doc = { kind: isSpec ? 'spec' : 'doc', path, area: seg, rel: seg ? rel.slice(seg.length + 1) : rel, title, text: file.text };
      doc.hay = fold(doc.path + ' ' + doc.title);
      m.docs.push(doc);
      m.byPath.set(path, doc);
      if (isSpec) area(seg).spec = doc; else area(seg).docs.push(doc);
      area(seg).local = true;
    } else {
      const isReadme = README_FILE.test(path);
      const doc = { kind: isReadme ? 'readme' : 'glossary', path, area: '', rel: path, title: firstHeading(file.text.split('\n', 60)) || path, text: file.text };
      doc.hay = fold(doc.path + ' ' + doc.title);
      if (isReadme) m.readme = doc; else m.glossaries.push(doc);
      m.byPath.set(path, doc);
    }
  }
  for (const p of files.others || []) {
    if (trackerPath == null || !p.startsWith(prefix)) continue;
    const rel = p.slice(prefix.length);
    if (rel.includes('/') && m.areas.has(rel.slice(0, rel.indexOf('/')))) m.areas.get(rel.slice(0, rel.indexOf('/'))).extras++;
  }
  m.projectName = (m.readme && m.readme.title) || m.folderName;
  if (source.github) for (const issue of source.github.issues || []) {
    const t = parseIssue(issue, source.github.repo);
    m.tickets.push(t);
    area(t.area).tickets.push(t);
    m.byPath.set(t.path, t);
  }

  // Numbering: an issue number is global; an older ticket is "<area> <number>".
  const push = (map, key, t) => { if (!map.has(key)) map.set(key, []); map.get(key).push(t); };
  for (const t of m.tickets) {
    if (t.issue != null) push(m.byIssue, t.issue, t);
    else if (t.local != null) push(m.byLocal, t.area + '/' + +t.local, t);
    for (const id of t.prd) push(m.byPrd, id, t);
  }
  const alias = new Map();
  for (const t of m.tickets) {
    const e = /^(.+?)\s+(\d+)$/.exec(t.earlier);
    if (e) alias.set(e[1] + '/' + +e[2], t);
  }
  const local = (areaName, num) => (m.byLocal.get(areaName + '/' + num) || [])[0] || alias.get(areaName + '/' + num) || null;
  const issue = (num) => (m.byIssue.get(num) || [])[0] || null;
  m.resolveIssue = issue;
  m.resolveLocal = local;
  // A blocker named by its title or its file name ("Blocked by: Store the
  // label", or "01-store-the-label"): /to-tickets allows "numbers/titles".
  const nameKey = (s) => fold(plainInline(s)).replace(/^["'„“]+|["'”.]+$/g, '').replace(/[\s_-]+/g, ' ').trim();
  const byName = new Map();
  for (const t of m.tickets) {
    for (const key of new Set([nameKey(t.title), nameKey(t.fileName), nameKey(t.fileName.replace(/^\d+[\s_-]*/, ''))])) if (key) push(byName, key, t);
  }
  const named = (areaName, raw) => {
    const list = byName.get(nameKey(raw)) || [];
    const here = list.filter((x) => x.area === areaName);
    return here.length === 1 ? here[0] : list.length === 1 ? list[0] : null;
  };

  for (const t of m.tickets) {
    t.blockers = [];
    t.notes = [];
    for (const r of t.blockedBy.refs) {
      let hit = null;
      if (r.kind === 'text') {
        hit = named(t.area, r.raw);
        if (!hit) { t.notes.push(r.raw); continue; }
      } else if (r.kind === 'issue') hit = issue(r.num) || (t.issue == null ? local(t.area, r.num) : null);
      else if (r.area) hit = local(r.area, r.num);
      else hit = local(t.area, r.num) || (r.alt != null ? issue(r.alt) : null) || issue(r.num);
      if (hit === t) continue;
      if (!t.blockers.some((b) => b.ticket && b.ticket === hit)) t.blockers.push({ raw: r.raw, ticket: hit });
    }
    t.dependents = [];
  }
  for (const t of m.tickets) for (const b of t.blockers) if (b.ticket) b.ticket.dependents.push(t);
  for (const t of m.tickets) t.blocked = !isClosed(t) && t.blockers.some((b) => b.ticket && !isClosed(b.ticket));

  const order = (t) => (t.issue != null ? [0, t.issue, ''] : [1, +t.local || 0, t.area]);
  m.tickets.sort((a, b) => {
    const x = order(a), y = order(b);
    return x[0] - y[0] || (x[0] ? x[2].localeCompare(y[2]) : 0) || x[1] - y[1] || a.path.localeCompare(b.path);
  });
  m.adrs.sort((a, b) => a.path.localeCompare(b.path));
  m.docs.sort((a, b) => a.path.localeCompare(b.path));
  for (const a of m.areas.values()) {
    a.open = a.tickets.filter((t) => !isClosed(t)).length;
    a.closed = a.tickets.length - a.open;
  }
  m.areaList = [...m.areas.values()].sort((a, b) => (b.open > 0) - (a.open > 0) || a.name.localeCompare(b.name));
  m.statusCounts = new Map();
  for (const t of m.tickets) m.statusCounts.set(t.status, (m.statusCounts.get(t.status) || 0) + 1);
  m.open = m.tickets.filter((t) => !isClosed(t));
  // "core 3" names a local ticket: only the folders' areas, not the milestones.
  const names = [...m.areas.values()].filter((a) => a.local && a.name).map((a) => a.name).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  m.areaRef = names.length ? new RegExp('(^|[^\\w/.-])((' + names.join('|') + ')\\s(\\d{1,4}))(?![\\w-])', 'g') : null;

  m.comments = [];
  for (const t of m.tickets) for (const c of t.comments) m.comments.push({ ...c, ticket: t });
  m.comments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.order - a.order);

  findProblems(m, source.mapIds == null ? null : new Set(source.mapIds));
  return m;
}

// Each problem names the UI string that tells it (key, with its params): the page translates.
function findProblems(m, mapIds) {
  const add = (kind, tickets, key, params) => m.problems.push({ kind, tickets, key, params: params || {} });
  // PRD references: every open ticket needs one once the project links tickets to a PRD (it
  // has a map, or a ticket names one); an id is unknown only when the map could be read.
  const linksPrd = !!mapIds || m.byPrd.size > 0;
  for (const t of m.tickets) {
    const unknown = mapIds ? t.prd.filter((id) => !mapIds.has(id)) : [];
    if (unknown.length) add('unknown-prd', [t], 'problem.unknown-prd.text', { list: unknown.join(', ') });
    if (linksPrd && !t.prd.length && !t.prdNone && !isClosed(t)) add('no-prd', [t], 'problem.no-prd.text');
    if (!t.statusLine) add('no-status', [t], 'problem.no-status.text');
    else if (t.status === UNPARSED) {
      if (t.statusNote) add('bad-status', [t], 'problem.bad-status.text', { line: t.statusNote });
      else add('bad-status', [t], 'problem.bad-status.empty');
    }
    if (t.status === 'ready-for-agent' && t.checks.total > 0 && t.checks.done === t.checks.total) add('all-checked', [t], 'problem.all-checked.text', { n: t.checks.total });
    const missing = t.blockers.filter((b) => !b.ticket);
    if (missing.length) add('missing-blocker', [t], 'problem.missing-blocker.text', { list: missing.map((b) => b.raw).join(', ') });
    if (!isClosed(t) && t.blockers.length && t.blockers.every((b) => b.ticket && isClosed(b.ticket))) add('released', [t], 'problem.released.text', { list: t.blockers.map((b) => b.ticket.label).join(', ') });
    if (t.mismatch) add('mismatch', [t], 'problem.mismatch.text', { file: t.mismatch.file, field: t.mismatch.field });
    if (t.issue == null && t.local == null) add('no-number', [t], 'problem.no-number.text');
  }
  for (const [num, list] of m.byIssue) if (list.length > 1) add('duplicate', list, 'problem.duplicate.issue', { n: list.length, num });
  for (const [key, list] of m.byLocal) if (list.length > 1) add('duplicate', list, 'problem.duplicate.local', { n: list.length, key: key.replace('/', ' ') });
}

// ───────────────────────── GitHub issues ─────────────────────────

// The triage states the mattpocock skills put on an issue as a label.
const STATE_LABEL = /^(ready-for-agent|ready-for-human|needs-info|needs-triage|claimed|needs-.*test)$/;

// An issue as a ticket: the body is read like a ticket file (its "Blocked by" line or section,
// its checkboxes, its dated headings); the state, the number and the area come from GitHub.
function parseIssue(issue, repo) {
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean);
  const milestone = issue.milestone || '';
  const t = parseTicket((repo || 'github') + '#' + issue.number, milestone, String(issue.number), '# ' + issue.title + '\n\n' + (issue.body || ''));
  t.source = 'github';
  t.title = issue.title;
  t.issue = issue.number;
  t.local = null;
  t.fileNum = null;
  t.label = '#' + issue.number;
  t.mismatch = null;
  t.url = issue.url || '';
  t.labels = labels;
  t.milestone = milestone || null;

  t.statusLine = true;
  if (issue.state === 'closed') {
    t.status = issue.stateReason === 'not_planned' || issue.stateReason === 'duplicate' ? 'wontfix' : 'closed';
  } else {
    t.status = (labels.find((l) => STATE_LABEL.test(l)) || 'needs-triage').toLowerCase();   // no state label yet: to be triaged
  }
  t.statusNote = '';
  t.fields.status = t.status;

  // GitHub's own dependency links, and the body's "Blocked by": one list, each blocker once.
  const refs = [...t.blockedBy.refs];
  const own = (repo || '').toLowerCase();
  for (const b of issue.blockedBy || []) {
    const raw = !b.repo || b.repo.toLowerCase() === own ? '#' + b.number : b.repo + '#' + b.number;
    if (refs.some((r) => r.raw === raw)) continue;
    refs.push(raw.startsWith('#') ? { kind: 'issue', num: b.number, raw } : { kind: 'text', raw });
  }
  t.blockedBy = { none: !refs.length, refs, raw: refs.map((r) => r.raw).join(', ') };
  t.fields['blocked by'] = t.blockedBy.raw;

  // Opening and closing are the issue's dated events, next to the body's dated headings.
  const day = (iso) => (iso ? String(iso).slice(0, 10) : '');
  if (issue.createdAt) t.comments.push({ date: day(issue.createdAt), title: '', event: 'opened', order: -2 });
  if (issue.closedAt) t.comments.push({ date: day(issue.closedAt), title: '', event: 'closed', order: 1e9 });
  t.lastComment = t.comments.reduce((max, c) => (c.date > max ? c.date : max), '');
  t.hay = fold(t.label + ' ' + issue.number + ' ' + t.title + ' ' + labels.join(' ') + ' ' + milestone + '\n' + (issue.body || ''));
  return t;
}

// ───────────────────────── The PRD map ─────────────────────────

// The ids of every node of Plan's map (docs/product/mindmap.json, or the data of GET
// /api/plan/map): the source's mapIds. null when the map is not one (missing, an error answer).
function mapIds(map) {
  if (!map || !map.nodeData || typeof map.nodeData !== 'object') return null;
  const ids = [];
  const walk = (node) => {
    if (node.id != null) ids.push(String(node.id));
    for (const c of node.children || []) walk(c);
  };
  walk(map.nodeData);
  return ids;
}

// ───────────────────────── Plan and Build ─────────────────────────

// Plan's deep link (modules/plan/deep-link.mjs makes the same; a test holds them together),
// and the PRD item a Build link names (deep-link.mjs buildLink: /?module=build&prd=<id>).
const planLink = (id) => '/?module=plan&node=' + encodeURIComponent(id);
const prdFilter = (search) => new URLSearchParams(search || '').get('prd') || '';

root.GroundworkTickets = {
  readTickets, mapIds, locateProject, ticketPath, keepsFolder, planLink, prdFilter,
  DONE, DROPPED, CLOSED, UNPARSED, README_FILE, GLOSSARY_FILE, DEFAULT_TRACKER_DIR, ALWAYS_SKIP, SKIP_DIRS, LOCATE_DEPTH,
  fold, plainInline, isClosed, isDone, isDropped,
};
})(typeof window !== 'undefined' ? window : globalThis);
