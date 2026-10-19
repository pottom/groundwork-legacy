// The GitHub source on the server (github-source.mjs): the repository's issues, fetched through
// `gh` or the REST API, in the shape the ticket reader takes. The page never talks to GitHub.
// Run: node --test "modules/**/*.test.mjs"

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubRepo, openGitHub } from './github-source.mjs';

// A REST API stand-in: answers by path, and records what was asked.
function fakeApi(routes) {
  const asked = [];
  const request = async (path) => {
    asked.push(path);
    if (!(path in routes)) throw new Error('HTTP 404 ' + path);
    return routes[path];
  };
  return { request, asked };
}
const restIssue = (number, more = {}) => ({
  number, title: `Issue ${number}`, state: 'open', state_reason: null, body: `Body ${number}`,
  labels: [{ name: 'ready-for-agent' }], milestone: { title: '3. Link' },
  created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', closed_at: null,
  html_url: `https://github.com/acme/app/issues/${number}`, repository_url: 'https://api.github.com/repos/acme/app',
  issue_dependencies_summary: { blocked_by: 0, total_blocked_by: 0, blocking: 0, total_blocking: 0 }, ...more,
});
const LIST = (page) => `repos/acme/app/issues?state=all&per_page=100&page=${page}`;

test('the repository comes from a GitHub remote URL, in any of its forms', () => {
  assert.equal(githubRepo('https://github.com/pottom/groundwork.git'), 'pottom/groundwork');
  assert.equal(githubRepo('git@github.com:pottom/groundwork.git'), 'pottom/groundwork');
  assert.equal(githubRepo('ssh://git@github.com/pottom/ground.work'), 'pottom/ground.work');
  assert.equal(githubRepo('https://gitlab.com/pottom/groundwork.git'), null);
  assert.equal(githubRepo(''), null);
});

test('issues: every page, without pull requests, with GitHub\'s blocked-by links', async () => {
  const page1 = Array.from({ length: 100 }, (_, i) => restIssue(i + 1));
  page1[1] = restIssue(2, { issue_dependencies_summary: { blocked_by: 1, total_blocked_by: 2, blocking: 0, total_blocking: 0 } });
  page1[2] = restIssue(3, { pull_request: { url: 'x' } });
  const { request, asked } = fakeApi({
    [LIST(1)]: page1,
    [LIST(2)]: [restIssue(101, { state: 'closed', state_reason: 'not_planned', closed_at: '2026-10-03T00:00:00Z', milestone: null, labels: [] })],
    'repos/acme/app/issues/2/dependencies/blocked_by?per_page=100': [
      restIssue(1), restIssue(7, { repository_url: 'https://api.github.com/repos/acme/other' }),
    ],
  });
  const gh = openGitHub({ repo: 'acme/app', request });
  const answer = await gh.issues();
  assert.equal(answer.available, true);
  assert.equal(answer.repo, 'acme/app');
  assert.equal(answer.issues.length, 100, '99 issues of page 1 and 1 of page 2');
  assert.ok(!answer.issues.some((i) => i.number === 3), 'a pull request is not a ticket');
  assert.deepEqual(answer.issues.find((i) => i.number === 2).blockedBy, [{ number: 1, repo: 'acme/app' }, { number: 7, repo: 'acme/other' }]);
  assert.deepEqual(answer.issues.find((i) => i.number === 101), {
    number: 101, title: 'Issue 101', state: 'closed', stateReason: 'not_planned', labels: [], milestone: null, body: 'Body 101',
    blockedBy: [], createdAt: '2026-10-01T10:00:00Z', closedAt: '2026-10-03T00:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
    url: 'https://github.com/acme/app/issues/101',
  });
  assert.equal(answer.issues.find((i) => i.number === 1).milestone, '3. Link');
  assert.deepEqual(answer.issues.find((i) => i.number === 1).labels, ['ready-for-agent']);
  assert.equal(asked.filter((p) => p.includes('/dependencies/')).length, 1, 'only an issue with blockers is asked about them');
  assert.match(answer.fingerprint, /^[0-9a-f]{16}$/);
});

test('without the dependency summary GitHub\'s links are unknown: null, the body still counts', async () => {
  const { request } = fakeApi({ [LIST(1)]: [restIssue(1, { issue_dependencies_summary: undefined })] });
  const answer = await openGitHub({ repo: 'acme/app', request }).issues();
  assert.equal(answer.issues[0].blockedBy, null);
});

test('answers are kept for a while: polling does not reach GitHub each time', async () => {
  let now = 0;
  const { request, asked } = fakeApi({ [LIST(1)]: [restIssue(1)] });
  const gh = openGitHub({ repo: 'acme/app', request, ttlMs: 1000, now: () => now });
  const first = await gh.issues();
  await gh.issues();
  assert.equal(asked.length, 1);
  now = 5000;
  assert.deepEqual(await gh.issues(), first, 'a stale answer is served while a fresh one comes');
  await gh.settled();
  assert.equal(asked.length, 2);
});

test('a fresh read asks GitHub at once, kept answer or not: the live re-check sees a change within one interval', async () => {
  let now = 0;
  let title = 'Before';
  const asked = [];
  const request = async (path) => { asked.push(path); return [restIssue(1, { title })]; };
  const gh = openGitHub({ repo: 'acme/app', request, ttlMs: 60000, now: () => now });
  assert.equal((await gh.issues()).issues[0].title, 'Before');
  title = 'After';
  now = 1000;
  assert.equal((await gh.issues()).issues[0].title, 'Before', 'within the time an answer is kept, a plain read is served from it');
  assert.equal((await gh.issues({ fresh: true })).issues[0].title, 'After');
  assert.equal(asked.length, 2);
  assert.equal((await gh.issues()).issues[0].title, 'After', 'the fresh answer is the one kept');
  assert.equal(asked.length, 2);
});

test('a failure is told, without what the request carried; the last good answer stays', async () => {
  let fail = false;
  const request = async (path) => {
    if (fail) throw new Error('HTTP 401 Bad credentials\nAuthorization: Bearer ghp_secret');
    return path === LIST(1) ? [restIssue(1)] : [];
  };
  let now = 0;
  const gh = openGitHub({ repo: 'acme/app', request, ttlMs: 10, now: () => now });
  const ok = await gh.issues();
  fail = true;
  now = 100;
  await gh.issues();
  await gh.settled();
  const after = await gh.issues();
  assert.deepEqual(after.issues, ok.issues);
  assert.equal(after.error, 'HTTP 401 Bad credentials');
  const cold = await openGitHub({ repo: 'acme/app', request }).issues();
  assert.equal(cold.available, false);
  assert.doesNotMatch(JSON.stringify(cold), /ghp_secret/);
});

test('no repository: not available, nothing asked', async () => {
  const { request, asked } = fakeApi({});
  assert.deepEqual(await openGitHub({ repo: null, request }).issues(), { available: false, reason: 'no-repo' });
  assert.equal(asked.length, 0);
});
