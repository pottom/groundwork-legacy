// The ticket reader (ticket-reader.mjs): from a ticket source, the ticket model every Build view
// draws. Two sources stand behind its one entry point: the project's Markdown files (.scratch/)
// and the GitHub issues the server fetched. An ES module, shared by the page and the server.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as reader from './ticket-reader.mjs';

const { readTickets, waitingOn } = reader;

// The local source: markdown texts by path, as the page reads them.
const local = (files, more = {}) => ({
  name: 'demo',
  files: { entries: new Map(Object.entries(files).map(([p, text]) => [p, { text }])), others: [], trackerPath: '.scratch', adrPath: null, ...more },
});
// The GitHub source: issues as the server's /api/build/issues sends them.
const issue = (number, fields = {}) => ({
  number, title: `Issue ${number}`, state: 'open', stateReason: null, labels: [], milestone: null, body: '',
  blockedBy: [], createdAt: '2026-10-01T10:00:00Z', closedAt: null, updatedAt: '2026-10-02T10:00:00Z',
  url: `https://github.com/acme/app/issues/${number}`, ...fields,
});
const github = (issues, more = {}) => ({ name: 'app', github: { repo: 'acme/app', issues } , ...more });

const byLabel = (m, label) => m.tickets.find((t) => t.label === label);
const blockerLabels = (t) => t.blockers.map((b) => (b.ticket ? b.ticket.label : b.raw + '?'));
const kinds = (m) => m.problems.map((p) => p.kind).sort();

test('local tickets: the state comes from the Status line, in either form', () => {
  const m = readTickets(local({
    '.scratch/core/issues/01-first.md': '# First\n\n**Status:** ready-for-agent\n',
    '.scratch/core/issues/02-second.md': '# Second\n\n## Status\n\ndone (shipped)\n',
    '.scratch/core/issues/03-third.md': '# Third\n\nNo status here.\n',
  }));
  assert.deepEqual(m.tickets.map((t) => [t.label, t.status]), [['core 01', 'ready-for-agent'], ['core 02', 'done'], ['core 03', '?']]);
  assert.equal(byLabel(m, 'core 02').statusNote, 'shipped');
  assert.deepEqual(kinds(m), ['no-status']);
  assert.equal(m.problems[0].key, 'problem.no-status.text');
});

test('local tickets: every form of "Blocked by", across areas', () => {
  const m = readTickets(local({
    '.scratch/core/issues/01-store.md': '# Store the label\n\nStatus: done\n',
    '.scratch/core/issues/02-show.md': '# Show it\n\nStatus: ready-for-agent\nBlocked by: 01\n',
    '.scratch/core/issues/03-list.md': '# List\n\nStatus: ready-for-agent\n\n## Blocked by\n\n- core 02\n- ui 1\n',
    '.scratch/core/issues/04-name.md': '# By name\n\nStatus: needs-triage\nBlocked by: Store the label\n',
    '.scratch/core/issues/05-none.md': '# Free\n\nStatus: needs-info\nBlocked by: none\n',
    '.scratch/core/issues/06-ghost.md': '# Ghost\n\nStatus: ready-for-human\nBlocked by: core 9\n',
    '.scratch/ui/issues/01-page.md': '# Page\n\nStatus: claimed\nBlocked by: [core 01](../core/issues/01-store.md)\n',
  }));
  assert.deepEqual(blockerLabels(byLabel(m, 'core 02')), ['core 01']);
  assert.deepEqual(blockerLabels(byLabel(m, 'core 03')), ['core 02', 'ui 01']);
  assert.deepEqual(blockerLabels(byLabel(m, 'core 04')), ['core 01']);
  assert.deepEqual(blockerLabels(byLabel(m, 'core 05')), []);
  assert.deepEqual(blockerLabels(byLabel(m, 'core 06')), ['core 9?']);
  assert.deepEqual(blockerLabels(byLabel(m, 'ui 01')), ['core 01']);
  assert.equal(byLabel(m, 'core 03').blocked, true, 'core 02 is still open');
  assert.equal(byLabel(m, 'core 02').blocked, false, 'core 01 is done');
  assert.deepEqual(byLabel(m, 'core 01').dependents.map((t) => t.label).sort(), ['core 02', 'core 04', 'ui 01']);
  assert.deepEqual(kinds(m), ['missing-blocker', 'released', 'released', 'released']);
  assert.ok(m.areaRef.test('see core 3'), 'a local area names tickets in the text');
});

