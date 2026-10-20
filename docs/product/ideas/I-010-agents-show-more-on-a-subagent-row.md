---
id: I-10
title: "Agents: show more on a subagent row"
author: claude
source: Agents tab, 2026-10-20 session
kind: product
impact: medium
effort: medium
rationale: The list is the overview of who works on what; today a subagent row says only 'Subagent', its state and a 0:00 duration
status: considering
created: 2026-10-20
---

A subagent row shows only 'Subagent', its branch, Done and 0:00, so it says nothing about what the agent did. More of it belongs on the row: its label (the Agent call's description; the log has it on PreToolUse) and its type, what it is working on now or worked on (the last step of its timeline: files read and changed, commands, a test run), how many tool calls it made, and its real duration. Background agents (run_in_background) need care: the Agent tool's PostToolUse comes at once with status async_launched, so the row must not read as done with 0:00 while the agent is still running; their end is their SubagentStop. Seen in this session: two subagents at 10:11 listed as Done · 0:00 with no label.

Its role and its ticket, too: whether it implements, reviews, explores or plans (from its type and its label, or from the skill it runs: tdd, code-review), and which ticket it is on (#62), the way a session already shows its ticket from its branch. A subagent working in the main checkout has no branch of its own, so the ticket comes from its label or prompt summary instead.

## Történet

- 2026-10-20 · claude · created
- 2026-10-20 · human · status: new → considering
