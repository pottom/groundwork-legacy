# Agents module

The Claude Code sessions of a project and their subagents, live, in the shell: each session with its agents, their state (running, done, failed), when they started and how long they ran. It only observes; starting and stopping stay in Claude Code. The plan, in Hungarian: [`docs/product/agents/PRD.md`](../../docs/product/agents/PRD.md), [`TECH.md`](../../docs/product/agents/TECH.md).

Agents is a tool, not a step of the workflow: its tab comes after Sketch (`tool: true`).

## How it works

`groundwork init` copies `hook.mjs` into the project as `.claude/hooks/groundwork-agents-hook.mjs` and installs it in `.claude/settings.json` for SessionStart, SubagentStart, SubagentStop, PreToolUse (matcher `Agent|Task` only), PostToolUse, PostToolUseFailure, Notification, Stop and SessionEnd, as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/groundwork-agents-hook.mjs"`. A direct `node` start costs ~60 ms per call; `npx` would cost ~0.7 s. Each call appends one line to `.groundwork/agents/events.jsonl` (moved aside to `events.1.jsonl` past 2 MB). The server reads the log (`agents-log.mjs`) and the page reads the list again on the topic `agents.events`.

A subagent's events carry `agent_id` and `agent_type`; the main session's do not. The Agent tool's PreToolUse gives the subagent's label (`description`); its PostToolUse names the agent it started (`tool_response.agentId`).

The log holds a summary only: the event, session and agent ids, the tool's name, the path it touched, the names of the commands a shell ran (no arguments), the Agent call's short description and result status, the notification type, whether a shell call ran tests (`test`: passed, failed or ran, from a vetted list of test commands and the output's pass/fail counts) and the hash a `git commit` printed. Never a prompt, file content, command arguments, output, error text, message, URL or search pattern.

Opening an agent (`#agent=<session>/<agent>`, or a session: `#agent=<session>`) shows its timeline: its tool calls grouped into steps (files read, files changed, commands, tools; test runs, commits, skills and subagents as steps of their own), from `timeline.mjs`. Once a subagent stops, its final report shows below as Markdown. The report is SubagentStop's `last_assistant_message`, which the hook keeps apart from the log in `.groundwork/agents/reports/<agent>.md`: redacted (keys, tokens, passwords, a URL's credentials and query), capped at 40 000 characters, the newest 200 kept. The page renders it with raw HTML shown as text, safe links only and no images (`view/markdown.mjs`). No transcript is read or stored.

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest (hooks, `writes: ['.groundwork/agents']`), `GET /api/agents/list` and `GET /api/agents/agent?session=&agent=` (timeline and report) |
| `hook.mjs` | the hook: one file needing only Node; `summarize(input)` is the line, with the schema at its top; `redact(text)` for the report |
| `agents-log.mjs` | `readAgents(text)`: the sessions and agents the log tells of, with their states and times |
| `timeline.mjs` | `readTimeline(text, { session, agent })`: one agent's steps |
| `index.html`, `agents.css` | the page |
| `ui-strings.mjs` | the page's text in English and Hungarian |
| `view/main.mjs` | the entry: reads the list and the open agent (from the address), again on `agents.events`; a 1 s clock redraws running durations |
| `view/list.mjs` | the sessions as cards, their agents as rows (lit-html) |
| `view/detail.mjs` | an open agent's timeline and final report |
| `view/markdown.mjs` | the safe marked options for the report |
| `view/strings.mjs` | the translation (`ui`) |
| `view/time.mjs` | `duration(ms)` and `clock(iso)` |

## Public endpoints

None yet.
