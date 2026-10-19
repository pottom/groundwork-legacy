// The ticket reader (ticket-reader.js): from a ticket source, the ticket model every Build view
// draws. Two sources stand behind its one entry point: the project's Markdown files (.scratch/)
// and the GitHub issues the server fetched. It is a classic script (the page works from file://),
// which under Node defines globalThis.GroundworkTickets once imported.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import './ticket-reader.js';

const { readTickets } = globalThis.GroundworkTickets;

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
  assert.deepEqual(m.tickets.map((t) => [t.label, t.status]), [['#1', 'closed'], ['#2', 'wontfix'], ['#3', 'ready-for-agent'], ['#4', 'needs-triage'], ['#5', 'open']]);
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
