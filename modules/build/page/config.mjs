// The page's fixed values: the server it talks to, the timings, the views and their filters, and
// what the ticket reader (ticket-reader.js, a classic script loaded before the page's modules)
// gives the page. The reader is shared with the server (project-tickets.mjs), which reads the
// tickets for Plan's counts by the same rules.

// The Build module's endpoints on the core server, when the page is loaded from it. The same
// values are in modules/build/module.mjs.
export const SERVER_ID = 'development-status';
export const SERVER_API = '/api/build';
export const SERVER_TIMEOUT_MS = 8000;

export const POLL_MS = 3000;     // a folder chosen in the browser is read again this often
export const FRESH_MS = 90000;   // a ticket changed this recently is marked "fresh"
export const TOAST_MS = 3500;

// What a ticket is and how it is read (the model every view draws), where the tracker is and
// which folders are walked, the states and the links to Plan: readTickets, locateProject, fold,
// isClosed, CLOSED, DONE, UNPARSED, … (see the end of ticket-reader.js).
export const reader = globalThis.GroundworkTickets;
const { DONE, UNPARSED } = reader;

export const HUMAN = new Set(['ready-for-human', 'needs-info', 'needs-triage']);
export const TEST = /^needs-(.*)-test$/;
// The groups of the "Waiting on" view, by status.
export const GROUPS = [
  { id: 'agent', title: 'group.agent', hint: 'group.agent.hint', has: (s) => s === 'ready-for-agent' },
  { id: 'human', title: 'group.human', hint: 'group.human.hint', has: (s) => HUMAN.has(s) },
  { id: 'test', title: 'group.test', hint: 'group.test.hint', has: (s) => TEST.test(s) },
  { id: 'claimed', title: 'group.claimed', hint: 'group.claimed.hint', has: (s) => s === 'claimed' },
];
export const VIEWS = [
  ['waiting', 'view.waiting'], ['areas', 'view.areas'], ['deps', 'view.deps'],
  ['activity', 'view.activity'], ['checks', 'view.checks'], ['docs', 'view.docs'], ['git', 'view.git'],
];
// The filters each view applies; only these show above it.
const TICKET_FILTERS = ['q', 'status', 'area', 'closed'];
export const FILTERS = { waiting: TICKET_FILTERS, areas: TICKET_FILTERS, deps: TICKET_FILTERS, activity: ['q', 'area'], checks: ['q', 'area'], docs: ['q', 'area'], git: [] };

export const GIT_PAGE = 400;      // commits asked for at once; "Earlier commits" asks for this many more
export const GIT_ROW_H = 30;      // px, one commit
export const GIT_LANE_W = 16;     // px, one lane of the graph
export const GIT_COLORS = 8;      // --g0 … --g7
export const NO_REPO = 'no-repo'; // git.error when the folder is not the top of a git repository

// The kinds of problem the reader finds, in the order the Checks view lists them; the third value
// marks a kind worth knowing that is not a contradiction (not counted as a warning).
export const PROBLEM_KINDS = [
  ['duplicate', 'problem.duplicate'],
  ['no-status', 'problem.no-status'],
  ['bad-status', 'problem.bad-status'],
  ['all-checked', 'problem.all-checked'],
  ['missing-blocker', 'problem.missing-blocker'],
  ['released', 'problem.released', true],
  ['mismatch', 'problem.mismatch'],
  ['no-number', 'problem.no-number'],
  ['no-prd', 'problem.no-prd'],
  ['unknown-prd', 'problem.unknown-prd'],
];
export const INFO_KINDS = new Set(PROBLEM_KINDS.filter((k) => k[2]).map((k) => k[0]));

// Plan's map in a picked folder (on the server Plan sends only its ids).
export const MAP_PATH = 'docs/product/mindmap.json';
