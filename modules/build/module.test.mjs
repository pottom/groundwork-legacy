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
import { listen } from '../../core/sse-client.test-helper.mjs';
import { pageModules, pageSource, readBuild } from './page-files.test-helper.mjs';

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

// With git out of reach (no PATH), only an answer that needs no git process can come back.
async function withoutGit(fn) {
  const saved = process.env.PATH;
  process.env.PATH = '';
  try { return await fn(); } finally { process.env.PATH = saved; }
}

for (const where of ['a repository', 'a linked worktree']) {
  test(`in ${where}, "nothing moved" is answered without running git, and a new commit is seen`, { skip: !hasGit && 'git is not installed' }, async () => {
    const repo = project();
    const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'pipe' });
    git(repo, 'init', '-q', '-b', 'main');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'First commit');
    let root = repo;
    if (where === 'a linked worktree') {
      root = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gw-wt-')), 'wt');
      git(repo, 'worktree', 'add', '-q', '-b', 'side', root);
    }
    await withServer(root, async (base) => {
      const g = await (await fetch(`${base}/api/build/git?limit=10`)).json();
      assert.equal(g.available, true);
      const again = await withoutGit(async () => (await fetch(`${base}/api/build/git?limit=10&known=${g.fingerprint}`)).json());
      assert.deepEqual(again, { server: 'development-status', api: 1, available: true, unchanged: true, fingerprint: g.fingerprint });
      git(root, 'commit', '-q', '--allow-empty', '-m', 'Second commit');
      const moved = await (await fetch(`${base}/api/build/git?limit=10&known=${g.fingerprint}`)).json();
      assert.notEqual(moved.unchanged, true);
      assert.equal(moved.commits[0].subject, 'Second commit');
      git(root, 'tag', 'v1');
      const tagged = await (await fetch(`${base}/api/build/git?limit=10&known=${moved.fingerprint}`)).json();
      assert.deepEqual(tagged.refs.filter((r) => r.kind === 'tag').map((r) => r.name), ['v1']);
    });
  });
}

