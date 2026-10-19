# Agents module

The Claude Code sessions of a project and their subagents, live, in the shell: each session with its agents, their state (running, done, failed), when they started and how long they ran. It only observes; starting and stopping stay in Claude Code. The plan, in Hungarian: [`docs/product/agents/PRD.md`](../../docs/product/agents/PRD.md), [`TECH.md`](../../docs/product/agents/TECH.md).

Agents is a tool, not a step of the workflow: its tab comes after Sketch (`tool: true`).

## How it works

`groundwork init` copies `hook.mjs` into the project as `.claude/hooks/groundwork-agents-hook.mjs` and installs it in `.claude/settings.json` for SessionStart, SubagentStart, SubagentStop, PreToolUse (matcher `Agent|Task` only), PostToolUse, PostToolUseFailure, Notification, Stop and SessionEnd, as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/groundwork-agents-hook.mjs"`. A direct `node` start costs ~60 ms per call; `npx` would cost ~0.7 s. Each call appends one line to `.groundwork/agents/events.jsonl` (moved aside to `events.1.jsonl` past 2 MB). The server reads the log (`agents-log.mjs`) and the page reads the list again on the topic `agents.events`.

A subagent's events carry `agent_id` and `agent_type`; the main session's do not. The Agent tool's PreToolUse gives the subagent's label (`description`); its PostToolUse names the agent it started (`tool_response.agentId`).

The log holds a summary only: the event, session and agent ids, the tool's name, the path it touched, the names of the commands a shell ran (no arguments), the Agent call's short description and result status, the notification type. Never a prompt, file content, command arguments, output, error text, message, URL or search pattern.

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest (hooks, `writes: ['.groundwork/agents']`), `GET /api/agents/list` and the public `GET /api/agents/tickets` |
| `hook.mjs` | the hook: one file needing only Node; `summarize(input)` is the line, with the schema at its top |
| `agents-log.mjs` | `readAgents(text)`: the sessions and agents the log tells of, with their states, times and cwd |
| `agent-tickets.mjs` | `linkTickets(sessions, git)`: each one's branch and ticket; `ticketIn`, `branchTicket` |
| `agent-git.mjs` | `readGit(root, since)`: the worktrees and their branches' own commits (read-only `git`) |
| `index.html`, `agents.css` | the page |
| `ui-strings.mjs` | the page's text in English and Hungarian |
| `view/main.mjs` | the entry: reads the list, again on `agents.events`; a 1 s clock redraws running durations |
| `view/list.mjs` | the sessions as cards, their agents as rows (lit-html) |
| `view/strings.mjs` | the translation (`ui`) |
| `view/time.mjs` | `duration(ms)` and `clock(iso)` |

## Tickets and branches

Each session and agent shows its branch and its ticket (f-agents-ticket-link). The branch is that of the git worktree its latest event's `cwd` lies in (`git worktree list`; a worktree agent works in its own). The ticket (`#37`) comes, in this order, from its task (the Agent call's description: `#37`, `issue 37`, `ticket 37`), from its branch name (a leading number of a part, `37-links` or `feature/37-x`, or `issue-37` / `gh-37`; never any number, so `milestone-7-agents` names none), or from the commits on its branch made while it ran. Commits on the main checkout's branch are not read, since every agent there shares it, and a branch's own commits are those not on that branch (so after a merge, none). The server runs `git` read-only on each list; the hook never does. The ticket opens in Build (`/?module=build&ticket=%2337`).

## Public endpoints

- `GET /api/agents/tickets`: `{ tickets: { '#37': [{ id, session, label, branch, start }] } }`, the running agents (and sessions) per ticket and nothing more. Build shows them as a "Being worked on" badge on the ticket, which opens the agent here (`/?module=agents&agent=<id>`), and reads it again on `agents.events`. Without Agents, Build gets a 404 and shows no badge.
