// The Build module behind the core server: its view and its read-only /api/build/ endpoints.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../../core/server.mjs';
import build, { buildModule } from './module.mjs';
import { listen } from '../../core/sse-client.mjs';

const hasGit = (() => { try { execFileSync('git', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();

// A small project: a ticket, a README, a file that is not markdown, and folders that are never listed.
function project() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-build-'));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('README.md', '# Demo project\n');
  write('.scratch/core/issues/01-first.md', '# First\n\n**Status:** ready-for-agent\n');
  write('.scratch/core/notes.txt', 'not markdown');
  write('node_modules/pkg/README.md', '# hidden\n');
  write('dist/out.md', '# hidden too\n');
  return root;
}

// Every path below root with its size and time, to show nothing changed.
function snapshot(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const s = fs.statSync(full);
      out.push(`${path.relative(root, full)} ${e.isDirectory() ? 'dir' : s.size + ' ' + s.mtimeMs}`);
      if (e.isDirectory()) walk(full);
    }
  };
  walk(root);
  return out.sort();
}

async function withServer(root, fn) {
  const srv = await startServer({ root, modules: [build], port: 0 });
  try { await fn(`http://127.0.0.1:${srv.port}`); } finally { await srv.close(); }
}

test('the view is served under /build/ and says hello under /api/build/', async () => {
  const root = project();
  await withServer(root, async (base) => {
    assert.match(await (await fetch(`${base}/build/`)).text(), /<html/i);
    const hello = await (await fetch(`${base}/api/build/hello`)).json();
    assert.equal(hello.server, 'development-status');
    assert.equal(hello.api, 1);
    assert.equal(hello.git, true);
    assert.equal(hello.name, path.basename(root));
  });
});

test('the list holds the markdown files, not the skipped folders', async () => {
  const root = project();
  await withServer(root, async (base) => {
    const list = await (await fetch(`${base}/api/build/list`)).json();
    assert.deepEqual(list.files.map((f) => f.path), ['.scratch/core/issues/01-first.md', 'README.md']);
    assert.equal(list.dirs['.scratch/core'], 1);
  });
});

test('a listed file is served; anything else is not', async () => {
  const root = project();
  fs.writeFileSync(path.join(path.dirname(root), 'gw-build-outside.md'), '# outside\n');
  await withServer(root, async (base) => {
    const file = (p) => fetch(`${base}/api/build/file?path=${encodeURIComponent(p)}`);
    const r = await file('.scratch/core/issues/01-first.md');
    assert.equal(r.status, 200);
    assert.match(await r.text(), /ready-for-agent/);
    for (const p of ['../gw-build-outside.md', path.join(path.dirname(root), 'gw-build-outside.md'), '.scratch\\core\\issues\\01-first.md',
      '.scratch/core/notes.txt', 'node_modules/pkg/README.md', 'dist/out.md', '']) {
      assert.equal((await file(p)).status, 404, p);
    }
  });
});

test('only GET and HEAD are answered', async () => {
  const root = project();
  await withServer(root, async (base) => {
    assert.equal((await fetch(`${base}/api/build/list`, { method: 'POST', body: '{}' })).status, 405);
    assert.equal((await fetch(`${base}/api/build/list`, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(`${base}/api/build/nothing`)).status, 404);
  });
});

test('a folder that is not the top of a git repository has no history', async () => {
  const root = project();
  await withServer(root, async (base) => {
    const g = await (await fetch(`${base}/api/build/git`)).json();
    assert.equal(g.server, 'development-status');
    assert.equal(g.available, false);
  });
});

test('the git history of the project, read only', { skip: !hasGit && 'git is not installed' }, async () => {
  const root = project();
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: root, stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'First commit');
  git('branch', 'feature');
  const before = snapshot(root);
  await withServer(root, async (base) => {
    const g = await (await fetch(`${base}/api/build/git?limit=10`)).json();
    assert.equal(g.available, true);
    assert.equal(g.base, 'main');
    assert.equal(g.headBranch, 'main');
    assert.deepEqual(g.commits.map((c) => c.subject), ['First commit']);
    assert.deepEqual(g.refs.filter((r) => r.kind === 'branch').map((r) => r.name).sort(), ['feature', 'main']);
    const again = await (await fetch(`${base}/api/build/git?limit=10&known=${g.fingerprint}`)).json();
    assert.equal(again.unchanged, true);
    await fetch(`${base}/api/build/list`);
    await fetch(`${base}/api/build/file?path=README.md`);
  });
  assert.deepEqual(snapshot(root), before);
});

test('a project without a GitHub remote has no issues', async () => {
  const root = project();
  await withServer(root, async (base) => {
    const answer = await (await fetch(`${base}/api/build/issues`)).json();
    assert.equal(answer.server, 'development-status');
    assert.deepEqual([answer.available, answer.reason], [false, 'no-repo']);
  });
});

test('the GitHub issues of the project\'s origin, fetched by the server', { skip: !hasGit && 'git is not installed' }, async () => {
  const root = project();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/app.git'], { cwd: root, stdio: 'pipe' });
  const asked = [];
  const request = async (p) => {
    asked.push(p);
    return p.startsWith('repos/acme/app/issues?') ? [{ number: 4, title: 'Four', state: 'open', labels: [{ name: 'ready-for-agent' }], milestone: { title: 'M1' }, body: '## Blocked by\n\n- #2\n' }] : [];
  };
  const srv = await startServer({ root, modules: [buildModule({ githubRequest: request })], port: 0 });
  try {
    const base = `http://127.0.0.1:${srv.port}`;
    const answer = await (await fetch(`${base}/api/build/issues`)).json();
    assert.equal(answer.available, true);
    assert.equal(answer.repo, 'acme/app');
    assert.deepEqual(answer.issues.map((i) => [i.number, i.title, i.milestone, i.labels]), [[4, 'Four', 'M1', ['ready-for-agent']]]);
    const again = await (await fetch(`${base}/api/build/issues?known=${answer.fingerprint}`)).json();
    assert.deepEqual([again.unchanged, again.fingerprint], [true, answer.fingerprint]);
    assert.equal(asked.length, 1, 'polling is answered from what the server keeps');
  } finally { await srv.close(); }
});

test('the page reads tickets with the ticket reader, a classic script beside it', async () => {
  await withServer(project(), async (base) => {
    const reader = await fetch(`${base}/build/ticket-reader.js`);
    assert.equal(reader.status, 200);
    assert.doesNotMatch(await reader.text(), /^\s*(import|export)\s/m, 'not an ES module: the page works from file:// too');
    const page = await (await fetch(`${base}/build/`)).text();
    assert.match(page, /<script src="ticket-reader\.js"><\/script>/);
    assert.match(page, /\} = GroundworkTickets;/);
    assert.match(page, /readTickets\(\{/);
    assert.doesNotMatch(page, /function parseTicket|function buildModel/, 'no copy of the reader left in the page');
  });
});

test('reading the project writes nothing into it', async () => {
  const root = project();
  const before = snapshot(root);
  await withServer(root, async (base) => {
    for (const p of ['/build/', '/api/build/hello', '/api/build/list', '/api/build/file?path=README.md', '/api/build/git', '/api/build/issues', '/api/build/prd']) await fetch(base + p);
  });
  assert.deepEqual(snapshot(root), before);
});

// The shared look: the page takes its colours and type from the shell's theme (/shell/theme.css).
// Opened by double click there is no shell and no theme, so the page carries the same values as a
// fallback, in light and dark.
const THEME = fs.readFileSync(new URL('../../core/shell/theme.css', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const usedShellVariables = (page) => new Set([...page.matchAll(/var\((--gw-[\w-]+)/g)].map((m) => m[1]));

// The --gw-* declarations of the first block that `opener` (ending in its "{") starts, as { name: value }.
function declarations(css, opener) {
  const m = css.match(opener);
  if (!m) return null;
  const body = css.slice(m.index + m[0].length);
  const out = {};
  for (const d of body.slice(0, body.indexOf('}')).matchAll(/(--gw-[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}

test('the view links the shell theme and uses its variables', async () => {
  await withServer(project(), async (base) => {
    const page = await (await fetch(`${base}/build/`)).text();
    assert.match(page, /<link rel="stylesheet" href="\/shell\/theme\.css">/);
    const theme = await (await fetch(`${base}/shell/theme.css`)).text();
    const used = usedShellVariables(page);
    for (const v of ['--gw-bg', '--gw-fg', '--gw-accent', '--gw-line', '--gw-font', '--gw-ok', '--gw-bad']) assert.ok(used.has(v), `uses ${v}`);
    for (const v of used) assert.match(theme, new RegExp(`${v}:`), `${v} is a shell variable`);
    // The old local palette is gone: a shared colour has one name.
    for (const old of ['--ink', '--ink-2', '--bg', '--surface', '--sunken', '--line', '--line-strong', '--accent', '--focus', '--shadow', '--radius', '--sans', '--mono']) {
      assert.doesNotMatch(page, new RegExp(`var\\(${old}[,)]`), `still uses ${old}`);
    }
  });
});

test('without the shell the view falls back to the same light and dark values', () => {
  const light = declarations(PAGE, /:where\(:root\)\s*\{/);
  const dark = declarations(PAGE, /prefers-color-scheme:\s*dark\)\s*\{\s*:where\(:root\)\s*\{/);
  assert.ok(light && dark, 'a :where(:root) fallback, light and dark');
  const themeLight = declarations(THEME, /:root\s*\{/);
  const themeDark = declarations(THEME, /prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{/);
  for (const v of usedShellVariables(PAGE)) {
    assert.equal(light[v], themeLight[v], `light ${v}`);
    if (v in themeDark) assert.equal(dark[v], themeDark[v], `dark ${v}`);
  }
});

test('light or dark follows the operating system: the view has no switch of its own', () => {
  assert.doesNotMatch(PAGE, /data-theme|dataset\.theme/);
});

// ───────── Live updates and Plan's ticket counts ─────────

test('markdown files and git refs are Build\'s live-update topics', () => {
  assert.equal(build.watch('.scratch/core/issues/01-first.md'), 'build.files');
  assert.equal(build.watch('README.md'), 'build.files');
  assert.equal(build.watch('docs/adr/0001-x.markdown'), 'build.files');
  assert.equal(build.watch('.git/HEAD'), 'build.git');
  assert.equal(build.watch('.git/refs/heads/main'), 'build.git');
  assert.equal(build.watch('.git/packed-refs'), 'build.git');
  assert.equal(build.watch('src/app.js'), null);
  assert.equal(build.watch('node_modules/pkg/README.md'), null);
  assert.equal(build.watch('docs/product/mindmap.json'), null);
});

test('a new ticket file reaches the page through /api/events', async () => {
  const root = project();
  const srv = await startServer({ root, modules: [build], port: 0 });
  const sse = listen(srv.port);
  try {
    await sse.next((e) => e.event === 'hello');
    fs.writeFileSync(path.join(root, '.scratch/core/issues/02-second.md'), '# Second\n\n**Status:** ready-for-human\n');
    await sse.change('build.files');
  } finally { sse.close(); await srv.close(); }
});

test('the server re-checks GitHub while a page listens and pushes a change of the issues', { skip: !hasGit && 'git is not installed' }, async () => {
  const root = project();
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/app.git'], { cwd: root, stdio: 'pipe' });
  let title = 'Four';
  const request = async (p) => (p.startsWith('repos/acme/app/issues?') ? [{ number: 4, title, state: 'open', labels: [], body: '' }] : []);
  // GitHub's answer is kept for a minute for the pages' own reads; the re-check asks afresh,
  // so a change on GitHub reaches the pages within one re-check.
  const srv = await startServer({ root, modules: [buildModule({ githubRequest: request, githubTtlMs: 60000, issuesCheckMs: 40 })], port: 0 });
  const sse = listen(srv.port);
  try {
    await sse.next((e) => e.event === 'hello');
    const base = `http://127.0.0.1:${srv.port}`;
    assert.equal((await (await fetch(`${base}/api/build/issues`)).json()).issues[0].title, 'Four');
    await new Promise((r) => setTimeout(r, 200));
    title = 'Four, renamed on GitHub';
    await sse.change('build.issues');
    assert.equal((await (await fetch(`${base}/api/build/issues`)).json()).issues[0].title, 'Four, renamed on GitHub', 'the page asking after the push gets the new issues');
  } finally { sse.close(); await srv.close(); }
});

test('Plan\'s ticket counts: per PRD item, the tickets naming it and how many are done, read by the ticket reader', { skip: !hasGit && 'git is not installed' }, async () => {
  const root = project();
  const write = (rel, text) => fs.writeFileSync(path.join(root, rel), text);
  write('.scratch/core/issues/01-first.md', '# First\n\n**PRD:** d-trace\n**Status:** done\n');
  write('.scratch/core/issues/02-second.md', '# Second\n\n**PRD:** d-trace, f-other\n**Status:** ready-for-agent\n');
  write('.scratch/core/issues/03-third.md', '# Third\n\n**PRD:** d-trace\n**Status:** wontfix\n');
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/app.git'], { cwd: root, stdio: 'pipe' });
  const request = async (p) => (p.startsWith('repos/acme/app/issues?') ? [{ number: 9, title: 'Nine', state: 'closed', state_reason: 'completed', labels: [], body: '**PRD:** d-trace\n\nBody' }] : []);
  const srv = await startServer({ root, modules: [buildModule({ githubRequest: request })], port: 0 });
  try {
    const base = `http://127.0.0.1:${srv.port}`;
    const prd = async () => (await (await fetch(`${base}/api/build/prd`)).json()).items;
    const items = await prd();
    assert.deepEqual([items['d-trace'].total, items['d-trace'].done], [3, 2], 'a dropped ticket (wontfix) is not counted');
    assert.deepEqual(items['d-trace'].tickets.map((t) => [t.label, t.done]), [['core 01', true], ['core 02', false], ['#9', true]]);
    assert.deepEqual([items['f-other'].total, items['f-other'].done], [1, 0]);

    write('.scratch/core/issues/04-fourth.md', '# Fourth\n\n**PRD:** f-other\n**Status:** done\n');
    write('.scratch/core/issues/02-second.md', '# Second\n\n**PRD:** d-trace, f-other\n**Status:** done (shipped)\n');
    const later = await prd();
    assert.deepEqual([later['f-other'].total, later['f-other'].done], [2, 2], 'a new ticket and a state change count without a restart');
    assert.deepEqual([later['d-trace'].total, later['d-trace'].done], [3, 3]);
  } finally { await srv.close(); }
});

test('Plan\'s counts read the same ticket files as the Build page: a ticket the page does not read is not counted', async () => {
  const root = project();
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('.scratch/core/issues/01-first.md', '# First\n\n**PRD:** d-trace\n**Status:** done\n');
  write('.scratch/web/ui/issues/01-nested.md', '# Nested area\n\n**PRD:** d-trace\n**Status:** ready-for-agent\n');
  write('.scratch/web/dist/issues/01-built.md', '# A build output, not a ticket\n\n**PRD:** d-trace\n**Status:** ready-for-agent\n');
  const srv = await startServer({ root, modules: [buildModule({ githubRequest: async () => [] })], port: 0 });
  try {
    const items = (await (await fetch(`http://127.0.0.1:${srv.port}/api/build/prd`)).json()).items;
    assert.deepEqual(items['d-trace'].tickets.map((t) => t.path).sort(), ['.scratch/core/issues/01-first.md', '.scratch/web/ui/issues/01-nested.md']);
  } finally { await srv.close(); }
});
