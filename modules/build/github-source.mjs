// github-source.mjs: the project's GitHub issues, read on the server for the Build page.
//
//   const gh = openGitHub({ repo: 'owner/name', request? , ttlMs?, now? });
//   await gh.issues()   { available: true, repo, issues, fingerprint, error? }
//                       or { available: false, reason: 'no-repo' | 'error', error? }
//   githubRepo(url)     'owner/name' from a GitHub remote URL, else null
//   defaultRequest()    how GitHub is asked: `gh api` when the gh CLI is installed (its own
//                       login, or GH_TOKEN / GITHUB_TOKEN), else the REST API with GITHUB_TOKEN
//                       (or GH_TOKEN), else the REST API without a token (public repositories,
//                       60 requests an hour)
//
// An issue as it goes to the page (the ticket reader's GitHub source):
//   { number, title, state, stateReason, labels: [name], milestone: title | null, body,
//     blockedBy: [{ number, repo }] | null, createdAt, closedAt, updatedAt, url }
// blockedBy is GitHub's own dependency links (GET /repos/{o}/{r}/issues/{n}/dependencies/blocked_by),
// asked only for an issue whose issue_dependencies_summary counts a blocker; null when GitHub
// does not tell (no summary). Pull requests are left out.
//
// The token never leaves the server: the page gets the issues only, and an error is cut to its
// first line with anything token-like removed. Answers are kept for ttlMs; a stale one is served
// at once while a fresh one is fetched, so the page's polling does not reach GitHub each time.

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';

const PER_PAGE = 100;
const MAX_PAGES = 30;
const TTL_MS = 60000;
const API = 'https://api.github.com/';

export function githubRepo(url) {
  const m = /^(?:https?:\/\/|ssh:\/\/)?(?:[^@/]+@)?github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(String(url || '').trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

const TOKENISH = /\b(gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g;
const tell = (error) => String((error && error.message) || error).split('\n')[0].replace(TOKENISH, '…').slice(0, 300);

const repoOf = (apiUrl) => (/\/repos\/([^/]+\/[^/]+)$/.exec(apiUrl || '') || [])[1] || null;

function toIssue(raw, blockedBy) {
  return {
    number: raw.number,
    title: raw.title || '',
    state: raw.state === 'closed' ? 'closed' : 'open',
    stateReason: raw.state_reason || null,
    labels: (raw.labels || []).map((l) => (typeof l === 'string' ? l : l && l.name)).filter(Boolean),
    milestone: raw.milestone ? raw.milestone.title : null,
    body: raw.body || '',
    blockedBy,
    createdAt: raw.created_at || null,
    closedAt: raw.closed_at || null,
    updatedAt: raw.updated_at || null,
    url: raw.html_url || '',
  };
}

export function openGitHub({ repo, request = defaultRequest(), ttlMs = TTL_MS, now = Date.now }) {
  let kept = null;      // the last good answer
  let keptAt = 0;
  let lastError = '';
  let running = null;   // the fetch under way

  async function fetchIssues() {
    const raws = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await request(`repos/${repo}/issues?state=all&per_page=${PER_PAGE}&page=${page}`);
      raws.push(...batch);
      if (batch.length < PER_PAGE) break;
    }
    const issues = await Promise.all(raws.filter((r) => !r.pull_request).map(async (r) => {
      const summary = r.issue_dependencies_summary;
      if (!summary) return toIssue(r, null);
      if (!summary.total_blocked_by) return toIssue(r, []);
      const blockers = await request(`repos/${repo}/issues/${r.number}/dependencies/blocked_by?per_page=${PER_PAGE}`);
      return toIssue(r, blockers.map((b) => ({ number: b.number, repo: repoOf(b.repository_url) || repo })));
    }));
    issues.sort((a, b) => a.number - b.number);
    const fingerprint = createHash('sha256').update(JSON.stringify(issues)).digest('hex').slice(0, 16);
    return { available: true, repo, issues, fingerprint };
  }

  function refresh() {
    if (!running) {
      running = fetchIssues()
        .then((answer) => { kept = answer; keptAt = now(); lastError = ''; })
        .catch((error) => { lastError = tell(error); keptAt = now(); })
        .finally(() => { running = null; });
    }
    return running;
  }

  const answer = () => (kept ? (lastError ? { ...kept, error: lastError } : kept) : { available: false, reason: 'error', error: lastError });

  async function issues() {
    if (!repo) return { available: false, reason: 'no-repo' };
    if (!kept && !keptAt) await refresh();
    else if (now() - keptAt >= ttlMs) refresh();
    return answer();
  }

  return { issues, settled: () => running || Promise.resolve() };
}

// ───────── How GitHub is asked ─────────

const run = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, { timeout: 30000, maxBuffer: 64 * 1024 * 1024, windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' } },
    (error, stdout, stderr) => (error ? reject(new Error((stderr || '').trim() || error.message)) : resolve(stdout)));
});

let ghInstalled;   // undefined: not asked yet
const hasGh = async () => (ghInstalled ??= await run('gh', ['--version']).then(() => true, () => false));

export function defaultRequest(env = process.env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN || '';
  const viaGh = async (path) => JSON.parse(await run('gh', ['api', '-H', 'Accept: application/vnd.github+json', path]));
  const viaRest = async (path) => {
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'groundwork' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(API + path, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
  };
  return async (path) => ((await hasGh()) ? viaGh(path) : viaRest(path));
}
