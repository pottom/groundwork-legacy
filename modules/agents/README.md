# Agents module

The Claude Code sessions of a project and their subagents, live, in the shell: each session with its agents, their state (running, done, failed), when they started and how long they ran. It only observes; starting and stopping stay in Claude Code. The plan, in Hungarian: [`docs/product/agents/PRD.md`](../../docs/product/agents/PRD.md), [`TECH.md`](../../docs/product/agents/TECH.md).

Agents is a tool, not a step of the workflow: its tab comes after Sketch (`tool: true`).

## How it works

`groundwork init` copies `hook.mjs` into the project as `.claude/hooks/groundwork-agents-hook.mjs` and installs it in `.claude/settings.json` for SessionStart, SubagentStart, SubagentStop, PreToolUse (matcher `Agent|Task` only), PostToolUse, PostToolUseFailure, Notification, Stop and SessionEnd, as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/groundwork-agents-hook.mjs"`. A direct `node` start costs ~60 ms per call; `npx` would cost ~0.7 s. Each call appends one line to `.groundwork/agents/events.jsonl` (moved aside to `events.1.jsonl` past 2 MB). The server reads the log (`agents-log.mjs`) and the page reads the list again on the topic `agents.events`.

A subagent's events carry `agent_id` and `agent_type`; the main session's do not. The Agent tool's PreToolUse gives the subagent's label (`description`); its PostToolUse names the agent it started (`tool_response.agentId`).

The log holds a summary only: the event, session and agent ids, the tool's name, the path it touched, the names of the commands a shell ran (no arguments), the Agent call's short description and result status, the notification type, whether a shell call ran tests (`test`: passed, failed or ran, from a vetted list of test commands and the output's pass/fail counts) and the hash a `git commit` printed. Never a prompt, file content, command arguments, output, error text, message, URL or search pattern.

Opening an agent (`#agent=<session>/<agent>`, or a session: `#agent=<session>`) shows its timeline: its tool calls grouped into steps (files read, files changed, commands, tools; test runs, commits, skills and subagents as steps of their own), from `timeline.mjs`. Once a subagent stops, its final report shows below as Markdown. The report is SubagentStop's `last_assistant_message`, which the hook keeps apart from the log in `.groundwork/agents/reports/<agent>.md`: redacted (keys, tokens, passwords, a URL's credentials and query), capped at 40 000 characters, the newest 200 kept. The page renders it with raw HTML shown as text, safe links only and no images (`view/markdown.mjs`). No transcript is read or stored.

## Attention

A session or agent that needs the user stands out in the list, with its reason (f-agents-attention, `attention.mjs`):

- **waiting**: a Notification asked the user (`permission_prompt`, `elicitation_dialog`, `elicitation_url_dialog`), until the next event of the same agent. Claude Code's docs show no `agent_id` on a Notification: one that has it marks that agent, one without it marks the session (where the prompt is answered anyway), until any later event of the session, its agents' included. `idle_prompt` (a done session waiting for the next prompt) is not attention.
- **stalled**: running, and no event for 10 minutes. A session with a running agent is not stalled itself; the agent carries it.
- **failed**: stopped with an error (its Agent call failed, or its session ended first).

Anything older than 12 hours is old news and no longer counts. The page judges it by its 1 s clock, so a stall shows without a new event. The manifest names `GET /api/agents/attention` as its `attention` endpoint: the shell counts the items on the Agents tab and shows a toast once for each new one (`core/shell/attention.mjs`); `recheck` tells it when to ask again without an event.

## Worktrees and branches

Below the sessions, the page lists the project's git worktrees and local branches (`GET /api/agents/worktrees`, `git-worktrees.mjs`): each against the integration branch it was cut from (guessed from the graph), commits ahead and behind, merged or not, uncommitted changes, locked (Claude Code locks an agent's worktree while it runs), and the agent working in it and its ticket when known. A merged, clean, unlocked one is ready to clean up: the page shows the `git worktree remove` / `git branch -d` lines to copy and runs nothing. The server only reads git (`GIT_OPTIONAL_LOCKS=0`). A ref or a worktree changing is the topic `agents.git`; the page also reads the list again on `agents.events`.

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest (hooks, `writes: ['.groundwork/agents']`, `attention`), `GET /api/agents/list`, `GET /api/agents/agent?session=&agent=` (timeline and report), `GET /api/agents/attention` (for the shell) and the public `GET /api/agents/tickets` |
| `hook.mjs` | the hook: one file needing only Node; `summarize(input)` is the line, with the schema at its top; `redact(text)` for the report |
| `agents-log.mjs` | `readAgents(text)`: the sessions and agents the log tells of, with their states, times and cwd |
| `attention.mjs` | `attentionOf(item, now)`, `needingAttention(sessions, now)`: who needs attention and why; shared by the server and the page |
| `timeline.mjs` | `readTimeline(text, { session, agent })`: one agent's steps |
| `agent-tickets.mjs` | `linkTickets(sessions, git)`: each one's branch and ticket; `ticketIn`, `branchTicket` |
| `agent-git.mjs` | `readGit(root, since)`: the worktrees and their branches' own commits (read-only `git`) |
| `index.html`, `agents.css` | the page |
| `ui-strings.mjs` | the page's text in English and Hungarian |
| `view/main.mjs` | the entry: reads the list and the open agent (from the address), again on `agents.events`; a 1 s clock redraws running durations |
| `view/list.mjs` | the sessions as cards, their agents as rows (lit-html) |
| `view/detail.mjs` | an open agent's timeline and final report |
| `view/markdown.mjs` | the safe marked options for the report |
| `view/strings.mjs` | the translation (`ui`) |
| `view/time.mjs` | `duration(ms)` and `clock(iso)` |
| `git-worktrees.mjs` | `openWorktrees(root).read()`: the worktrees and branches; `withAgents(answer, sessions)` adds agent and ticket from the linked sessions |
| `view/worktrees.mjs` | the worktrees and branches as rows, with the clean-up commands to copy (lit-html) |

## Tickets and branches

Each session and agent shows its branch and its ticket (f-agents-ticket-link). The branch is that of the git worktree its latest event's `cwd` lies in (`git worktree list`; a worktree agent works in its own). The ticket (`#37`) comes, in this order, from its task (the Agent call's description: `#37`, `issue 37`, `ticket 37`), from its branch name (a leading number of a part, `37-links` or `feature/37-x`, or `issue-37` / `gh-37`; never any number, so `milestone-7-agents` names none), or from the commits on its branch made while it ran. Commits on the main checkout's branch are not read, since every agent there shares it, and a branch's own commits are those not on that branch (so after a merge, none). The server runs `git` read-only on each list; the hook never does. The ticket opens in Build (`/?module=build&ticket=%2337`).

## Public endpoints

- `GET /api/agents/tickets`: `{ tickets: { '#37': [{ id, session, label, branch, start }] } }`, the running agents (and sessions) per ticket and nothing more. Build shows them as a "Being worked on" badge on the ticket, which opens the agent here (`/?module=agents&agent=<id>`), and reads it again on `agents.events`. Without Agents, Build gets a 404 and shows no badge.
