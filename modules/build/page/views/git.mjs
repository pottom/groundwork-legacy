// The git view: the branches (local and remote) against the base branch, and the commit graph.
// Needs the core server, which runs git (module.mjs, GET /api/build/git).

import { html, svg, nothing } from '/vendor/lit-html/lit-html.js';
import { GIT_PAGE, GIT_ROW_H, GIT_LANE_W, GIT_COLORS, NO_REPO } from '../config.mjs';
import { ui, tx, fullTime, relTime } from '../text.mjs';
import { app, actions } from '../state.mjs';
import { badge, count, dash, sectionHead, empty, table } from '../parts.mjs';

const shortHash = (h) => h.slice(0, 7);

// The branch a merge commit brought in, when its subject is git's own wording.
function mergedName(subject) {
  const m = /^Merge (?:remote-tracking )?branch '([^']+)'/.exec(subject) || /^Merge pull request #\d+ from \S+?\/(\S+)/.exec(subject) || /^Merge branch (\S+)/.exec(subject);
  return m ? m[1] : '';
}

// Lanes: each commit gets a column. A lane holds the commit it waits for next (the first parent
// of the one above); a merge opens or joins a lane for each further parent; lanes that wait for
// the same commit end in it (where a branch forked). The base branch keeps lane 0, so its line
// runs straight.
function layoutGit(g) {
  const index = new Map(g.commits.map((c, i) => [c.hash, i]));
  const base = g.refs.find((r) => r.kind === 'branch' && r.name === g.base);
  const lanes = [];
  let color = 1;
  // Held for the base until its tip comes; nothing is drawn in it before.
  if (base && index.has(base.hash)) lanes[0] = { hash: base.hash, color: 0, held: true };
  const free = () => { let k = 0; while (lanes[k]) k++; return k; };
  let width = 1;
  const rows = g.commits.map((c) => {
    const before = lanes.map((l) => (l ? { ...l } : null));
    let at = lanes.findIndex((l) => l && l.hash === c.hash);
    if (at < 0) { at = free(); lanes[at] = { hash: c.hash, color: color++ % GIT_COLORS }; }
    const own = lanes[at].color;
    const ends = [];
    lanes.forEach((l, k) => { if (l && k !== at && l.hash === c.hash) { ends.push({ k, color: l.color }); lanes[k] = null; } });
    const outs = [];
    if (c.parents.length) { lanes[at] = { hash: c.parents[0], color: own }; outs.push({ k: at, color: own }); } else lanes[at] = null;
    for (const p of c.parents.slice(1)) {
      let k = lanes.findIndex((l) => l && l.hash === p);
      if (k < 0) { k = free(); lanes[k] = { hash: p, color: color++ % GIT_COLORS }; }
      outs.push({ k, color: lanes[k].color });
    }
    while (lanes.length && !lanes[lanes.length - 1]) lanes.pop();
    width = Math.max(width, lanes.length, at + 1);
    // Lanes that only pass by this row.
    const through = [];
    before.forEach((l, k) => { if (l && !l.held && l.hash !== c.hash && lanes[k] && lanes[k].hash === l.hash) through.push({ k, color: l.color }); });
    return { c, at, color: own, ends, outs, through, start: !before[at] || before[at].hash !== c.hash || !!before[at].held };
  });
  return { rows, width };
}

const graphWidth = (width) => 10 + width * GIT_LANE_W + 2;