test('while a page listens the list is kept between changes, and still follows each of them', async () => {
  const root = project();
  const srv = await startServer({ root, modules: [buildModule()], port: 0 });
  const sse = listen(srv.port);
  try {
    const base = `http://127.0.0.1:${srv.port}`;
    const list = async () => (await fetch(`${base}/api/build/list`)).json();
    await sse.next((e) => e.event === 'hello');
    const first = await list();
    assert.deepEqual(await list(), first);
    fs.writeFileSync(path.join(root, '.scratch/core/issues/02-second.md'), '# Second\n');
    await sse.change('build.files');
    assert.ok((await list()).files.some((f) => f.path === '.scratch/core/issues/02-second.md'));
    const others = (await list()).dirs['.scratch/core'];
    fs.writeFileSync(path.join(root, '.scratch/core/more.txt'), 'not markdown, no topic');
    const deadline = Date.now() + 3000;
    let now;
    while ((now = (await list()).dirs['.scratch/core']) === others && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    assert.equal(now, others + 1);
  } finally { sse.close(); await srv.close(); }
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

test('the page reads tickets with the ticket reader, an ES module it shares with the server', async () => {
  await withServer(project(), async (base) => {
    const reader = await fetch(`${base}/build/ticket-reader.mjs`);
    assert.equal(reader.status, 200);
    assert.match(await reader.text(), /^export /m);
    assert.match(PAGE, /from '\.\.\/ticket-reader\.mjs'/);
    assert.doesNotMatch(PAGE, /GroundworkTickets/, 'no global left');
    assert.match(PAGE, /readTickets\(\{/);
    assert.doesNotMatch(PAGE, /function parseTicket|function buildModel/, 'no copy of the reader left in the page');
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
const PAGE = pageSource();
const STYLES = readBuild('build.css');
const usedShellVariables = (page) => new Set([...page.matchAll(/var\((--gw-[\w-]+)/g)].map((m) => m[1]));

test('the view links the shell theme and uses its variables', async () => {
  await withServer(project(), async (base) => {
    const page = await (await fetch(`${base}/build/`)).text() + await (await fetch(`${base}/build/build.css`)).text();
    assert.match(page, /<link rel="stylesheet" href="\/shell\/theme\.css">/);
    const theme = await (await fetch(`${base}/shell/theme.css`)).text();
    const used = usedShellVariables(page);
    for (const v of ['--gw-bg', '--gw-fg', '--gw-accent', '--gw-line', '--gw-font', '--gw-ok', '--gw-bad-text']) assert.ok(used.has(v), `uses ${v}`);
    for (const v of used) assert.match(theme, new RegExp(`${v}:`), `${v} is a shell variable`);
    // The old local palette is gone: a shared colour has one name.
    for (const old of ['--ink', '--ink-2', '--bg', '--surface', '--sunken', '--line', '--line-strong', '--accent', '--focus', '--shadow', '--radius', '--sans', '--mono']) {
      assert.doesNotMatch(page, new RegExp(`var\\(${old}[,)]`), `still uses ${old}`);
    }
  });
});

test('Build needs the server: no copy of the theme, no file:// mode, no folder picked in the browser', () => {
  assert.doesNotMatch(STYLES, /:where\(:root\)|--gw-bg\s*:/, 'no fallback copy of the theme tokens');
  assert.doesNotMatch(PAGE, /protocol|file:\/\/|document\.write|showDirectoryPicker|webkitdirectory|getAsFileSystemHandle|webkitGetAsEntry|indexedDB|POLL_MS|setInterval/);
  for (const gone of ['page.bundle.js', 'file-bundle.mjs', 'i18n.js', 'ticket-reader.js', 'ui-strings.js']) {
    assert.ok(!fs.existsSync(path.join(build.view.dir, gone)), `${gone} is gone`);
  }
});

test('light or dark follows the shell\'s switch (/shell/theme.js): the view has no switch of its own', () => {
  assert.doesNotMatch(PAGE, /setAttribute\(\s*'data-theme'|dataset\.theme\s*=|groundworkTheme\.set\(|groundwork:theme/);
  assert.match(PAGE, /<script src="\/shell\/theme\.js"><\/script>/);
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

test('the Ideas module\'s ticket list: per idea, the tickets naming it on their Idea line, with their number and state', async () => {
  const root = project();
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  write('.scratch/core/issues/01-first.md', '# First\n\n**Idea:** I-12\n**Status:** done\n');
  write('.scratch/core/issues/02-second.md', '# Second\n\n**Idea:** I-12, I-3\n**Status:** wontfix\n');
  write('.scratch/core/issues/03-third.md', '# Third\n\n**Status:** ready-for-agent\n');
  const srv = await startServer({ root, modules: [buildModule({ githubRequest: async () => [] })], port: 0 });
  try {
    const items = (await (await fetch(`http://127.0.0.1:${srv.port}/api/build/ideas`)).json()).items;
    assert.deepEqual(Object.keys(items).sort(), ['I-12', 'I-3']);
    assert.deepEqual(items['I-12'].map((t) => [t.label, t.title, t.status, t.closed]), [['core 01', 'First', 'done', true], ['core 02', 'Second', 'wontfix', true]]);
    assert.deepEqual(items['I-3'].map((t) => [t.label, t.status, t.closed]), [['core 02', 'wontfix', true]]);
    write('.scratch/core/issues/03-third.md', '# Third\n\n**Idea:** I-3\n**Status:** ready-for-agent\n');
    const later = (await (await fetch(`http://127.0.0.1:${srv.port}/api/build/ideas`)).json()).items;
    assert.deepEqual(later['I-3'].map((t) => [t.label, t.status, t.closed]), [['core 02', 'wontfix', true], ['core 03', 'ready-for-agent', false]], 'a new ticket shows without a restart');
  } finally { await srv.close(); }
});

test('a ticket\'s ideas link to the Ideas module in the whole window, beside its PRD items', () => {
  const parts = readBuild('page/parts.mjs');
  assert.match(parts, /export const ideaLinks = /);
  assert.match(parts, /\/\?module=ideas&idea=/);
  assert.match(readBuild('page/views/tickets.mjs'), /ideaLinks\(t\)/);
  assert.match(readBuild('page/views/drawer.mjs'), /ideaLinks\(t\)/);
});

test('the view follows the shell\'s one stream (subscribe from /shell/live.mjs) and asks Plan only for the map ids', () => {
  assert.doesNotMatch(PAGE, /new EventSource/);
  assert.match(PAGE, /import \{ subscribe \} from '\/shell\/live\.mjs'/);
  assert.match(PAGE, /subscribe\(\{/);
  assert.match(PAGE, /'\/api\/plan\/ids'/);
  assert.doesNotMatch(PAGE, /'\/api\/plan\/map/);
});

// ───────── The page's files ─────────

test('index.html is a thin skeleton: no inline script or style, the theme, the styles and the entry module', () => {
  const page = readBuild('index.html');
  assert.doesNotMatch(page, /<style/);
  assert.deepEqual([...page.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1].trim()), ['src="/shell/theme.js"', 'type="module" src="page/main.mjs"']);
  assert.match(page, /<link rel="stylesheet" href="\/shell\/theme\.css">/);
  assert.match(page, /<link rel="stylesheet" href="build\.css">/);
});

test('no file of the page is a giant: each stays under about 400 lines', () => {
  for (const f of ['index.html', 'build.css', ...pageModules()]) {
    const lines = readBuild(f).split('\n').length;
    assert.ok(lines <= 420, `${f}: ${lines} lines`);
  }
});

test('the views render through lit-html templates: no HTML strings into innerHTML', () => {
  for (const f of pageModules()) assert.doesNotMatch(readBuild(f), /\.innerHTML\s*=|insertAdjacentHTML|outerHTML\s*=/, f);
  // The one exception: the Markdown renderer's output, escaped piece by piece, shown in the drawer.
  const unsafe = pageModules().filter((f) => /unsafeHTML\(/.test(readBuild(f)));
  assert.deepEqual(unsafe, ['page/views/drawer.mjs']);
  // One escaping function, the Markdown renderer's.
  assert.deepEqual(pageModules().filter((f) => /const esc\b/.test(readBuild(f))), ['page/markdown.mjs']);
});

test('every file of the page is served under /build/, and only those', async () => {
  for (const f of pageModules()) assert.ok(build.view.files.includes(f), `${f} is in view.files`);
  for (const f of build.view.files) assert.ok(fs.existsSync(path.join(build.view.dir, f)), `${f} exists`);
  await withServer(project(), async (base) => {
    for (const f of ['page/main.mjs', 'page/views/git.mjs', 'build.css', 'ticket-reader.mjs', 'ui-strings.mjs']) {
      const res = await fetch(`${base}/build/${f}`);
      assert.equal(res.status, 200, f);
      assert.match(res.headers.get('content-type'), f.endsWith('.css') ? /text\/css/ : /text\/javascript/);
    }
    assert.equal((await fetch(`${base}/build/module.mjs`)).status, 404, 'the server side is not part of the page');
  });
});