test('GitHub issues: closed is closed or wontfix; open takes its state label', () => {
  const m = readTickets(github([
    issue(1, { state: 'closed', stateReason: 'completed', closedAt: '2026-10-05T08:00:00Z' }),
    issue(2, { state: 'closed', stateReason: 'not_planned' }),
    issue(3, { labels: ['bug', 'ready-for-agent'] }),
    issue(4, { labels: ['needs-triage'] }),
    issue(5, { labels: ['enhancement'] }),
  ]));
  assert.deepEqual(m.tickets.map((t) => [t.label, t.status]), [['#1', 'closed'], ['#2', 'wontfix'], ['#3', 'ready-for-agent'], ['#4', 'needs-triage'], ['#5', 'needs-triage']]);
  assert.deepEqual(m.open.map((t) => t.label), ['#3', '#4', '#5']);
  assert.deepEqual(byLabel(m, '#3').labels, ['bug', 'ready-for-agent']);
  assert.equal(byLabel(m, '#3').url, 'https://github.com/acme/app/issues/3');
  assert.deepEqual(byLabel(m, '#1').comments.map((c) => [c.date, c.event]), [['2026-10-01', 'opened'], ['2026-10-05', 'closed']]);
  assert.deepEqual(kinds(m), [], 'an issue always has a state');
});

test('GitHub issues: the milestone is the area', () => {
  const m = readTickets(github([issue(1, { milestone: '1. Start' }), issue(2, { milestone: '1. Start', state: 'closed' }), issue(3)]));
  assert.deepEqual(m.areaList.map((a) => [a.name, a.open, a.closed]), [['', 1, 0], ['1. Start', 1, 1]]);
  assert.equal(byLabel(m, '#1').milestone, '1. Start');
  assert.equal(m.areaRef, null, 'a milestone does not name tickets as "<area> <n>"');
});

test('what an open ticket waits on: one bucket each, blocked before its status, the counts sum to the open tickets', () => {
  const m = readTickets(local({
    '.scratch/core/issues/01-base.md': '# Base\n\nStatus: claimed\n',
    '.scratch/core/issues/02-free.md': '# Free agent\n\nStatus: ready-for-agent\n',
    '.scratch/core/issues/03-wait.md': '# Blocked agent\n\nStatus: ready-for-agent\nBlocked by: 01\n',
    '.scratch/core/issues/04-ask.md': '# Free human\n\nStatus: needs-info\n',
    '.scratch/core/issues/05-ask.md': '# Blocked human\n\nStatus: ready-for-human\nBlocked by: 01\n',
    '.scratch/core/issues/06-test.md': '# Test\n\nStatus: needs-browser-test\n',
    '.scratch/core/issues/07-odd.md': '# Odd\n\nStatus: parked\n',
    '.scratch/core/issues/08-done.md': '# Done\n\nStatus: done\nBlocked by: 01\n',
  }));
  const on = (label) => waitingOn(byLabel(m, label));
  assert.deepEqual(['core 01', 'core 02', 'core 03', 'core 04', 'core 05', 'core 06', 'core 07', 'core 08'].map(on),
    ['claimed', 'agent', 'blocked', 'human', 'blocked', 'test', 'other', 'closed']);
  assert.deepEqual({ ...m.waiting }, { agent: 1, human: 1, blocked: 2, test: 1, claimed: 1, other: 1, unparsed: 0 });
  assert.equal(Object.values(m.waiting).reduce((a, b) => a + b, 0), m.open.length);
});

test('GitHub issues: blocked by GitHub\'s links, a "## Blocked by" section or a "Blocked by:" line', () => {
  const m = readTickets(github([
    issue(1, { state: 'closed' }),
    issue(2),
    issue(3, { blockedBy: [{ number: 1, repo: 'acme/app' }, { number: 2, repo: 'acme/app' }] }),
    issue(4, { body: '## What to build\n\nIt.\n\n## Blocked by\n\n- #2\n- #3\n' }),
    issue(5, { body: 'Blocked by: #1, #9\n', blockedBy: [{ number: 1, repo: 'acme/app' }] }),
    issue(6, { blockedBy: [{ number: 7, repo: 'acme/other' }] }),
    issue(7, { body: '## Blocked by\n\nNone - can start immediately\n' }),
  ]));
  assert.deepEqual(blockerLabels(byLabel(m, '#3')), ['#1', '#2']);
  assert.deepEqual(blockerLabels(byLabel(m, '#4')), ['#2', '#3']);
  assert.deepEqual(blockerLabels(byLabel(m, '#5')), ['#1', '#9?'], 'each blocker once');
  assert.deepEqual(byLabel(m, '#6').blockers, [], 'another repository\'s issue is a note');
  assert.deepEqual(byLabel(m, '#6').notes, ['acme/other#7']);
  assert.deepEqual(blockerLabels(byLabel(m, '#7')), []);
  assert.equal(byLabel(m, '#3').blocked, true);
  assert.deepEqual(byLabel(m, '#2').dependents.map((t) => t.label), ['#3', '#4']);
  assert.deepEqual(m.problems.filter((p) => p.kind === 'missing-blocker').map((p) => [p.tickets[0].label, p.params.list]), [['#5', '#9']]);
});

