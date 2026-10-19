---
name: groundwork-ideas
description: Files side observations as numbered ideas in the project's idea box (docs/product/ideas/items/), with an impact/effort estimate and links to similar ideas, instead of acting on them or letting them slip. Use whenever you notice something worth doing that is outside the current task (a review finding, a refactor, a product thought), when the user says "idea", "note this for later", "add to the backlog", or asks what ideas exist.
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
   - The command prints the new number and file: `I-12 docs/product/ideas/items/I-012-<slug>.md`. A command that fails prints why and writes nothing; fix the call and run it again.

Done when the command printed the new number and you told the user that number, or you named the existing idea it duplicates.

## Reading the box

`{{groundwork}} ideas list` prints every idea: number, column, title, author and source, estimate, links. The human sees the same box as a board in the Groundwork browser page.

## Your limits

Ideas you file start in **New**. Moving an idea to **To develop** or **Rejected** is the human's decision, made in the browser; when an idea looks ready for either, say so to the user with your reason. Ideas are never deleted, so a number always means the same idea.
