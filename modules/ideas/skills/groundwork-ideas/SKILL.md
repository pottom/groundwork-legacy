---
name: groundwork-ideas
description: Files side observations as numbered ideas in the project's idea box (docs/product/ideas/), with an impact/effort estimate and links to similar ideas, instead of acting on them or letting them slip. Use whenever you notice something worth doing that is outside the current task (a review finding, a refactor, a product thought), when the user says "idea", "note this for later", "add to the backlog", or asks what ideas exist.
---

The idea box is shared by the human and you. You **file**; the human **decides**. An idea outside the current task goes in the box, and the current task stays as it was: you keep working on what was asked, and mention the idea's number in your reply ("filed as I-12").

Every command below is `{{groundwork}} ideas <command>`, run in the project folder.

## Filing an idea

1. **Check for duplicates.** Run `{{groundwork}} ideas similar "<title and a few key words>"`. It prints the likely duplicates, the closest first: `I-3    0.82  considering Keyboard shortcut to switch tabs`, or `No similar ideas.`
   - The same idea already there (new or considering): file nothing, tell the user its number.
   - The same idea already **rejected**: file nothing; tell the user it was rejected, and why, from `{{groundwork}} ideas list` or its file.
   - Related but different: file it, and link the related ones with `--links`.
2. **Estimate it.** Impact and effort, each `low`, `medium` or `high`, and one line saying why: what it gains and what it takes.
3. **Add it.**

   ```
   {{groundwork}} ideas add "<short title>" --author claude --source "<where it came from>" \
     --kind product|engineering --impact <level> --effort <level> --rationale "<one line>" \
     [--links I-3,I-7] [--body "<what and why, a few sentences>"]
   ```

   - `--source`: the conversation, review or ticket you were in, e.g. `review of #24`, `grilling 2026-10-19`.
   - `--kind`: `product` for what users see or do, `engineering` for code, tooling, tests.
   - The command prints the new number and file: `I-12 docs/product/ideas/I-012-<slug>.md`. A command that fails prints why and writes nothing; fix the call and run it again.

Done when the command printed the new number and you told the user that number, or you named the existing idea it duplicates.

## Reading the box

`{{groundwork}} ideas list` prints every idea: number, column, title, author and source, estimate, links. The human sees the same box as a board in the Groundwork browser page.

## Making a ticket from an idea

An **engineering** idea the human moved to **Accepted**, or one the human accepted **Straight to a ticket**, becomes a GitHub issue. The human asks for it, or pastes the prompt the card's "Make a ticket" button copies (the board copies it too when the human accepts Straight to a ticket).

1. **Read the idea**: its file under `docs/product/ideas/` (`I-012-<slug>.md`), or `{{groundwork}} ideas list` (`{{groundwork}} record show I-12` also prints its history and what refers to it). Only an idea in Accepted that is an engineering one, or whose change is in Implementing, gets a ticket; for any other, tell the user why not. Accepting an idea opens a change (C-n) that names it in its `ideas`: `record show I-12` lists it under "Linked from"; when there are several, the latest (highest number) is the one. Read its file under `docs/product/changes/` too.
2. **Write the issue** in the project's usual ticket form (what to build, acceptance criteria), from the idea's description and estimate. Among its first lines, before the first `## ` heading, put the line that links it to the idea and, when the idea has a change, the line that links it to the change:

   ```
   **Idea:** I-12
   **Change:** C-7
   ```

   Keep the project's other lines too (`**PRD:** …` when the work belongs to a PRD item).
3. **Create it** with its state and area, which Build reads to place it: `gh issue create --title "<title>" --body-file <file> --label enhancement,ready-for-agent --milestone "<title>"`. The label is the state (`ready-for-agent` for work an agent can do, `ready-for-human` for a step only the human takes); without one the ticket shows as needing triage. The milestone is the area: the GitHub milestone of the change or milestone the work belongs to (`gh api repos/{owner}/{repo}/milestones` lists them); leave it out when none fits, and say so. Tell the user the issue number.

Build reads the `**Idea:**` line and shows the idea as a link on the ticket; the idea's card shows the ticket's number and state. The `**Change:**` line is how a change finds its tickets (its `## Jegyek` section says so). Do not edit the idea or the change file for this: the link lives in the ticket.

## Your limits

Ideas you file start in **New**, and you move them only between **New** and **Considering**. Moving an idea to **Accepted**, **Rejected**, **Snoozed** or **Duplicate** is the human's decision, made in the browser: the command refuses it. When an idea looks ready for one of them, say so to the user with your reason. Do not edit an idea's file by hand to get around this. Numbers are never reused, so a number always means the same idea.