test('both sources at once: local tickets and issues name each other', () => {
  const m = readTickets({
    ...local({ '.scratch/core/issues/01-local.md': '# Local\n\nStatus: ready-for-agent\nBlocked by: #2\n', 'README.md': '# Demo\n' }),
    github: { repo: 'acme/app', issues: [issue(2, { body: '## Blocked by\n\n- core 01\n' })] },
  });
  assert.deepEqual(blockerLabels(byLabel(m, 'core 01')), ['#2']);
  assert.deepEqual(blockerLabels(byLabel(m, '#2')), ['core 01']);
  assert.equal(m.projectName, 'Demo');
  assert.equal(m.byPath.get('acme/app#2').label, '#2');
  assert.equal(m.resolveIssue(2).source, 'github');
});

test('the PRD line names the PRD items a ticket came from, in both sources', () => {
  const m = readTickets({
    ...local({
      '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n**PRD:** f-build-trace, d-trace\n',
      '.scratch/core/issues/02-two.md': '# Two\n\nStatus: ready-for-agent\n- PRD: `x-own-tickets`\n',
      '.scratch/core/issues/03-three.md': '# Three\n\nStatus: ready-for-agent\n',
    }),
    github: { repo: 'acme/app', issues: [
      issue(4, { body: '**PRD:** f-build-trace\n\n## What to build\n\nIt.\n' }),
      issue(5, { body: 'PRD: d-trace; d-trace-how, and f-plan-trace\n' }),
      issue(6, { body: '## What to build\n\nSee the **PRD:** nothing here.\n' }),
    ] },
  });
  assert.deepEqual(byLabel(m, 'core 01').prd, ['f-build-trace', 'd-trace']);
  assert.deepEqual(byLabel(m, 'core 02').prd, ['x-own-tickets']);
  assert.deepEqual(byLabel(m, 'core 03').prd, []);
  assert.deepEqual(byLabel(m, '#4').prd, ['f-build-trace']);
  assert.deepEqual(byLabel(m, '#5').prd, ['d-trace', 'd-trace-how', 'f-plan-trace']);
  assert.deepEqual(byLabel(m, '#6').prd, [], 'only a PRD line of its own counts');
  assert.deepEqual(m.byPrd.get('f-build-trace').map((t) => t.label), ['core 01', '#4']);
  assert.deepEqual(m.byPrd.get('d-trace').map((t) => t.label), ['core 01', '#5']);
});

test('the Sketch line names the sketches a ticket links to, in both sources', () => {
  const m = readTickets({
    ...local({
      '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n**Sketch:** checkout-flow, `main`\n',
      '.scratch/core/issues/02-two.md': '# Two\n\nStatus: ready-for-agent\n- Sketch: [flow](/?module=sketch&sketch=flow) (the payment part)\n',
      '.scratch/core/issues/03-three.md': '# Three\n\nStatus: ready-for-agent\n',
    }),
    github: { repo: 'acme/app', issues: [issue(4, { body: '**Sketch:** arch_v2\n\n## What to build\n\nIt.\n' })] },
  });
  assert.deepEqual(byLabel(m, 'core 01').sketches, ['checkout-flow', 'main']);
  assert.deepEqual(byLabel(m, 'core 02').sketches, ['flow'], 'a remark in parentheses is not a sketch');
  assert.deepEqual(byLabel(m, 'core 03').sketches, []);
  assert.deepEqual(byLabel(m, '#4').sketches, ['arch_v2']);
  assert.equal(reader.sketchLink('checkout-flow'), '/?module=sketch&sketch=checkout-flow');
});

test('a ticket a link names (?ticket=): an issue number, an area and number, or its path', () => {
  const m = readTickets({
    ...local({ '.scratch/core/issues/03-three.md': '# Three\n\nStatus: ready-for-agent\n' }),
    github: { repo: 'acme/app', issues: [issue(34)] },
  });
  const find = (ref) => reader.findTicket(m, ref)?.label ?? null;
  assert.equal(find('#34'), '#34');
  assert.equal(find('core 3'), 'core 03');
  assert.equal(find('core  03'), 'core 03');
  assert.equal(find('.scratch/core/issues/03-three.md'), 'core 03');
  assert.equal(find('#99'), null);
  assert.equal(find(''), null);
  assert.equal(reader.ticketFilter('?ticket=%2334'), '#34');
});

