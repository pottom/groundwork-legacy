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
| `module.mjs` | the manifest (hooks, `writes: ['.groundwork/agents']`) and `GET /api/agents/list` |
| `hook.mjs` | the hook: one file needing only Node; `summarize(input)` is the line, with the schema at its top |
| `agents-log.mjs` | `readAgents(text)`: the sessions and agents the log tells of, with their states and times |
| `index.html`, `agents.css` | the page |
| `ui-strings.mjs` | the page's text in English and Hungarian |
| `view/main.mjs` | the entry: reads the list, again on `agents.events`; a 1 s clock redraws running durations |
| `view/list.mjs` | the sessions as cards, their agents as rows (lit-html) |
| `view/strings.mjs` | the translation (`ui`) |
| `view/time.mjs` | `duration(ms)` and `clock(iso)` |

## Public endpoints

None yet.