// The lines and dots of a run of rows.
function gitSvg(rows, width) {
  const x = (k) => 10 + k * GIT_LANE_W, H = GIT_ROW_H;
  const paths = [], dots = [];
  const curve = (x1, y1, x2, y2) => (x1 === x2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`);
  const line = (color, d) => svg`<path class="lane${color}" d=${d} stroke="var(--c)"/>`;
  rows.forEach((r, i) => {
    const top = i * H, mid = top + H / 2, bottom = top + H, cx = x(r.at);
    for (const t of r.through) paths.push(line(t.color, `M${x(t.k)} ${top}V${bottom}`));
    if (!r.start) paths.push(line(r.color, `M${cx} ${top}V${mid}`));
    for (const e of r.ends) paths.push(line(e.color, curve(x(e.k), top, cx, mid)));
    for (const o of r.outs) paths.push(line(o.color, curve(cx, mid, x(o.k), bottom)));
    const merge = r.c.parents.length > 1;
    dots.push(svg`<circle class="lane${r.color}" cx=${cx} cy=${mid} r=${merge ? 3.5 : 4.5} stroke="var(--c)" fill=${merge ? 'var(--gw-surface)' : 'var(--c)'}/>`);
  });
  return html`<svg width=${graphWidth(width)} height=${rows.length * H} aria-hidden="true">${paths}${dots}</svg>`;
}

function refPill(r, color, asButton) {
  const cls = `ref ${r.kind === 'tag' ? 'tag' : r.kind === 'remote' ? 'remote lane' + color : 'lane' + color}${r.head ? ' head' : ''}`;
  const title = ui(r.kind === 'tag' ? 'git.tag' : r.kind === 'remote' ? 'git.remote' : r.head ? 'git.head' : 'git.local');
  return asButton
    ? html`<button type="button" class=${cls} title=${ui('git.jump', { what: title })} @click=${() => actions.gitJump(r.hash)}>${r.name}</button>`
    : html`<span class=${cls} title=${title}>${r.name}</span>`;
}

function branchState(r, g) {
  if (r.kind === 'branch' && r.name === g.base) return badge('accent', ui('git.base'));
  if (r.ahead == null) return dash;
  // The base's own remote: not merged into it, only behind or ahead of it.
  const baseRef = g.refs.find((b) => b.kind === 'branch' && b.name === g.base);
  if (r.kind === 'remote' && baseRef && baseRef.upstream === r.name) {
    if (!r.ahead && !r.behind) return badge('ok', ui('git.same', { base: g.base }));
    return [r.behind ? badge('info', ui('git.not-pushed', { n: r.behind })) : nothing, r.behind && r.ahead ? ' ' : '', r.ahead ? badge('info', ui('git.not-pulled', { n: r.ahead })) : nothing];
  }
  if (r.ahead === 0) return [badge('ok', ui('git.merged', { base: g.base })), r.behind ? html` <span class="muted">${ui('git.behind-merged', { n: r.behind, base: g.base })}</span>` : nothing];
  return [badge('info', ui('git.ahead', { n: r.ahead, base: g.base })), r.behind ? html` <span class="muted">${ui('git.behind', { n: r.behind })}</span>` : nothing];
}

function commitRow(r, refsAt) {
  const c = r.c, merge = c.parents.length > 1;
  const pills = (refsAt.get(c.hash) || []).map((ref) => refPill(ref, r.color, false));
  return html`<div class="row${merge ? ' merge' : ''}${app.git.hit === c.hash ? ' hit' : ''}" data-commit=${c.hash} title=${c.subject} @click=${() => actions.toggleCommit(c.hash)}><span class="h">${shortHash(c.hash)}</span>${pills.length ? html`<span class="refs">${pills}</span>` : nothing}<span class="s">${c.subject}</span><span class="who">${c.author}</span><span class="when" title=${fullTime(c.date)}>${relTime(c.date)}</span></div>`;
}

function commitDetail(c) {
  const merge = c.parents.length > 1;
  const into = merge ? mergedName(c.subject) : '';
  const parents = c.parents.map((p, i) => [i ? ', ' : '', html`<span class="mono">${shortHash(p)}</span>`]);
  return html`<div class="detail"><div class="mono">${c.hash}</div><div>${c.subject}</div><div class="muted">${c.author} · ${fullTime(c.date)}${merge ? [' · ', tx('git.merge-parents', { n: c.parents.length, list: parents })] : c.parents.length ? '' : ' · ' + ui('git.first')}${into ? [' · ', tx('git.merged-branch', { name: html`<b>${into}</b>` })] : nothing}</div></div>`;
}

// The graph: a detail line pushes the rows below it down, so the graph is drawn per block.
function graph(layout, refsAt) {
  const out = [];
  let block = [];
  const flush = () => {
    if (!block.length) return;
    out.push(html`<div class="block" style="position:relative;padding-left:${graphWidth(layout.width)}px">${gitSvg(block, layout.width)}${block.map((r) => commitRow(r, refsAt))}</div>`);
    block = [];
  };
  for (const r of layout.rows) {
    block.push(r);
    if (app.git.open.has(r.c.hash)) { flush(); out.push(html`<div style="padding-left:${graphWidth(layout.width)}px">${commitDetail(r.c)}</div>`); }
  }
  flush();
  return out;
}

export function gitView() {
  const source = app.source;
  if (!source || !source.server) return empty('branch', ui('git.no-server-title'), tx('git.no-server'));
  if (!source.git) return html`<div class="gw-callout gw-callout--warn"><div class="gw-callout__body">${ui('git.old-server')}</div></div>`;
  const g = app.git.data;
  if (!g) {
    return app.git.error
      ? empty('branch', app.git.error === NO_REPO ? ui('git.no-repo') : ui('git.error', { error: app.git.error }), '')
      : empty('branch', ui('git.loading'), '');
  }
  const layout = layoutGit(g);
  const color = new Map(layout.rows.map((r) => [r.c.hash, r.color]));
  const refsAt = new Map();
  for (const r of g.refs) { if (!refsAt.has(r.hash)) refsAt.set(r.hash, []); refsAt.get(r.hash).push(r); }
  const order = { branch: 0, remote: 1, tag: 2 };
  for (const list of refsAt.values()) list.sort((a, b) => b.head - a.head || order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));

  // The branches, local and remote, the newest first; the base on top. The tab counts the same.
  const branches = g.refs.filter((r) => r.kind !== 'tag').sort((a, b) => (b.name === g.base && b.kind === 'branch') - (a.name === g.base && a.kind === 'branch') || b.date - a.date);
  const local = branches.filter((r) => r.kind === 'branch').length;
  const baseUp = (g.refs.find((r) => r.kind === 'branch' && r.name === g.base) || {}).upstream;
  const merged = branches.filter((r) => r.ahead === 0 && !(r.kind === 'remote' && r.name === baseUp)).length;
  const merges = g.commits.filter((c) => c.parents.length > 1).length;
  const branchTable = table(
    html`<th>${ui('git.branch')}</th><th>${ui('git.relation', { base: g.base ? g.base : ui('git.base-branch') })}</th><th class="c-last">${ui('git.last-commit')}</th>`,
    branches.map((r) => html`<tr><td class="c-branch">${refPill(r, color.get(r.hash) ?? 7, true)}${r.worktree && !r.head ? [' ', badge('violet', ui('git.worktree'), ui('git.worktree-title'))] : nothing}${r.upstream ? html`<span class="muted">→ ${r.upstream}</span>` : nothing}</td><td>${branchState(r, g)}</td><td class="c-last" title=${fullTime(r.date)}>${relTime(r.date)}</td></tr>`),
  );
  const shown = g.commits.length;
  const tags = g.refs.filter((r) => r.kind === 'tag').length;
  const legend = html`<span class="legend-refs">${ui('git.legend')} ${refPill({ kind: 'branch', name: ui('git.local'), hash: '' }, 0, false)} ${refPill({ kind: 'remote', name: ui('git.remote'), hash: '' }, 0, false)} ${refPill({ kind: 'tag', name: ui('git.tag'), hash: '' }, 0, false)} ${refPill({ kind: 'branch', name: ui('git.checked-out-branch'), hash: '', head: true }, 0, false)}</span>`;
  const branchHint = [ui('git.local-remote', { local, remote: branches.length - local }), ui('git.merged-n', { merged, base: g.base }), tags ? ui('git.tags', { n: tags }) : '', g.headBranch ? ui('git.checked-out', { name: g.headBranch }) : ui('git.detached')].filter(Boolean).join(' · ');
  return html`<p class="lead">${ui('git.lead')}</p>
<section class="group">${sectionHead(ui('git.branches'), count(branches.length), branchHint)}${branchTable}</section>
<section class="group">${sectionHead(ui('git.graph'), count(shown), (shown < g.total ? ui('git.newest', { shown, total: g.total }) : ui('git.all')) + ' · ' + ui('git.merges', { n: merges }))}
<div class="gw-card graph" style="--row-h:${GIT_ROW_H}px"><div class="rows">${graph(layout, refsAt)}</div></div>
<div class="graph-foot">${shown < g.total ? html`<button type="button" class="gw-btn" ?disabled=${app.git.loadingMore} @click=${actions.moreCommits}>${ui('git.more', { n: Math.min(GIT_PAGE, g.total - shown) })}</button>` : nothing}${legend}</div></section>`;
}