// The ids of the PRD map (Plan's docs/product/mindmap.json), when the page could read the map.
const withMap = (src, ids) => ({ ...src, mapIds: ids });
const prdProblems = (m) => m.problems.filter((p) => /prd/.test(p.kind)).map((p) => [p.kind, p.tickets.map((t) => t.label).join(' '), p.key, p.params])
  .sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));

test('a ticket naming an id that is not on the PRD map is an inconsistency', () => {
  const m = readTickets(withMap({
    ...local({ '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n**PRD:** f-known, f-gone\n' }),
    github: { repo: 'acme/app', issues: [issue(2, { body: '**PRD:** f-known\n' }), issue(3, { body: '**PRD:** d-old, d-older\n', state: 'closed' })] },
  }, ['root', 'f-known']));
  assert.deepEqual(prdProblems(m), [
    ['unknown-prd', '#3', 'problem.unknown-prd.text', { list: 'd-old, d-older' }],
    ['unknown-prd', 'core 01', 'problem.unknown-prd.text', { list: 'f-gone' }],
  ]);
});

test('an open ticket without a PRD line is an inconsistency; a closed one is history', () => {
  const m = readTickets(withMap({
    ...local({ '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n' }),
    github: { repo: 'acme/app', issues: [issue(2, { body: '**PRD:** f-known\n' }), issue(3), issue(4, { state: 'closed' })] },
  }, ['f-known']));
  assert.deepEqual(prdProblems(m), [
    ['no-prd', '#3', 'problem.no-prd.text', {}],
    ['no-prd', 'core 01', 'problem.no-prd.text', {}],
  ]);
});

test('without the PRD map no id is unknown, and a missing PRD line counts only once the project uses them', () => {
  const none = readTickets(local({ '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n' }));
  assert.deepEqual(prdProblems(none), [], 'a project that does not link tickets to a PRD');
  const some = readTickets(local({
    '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n',
    '.scratch/core/issues/02-two.md': '# Two\n\nStatus: ready-for-agent\n**PRD:** f-anything\n',
  }));
  assert.deepEqual(prdProblems(some), [['no-prd', 'core 01', 'problem.no-prd.text', {}]]);
});

test('a PRD line of a dash, "none" or only a remark says "deliberately no PRD": no ids, no missing PRD', () => {
  const m = readTickets(withMap(local({
    '.scratch/core/issues/01-one.md': '# One\n\nStatus: ready-for-agent\n**PRD:** — (no decision yet; the look was chosen from a prototype)\n',
    '.scratch/core/issues/02-two.md': '# Two\n\nStatus: ready-for-agent\n**PRD:** —\n',
    '.scratch/core/issues/03-three.md': '# Three\n\nStatus: ready-for-agent\n**PRD:** none\n',
    '.scratch/core/issues/04-four.md': '# Four\n\nStatus: ready-for-agent\nPRD: nincs (még)\n',
    '.scratch/core/issues/05-five.md': '# Five\n\nStatus: ready-for-agent\n**PRD:** n/a\n',
    '.scratch/core/issues/06-six.md': '# Six\n\nStatus: ready-for-agent\n**PRD:** (to be grilled first)\n',
    '.scratch/core/issues/07-seven.md': '# Seven\n\nStatus: ready-for-agent\n**PRD:** f-known (the shell part only), d-trace\n',
    '.scratch/core/issues/08-eight.md': '# Eight\n\nStatus: ready-for-agent\n**PRD:** f-known needs a grilling session first\n',
  }), ['f-known', 'd-trace']));
  for (const label of ['core 01', 'core 02', 'core 03', 'core 04', 'core 05', 'core 06']) {
    assert.deepEqual(byLabel(m, label).prd, [], label);
    assert.equal(byLabel(m, label).prdNone, true, label);
  }
  assert.deepEqual(byLabel(m, 'core 07').prd, ['f-known', 'd-trace']);
  assert.deepEqual(byLabel(m, 'core 08').prd, ['f-known'], 'plain words are not ids');
  assert.equal(byLabel(m, 'core 07').prdNone, false);
  assert.deepEqual(prdProblems(m), []);
});

test('a GitHub issue without a state label is waiting to be triaged', () => {
  const m = readTickets(github([issue(1), issue(2, { labels: ['bug'] })]));
  assert.deepEqual(m.tickets.map((t) => t.status), ['needs-triage', 'needs-triage']);
});

// ───────── Where the tickets are: one rule for the page and the server ─────────

const { locateProject, ticketPath, keepsFolder, DONE, DROPPED, CLOSED, isDone, isDropped } = reader;

test('the tracker: .scratch when its areas hold issues, else the root, else the first such folder within three levels', () => {
  assert.equal(locateProject(['', '.scratch', '.scratch/core', '.scratch/core/issues', 'work', 'work/core', 'work/core/issues']).trackerPath, '.scratch');
  assert.equal(locateProject(['', 'core', 'core/issues', 'src']).trackerPath, '');
  assert.equal(locateProject(['', 'build', 'build/issues']).trackerPath, '', 'an area may be called "build"');
  assert.equal(locateProject(['', 'a', 'a/b', 'a/b/tickets', 'a/b/tickets/core', 'a/b/tickets/core/issues']).trackerPath, 'a/b/tickets');
  assert.equal(locateProject(['', 'a', 'a/b', 'a/b/c', 'a/b/c/d', 'a/b/c/d/core', 'a/b/c/d/core/issues']).trackerPath, null, 'deeper than three levels');
  assert.equal(locateProject(['', 'dist', 'dist/t', 'dist/t/core', 'dist/t/core/issues']).trackerPath, null, 'not inside a skipped folder');
  assert.equal(locateProject(['', '.scratch', 'docs']).trackerPath, '.scratch', '.scratch anyway when it exists');
  assert.equal(locateProject(['']).trackerPath, null);
});

test('the ADR folder: the first of the known places that exists', () => {
  assert.equal(locateProject(['', 'docs', 'docs/adr', 'adr']).adrPath, 'docs/adr');
  assert.equal(locateProject(['', 'docs', 'docs/decisions']).adrPath, 'docs/decisions');
  assert.equal(locateProject(['', 'docs']).adrPath, null);
});

test('a ticket file: <tracker>/<area>/issues/<name>.md, the area any folders not skipped', () => {
  assert.deepEqual(ticketPath('.scratch/core/issues/01-first.md', '.scratch'), { area: 'core', name: '01-first' });
  assert.deepEqual(ticketPath('.scratch/build/issues/02.markdown', '.scratch'), { area: 'build', name: '02' }, 'a top area may have a skipped name');
  assert.deepEqual(ticketPath('.scratch/web/ui/issues/03.md', '.scratch'), { area: 'web/ui', name: '03' });
  assert.deepEqual(ticketPath('core/issues/01.md', ''), { area: 'core', name: '01' });
  assert.equal(ticketPath('.scratch/web/dist/issues/03.md', '.scratch'), null, 'below an area, skipped folders are not read');
  assert.equal(ticketPath('.scratch/node_modules/issues/01.md', '.scratch'), null);
  assert.equal(ticketPath('.scratch/core/spec.md', '.scratch'), null);
  assert.equal(ticketPath('.scratch/issues/01.md', '.scratch'), null, 'an issues folder needs an area');
  assert.equal(ticketPath('other/core/issues/01.md', '.scratch'), null);
  assert.equal(ticketPath('.scratch/core/issues/01.md', null), null);
  assert.equal(ticketPath('.scratch/a/b/c/d/e/f/g/h/issues/01.md', '.scratch'), null, 'deeper than the page walks');
});

test('the folders walked are the folders a ticket may be in', () => {
  assert.equal(keepsFolder('build', 0), true);
  assert.equal(keepsFolder('build', 1), false);
  assert.equal(keepsFolder('build', 0, true), false, 'the ADR folder skips them from the top');
  assert.equal(keepsFolder('.git', 0), false);
  assert.equal(keepsFolder('core', 7), true);
  assert.equal(keepsFolder('core', 8), false);
});

test('a file outside the tracker\'s rule is not a ticket, whoever passes it', () => {
  const m = readTickets(local({ '.scratch/web/dist/issues/03.md': '# Hidden\n\n**Status:** ready-for-agent\n', '.scratch/core/issues/01.md': '# One\n\n**Status:** done\n' }));
  assert.deepEqual(m.tickets.map((t) => t.label), ['core 01']);
});

test('done and dropped: one definition, closed is either', () => {
  assert.deepEqual([...DONE].sort(), ['closed', 'done', 'resolved']);
  assert.deepEqual([...DROPPED].sort(), ['legacy', 'wontfix']);
  assert.deepEqual([...CLOSED].sort(), ['closed', 'done', 'legacy', 'resolved', 'wontfix']);
  assert.equal(isDone({ status: 'resolved' }), true);
  assert.equal(isDropped({ status: 'wontfix' }), true);
  assert.equal(isDone({ status: 'wontfix' }), false);
});
