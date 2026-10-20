---
name: groundwork-prd-maker
description: Turns a grilling interview into product documentation: a PRD, a technical design, and for systems and services also overview, service, process, operations and rollout documents. While you talk, it writes into a change (C-n, under docs/product/changes/), which the Spec documents under docs/product/spec/ take once the human approves it; the Spec shows as a live mind map in the browser pane. Works for new and for half-finished projects. Load it alongside grilling, grill-me or grill-with-docs, whenever the user wants a PRD, a spec of a system or service, grills a change, or mentions the mind map, and after to-tickets has made tickets from the PRD.
---

The deliverables are the Spec: Markdown documents under **`docs/product/spec/`**. The Markdown is the source. The mind map is how the human follows along: at any moment it shows where the interview stands and what has been covered. The map is a view of the Spec files, so a file edited by hand shows on the map at once.

The Spec says what is true now; what is being shaped lives in a **change** (C-n). The Spec's content changes only through a change: the interview writes into the change's file (see "A change interview writes into the change"), and the Spec takes the change's proposed items when the human approves and merges it. Only what leaves what is built as it is (wording, order, a wrong mark) goes into the Spec directly, with `apply`.

## Structure

```
root                          the system or product: named after the system document's title
├── system document           belongs to the whole: the overview (spec/SYSTEM.md)
├── component                 a part of the system, with a type (software, service, infra, shared)
│   └── document              e.g. PRD.md and TECH.md for software, SERVICE.md for a service
│       └── section           a chapter of that document
│           └── items         decisions, facts, groups…
```

- **A plain software product** is one component (say `app`) with two documents, `prd` and `tech`.
- **A system or service, or a mix**, fills the overview document (`system`) and gets one component per part, each with the documents its type needs.
- **Only these go under the root and a component.** The Spec has no place for a loose node under the root or a component, or for a document other than `system` directly under the root: `apply` refuses them with an error.
- **Files.** Each document is the file `docs/product/spec/<component>/<FILE>.md`; the overview is `docs/product/spec/SYSTEM.md`; the components are listed in `docs/product/spec/parts.md`. The component folder is the component's `dir`; give every component a short English `dir` (`core`, `plan`, `billing`) so the folders match the code whatever language the map is in. Without `dir` the folder comes from the component's name.
- **The Markdown is the source, and may be edited by hand.** The human (or another tool) may edit a Spec file directly; the map shows it. `apply` and browser edits rewrite only the documents they change, and only normalize their form (the canonical Markdown): they drop nothing. Prefer `apply` yourself, because it merges with edits the human is making on the map at the same moment.
- **Other skills' places.** These folders belong to other skills: `GLOSSARY.md`, `GLOSSARY-MAP.md`, `docs/adr/`, `docs/agents/`, `.scratch/` and `.out-of-scope/`. groundwork-prd-maker never writes into them. It reads them and links to them.

### Document kinds and their starting sections

The sections are only starting points. What a project needs, and what "scope" means for it, differs from project to project. Propose sections fitted to this project, and let the human confirm or change them.

The table below shows the English names, while a map without a language is Hungarian. `{{groundwork}} plan kinds` prints the starting sections in the map's document language (see Session flow, step 1): use the titles it prints, not the ones here.

| kind | file | starting sections |
|---|---|---|
| `system` | SYSTEM.md | Goal and stakeholders · Components and their boundaries · Shared roadmap · Risks and dependencies · Costs |
| `prd` | PRD.md | Problem and goal · Users and use cases · Scope and main features · Functional requirements · Non-functional requirements |
| `tech` | TECH.md | Platform and runtime · Technology stack · Architecture and components · Data and storage · Integrations and interfaces · Security · Build, release, deployment · Testing and quality · Decision log |
| `service` | SERVICE.md | Who and what · Service level (SLA) · Channels · Terms and pricing · Metrics |
| `process` | PROCESS.md | Roles · Main processes · Escalation · Handovers |
| `infra` | INFRA.md | Environments · Network · Capacity · Security · Backup |
| `ops` | OPERATIONS.md | Monitoring · Incident management · Backup and recovery · Maintenance · Support model |
| `rollout` | ROLLOUT.md | Schedule · Migration · Training · Communication · Rollback plan |

Any other kind is allowed too; its file name is the kind in capitals (`<KIND>.md`), or `file` (an UPPERCASE `.md` name).

Notes on two of the sections:

- **Technology stack** (in `tech`): group it by layer. For each technology, record what it is, why it was chosen (`note`, ADR `link`), and the alternatives ruled out (`excluded`).
- **Decision log** (in `tech`): one `decision` per ADR in `docs/adr/`, with its state in `note` (valid, partly superseded, superseded, open; in the document language) and the file in `link`.

## The map is meeting notes, not a transcript

Questions, the choices you offered, and your recommendations never go on the map. It keeps only what matters:

- **Short labels**, a few words, in the language of the conversation. A rationale goes in `note`.
- **Only what matters**: decisions, constraints, scope boundaries, facts that later answers depend on. Accepted defaults and small talk stay off the map.
- **Placed by meaning**: each item goes into the document and section it belongs to, wherever the conversation happened to be. What the user gets belongs in the PRD; what it is built with belongs in TECH; how it is run belongs in OPERATIONS.
- **Redraw freely**: rename, merge, move or remove nodes so the map always reads as the current state, not as history.
- **Readable ids**, unique across the whole Spec:
  - a component's id is its `dir` (`app`), a document's is `<dir>/<kind>` (`app/prd`, the overview's `system`): give any id when you add one, `apply` prints the id the Spec gives it (`c-app is app`), and use that one afterwards
  - `t-<slug>` for sections
  - `g-<slug>` for groups
  - `d-<slug>` for decisions
  - `n-<slug>` for notes

## Tools

All access goes through `{{groundwork}} plan <command>`, run in the project's root folder: `apply` merges with edits the human is making on the map at the same moment.

- `init "<name>"`: start the Spec: its overview document, titled with the system or product name (the root's name).
- `show`: print the outline with ids, statuses, documents and section state, plus any human edits you have not seen yet.
- `apply`: change the map, that is the Spec's Markdown, then print the outline. Pass a JSON op array on stdin with a quoted heredoc in the Bash tool. This avoids Windows quoting problems:

  ```bash
  {{groundwork}} plan apply <<'EOF'
  [{"op":"add","id":"app","parent":"root","topic":"Mobilapp","component":"software","dir":"app"},
   {"op":"add","id":"app/prd","parent":"app","topic":"Mobilapp: Termék","doc":"prd"},
   {"op":"add","id":"t-app-users","parent":"app/prd","topic":"Felhasználók"},
   {"op":"set","id":"t-app-users","prose":"…the section text, in Markdown…"}]
  EOF
  ```

  Ops:
  - `{"op":"add","id":"…","parent":"…","topic":"…","status":"…","note":"…","link":"…","impl":"…","component":"…","dir":"…","doc":"…","file":"…"}`
  - `{"op":"set","id":"…", …the same fields…, "prose":"…","progress":"done"}`
    - `prose` and `progress` are for sections only. `prose` has no list or heading lines (the Spec would read them as items and sections), and a `note` no list lines: make those nodes.
    - A document's `topic` is its title (`Mobilapp: Termék`).
    - `lang` is for the root only: the document language, `{"op":"set","id":"root","lang":"en"}`.
    - Set a field to `""` to clear it.
  - `{"op":"move","id":"…","parent":"…"}`
  - `{"op":"remove","id":"…"}`

  `link` paths are relative to the project root (for example `docs/adr/0012.md`). In the file they are written relative to the document.
- Statuses:
  - `topic`: a group inside a section.
  - `decision`: something settled.
  - `note`: a fact or constraint.
  - `excluded`: ruled out. Each document lists these in its own section: Non-goals in the PRD, Rejected alternatives in TECH. Record the rejected alternatives of a technical decision this way.
  - `parked`: deferred.
  - `todo`: still to discuss. It goes to the open questions.
  - `inferred`: read from existing code or documents, waiting for the human to confirm. Once confirmed, change it to `decision` (or `note`); if it is wrong, fix or remove it.
- Implementation (`impl`, independent of the status): `done`, `partial` or `missing`. Use it whenever there is code to compare against.

  Sections with nothing in them are listed among the open questions automatically. Do not create sections for non-goals, open questions or later items; the document panel computes those.

## A change interview writes into the change

Every interview that changes what is built is the interview of a change. The human names it (`C-7`), or it starts from an accepted idea that already has one; when there is none, create it: `{{groundwork}} record add change --title "<title>" [--ideas I-5] [--milestone M-9]` prints `C-7 <file>`, the change's spec skeleton. `{{groundwork}} record show C-7` prints it, and `{{groundwork}} record list --type C` lists them all.

The interview writes into that file, `docs/product/changes/C-<nnn>-<slug>.md`, edited directly, and leaves the Spec as it is. The human follows it on the change's page in the Changes tab, which reloads with every write.

```markdown
---
id: C-7
title: Offline mode
ideas: I-5
milestone: M-9
status: grilling
---

## Probléma

The app is useless on the train: every edit needs the network.

## Megoldás

Edits wait in a queue on the device and go out when the network is back.

## Keret

Editing offline; done when an edit made offline reaches the server after reconnecting.

## Kihagyjuk

Offline sign-in.

## Gondolatok

- Edits made on the train must not be lost
- ? Does a sync conflict ask the user, or does the newer edit win?
  Two devices can edit the same note offline.
  - ~! The newer edit wins, the older stays in the history
  - ~ The user picks one
- = Edits wait in a queue until the network is back → `d-offline-queue`
  - x Editing without a queue, straight against the server

## Javasolt elemek

- add `t-app-offline` → `app/prd` — Offline mode
  The section's prose: what it settles, as it reads now.
- add `d-offline-queue` → `app/prd#t-app-offline` — Edits wait in a queue until the network is back · decision · missing
  Why: the note, lines indented two spaces under the item.
- change `d-sync` → `app/tech#t-app-data` — Sync runs on reconnect and every 15 minutes · decision · partial

## Jegyek

A jegyek a `**Change:** C-7` sorukkal hivatkoznak erre a változásra.

## Történet

- 2026-10-20 · claude · created
```

What goes where, as the interview moves:

- **The thought map** (`## Gondolatok`): the change's train of thought, a nested list. Its root is not written: it is the change's title. Indentation (two spaces a level) gives the branches; the sign at the start of a line gives the node's kind, the same in every document language:

  | Sign | Kind |
  |---|---|
  | `?` | question: an open question |
  | `~` | option: a possible answer, a child of its question |
  | `~!` | the option you recommend (one per question) |
  | `=` | decision |
  | `!` | constraint |
  | `x` | out of scope, or an alternative left aside |
  | (none) | a plain thought |

  A node's note is the lines indented under it, before its children (never start a note line with `- `: it would read as a child). A node may end in `` → `<id>` ``, the proposed item it became.
  - **A question** goes onto the map where it belongs in the train of thought: under the thought or decision it comes from, or at the top for a new branch. Its options are its `~` children, the one you recommend `~!`. Write it when you ask it, in the same turn. The open questions of the change are exactly the map's `?` nodes; the page lists them beside the map, with their options.
  - **When the human answers**, the question node itself becomes the answer: rewrite its line as what was settled, with `=` (a decision), `!` (a constraint) or `x` (out of scope). If the question itself matters, keep it in the answer's note. Its options go: a serious alternative left aside stays as an `x` child (it becomes a rejected alternative in the Spec); a filler option is removed. The map shows the state now, not the history: what an answer changed shows on the page as the marks since the last commit.
  - **A settled node that matures into a Spec item** gets its proposed item in the list below, and the node links to it: `` - = Edits wait in a queue → `d-offline-queue` ``. Not every node becomes an item: plain thoughts and small steps stay on the map.
  - Keep the map small and loose: it is one change's thinking, not the Spec. Thoughts the human says in passing go on as plain nodes where they belong.
  - An older change may still have a `## Kérdések` list. Do not write to it; when you work on such a change, move its open questions onto the map as `?` nodes and remove the list.
- **Proposed items** (`## Javasolt elemek`): one line per Spec item the answers settle, `` - <op> `<id>` → `<target>` — <text> ``, its note in the lines under it, indented two spaces.
  - `op`: `add` a new id; `change` an id the Spec has, with its new wording; `supersede` an id the Spec has, replaced by this change.
  - `target`, where the item goes: `parts` for a part, the part's id for a document, the document's id for a section (`app/prd`), and `<document>#<section or parent item>` for an item (`app/prd#t-app-offline`). An item may target an item or section this same change proposes.
  - `text`: an item's topic, then its status and implementation after ` · ` in the document language, as the Spec writes them (`· döntés · hiányzik`, `· decision · missing`); a part, a document or a section has only its name, and a section's prose is its note.
  - Ids and labels follow the rules of "The map is meeting notes"; `{{groundwork}} plan show` gives the Spec's ids and the targets to pick from. Rewrite or remove an item line freely: the list reads as the change's current proposal, not as history.
- **Problem, solution, scope, out of scope** (`## Probléma`, `## Megoldás`, `## Keret`, `## Kihagyjuk`): rewritten as they sharpen, as the change reads **now**, in the language of the conversation. The scope ends in what done means.
- **Front matter and history**: leave `id`, `title`, `ideas`, `milestone` and `status` as they are unless the human changes them: the interview's stage is computed from the map's open questions.

After every write, run `{{groundwork}} record check` and fix what it reports in the change's file before you ask on: a target that is not in the Spec, a `change` or `supersede` of an id that is not there, a line not in the canonical form; on the map, an unknown sign, a `→` to an id the change does not propose, a line not in the map's canonical form. Done when it prints `no errors`; a finding in another file is the human's, so name it to them instead.

**The close.** The interview closes when its frontier is empty or when the human closes it. Then:

1. The map holds no `?` node, so the change's stage is Awaiting approval (`awaiting-approval`), computed from the map. When the human closes it with questions still open, they stay on the map, and the change stays in Grilling.
2. Append a history line: `- <today> · claude · grilled: <what was settled, in a few words>`.
3. Tell the human the change awaits their approval; the Spec takes its items when they approve and merge it.

## Session flow

1. **Start.** If `docs/product/spec/` is missing, run `init`. Start the core server: with `preview_start` when `.claude/launch.json` has a `groundwork` configuration, otherwise run `{{groundwork}} --no-open` in the background (it prints its address; `--port N` picks another port when 4477 is taken). Open the change's page in the Changes tab (`/?module=changes`), and `/plan/` for the Spec it changes.

   Set the document language to the language of the conversation: `{"op":"set","id":"root","lang":"…"}`. `show` prints it on the root line. A map without one is Hungarian (`hu`). Every fixed text of the documents (subtitle, state marks, closing sections) and the starting sections from `kinds` are then in that language, so the map's own labels and prose must be in it too. The languages there are: `hu`, `en` (the usage line of `{{groundwork}} plan` lists them). If the conversation is in a language with no strings, use `en` and say so. If the conversation switches language for good, change it and translate the map's labels and prose.
2. **Existing project?** If there is already code or documentation, read it before asking anything. Dispatch a sub-agent for a thorough analysis:
   - the product: README, specs, glossary, docs;
   - every ADR in `docs/adr/`, with its state;
   - feature specs in `.scratch/*/spec.md`;
   - non-goals in `.out-of-scope/`;
   - the technology stack and the architecture;
   - the features, with their implementation state;
   - the inconsistencies between docs and code.

   Write the result into the change as proposed items with the status `inferred` (in the document language, as the Spec writes it), their `impl` and their evidence links in the note. Write the inconsistencies as `?` nodes on the change's map. The first grilling round then confirms the inferred items, document by document; only after that move on to what is missing.
3. **What are we building?** The first real question decides the structure: a software product, a system, a service, or a mix, and which parts it consists of. From the answer, propose the components, their documents and the documents' sections as proposed items (targets `parts`, the part, the document). Ask the human to confirm or change them, in chat or in the change's file.
4. **Steer by the documents.** The grilling frontier must cover every section of every document the change touches. Prefer questions that fill untouched or thin sections.
5. **Each round.** Ask the round in chat, and write its questions onto the change's map, each with its options and your recommendation. When the answers arrive, in the same turn and before the next round:
   1. Turn each answered question into its answer (`=`, `!` or `x`), keep the serious alternatives as `x` children and remove the filler options; add or rewrite the proposed items, and link the nodes that became items.
   2. Rewrite the prose (the note of a proposed section) of every section the answers touched, and the change's problem, solution and scope. Write it as it reads **now**: complete, polished text, not a log of the conversation. The prose gives the context, the reasoning and the scenarios. The list under it holds the atomic decisions, so do not repeat them one by one. Use Markdown, in the language of the conversation, typically one to three short paragraphs.
   3. Run the check, as after every write.
6. **ADRs and glossary (grill-with-docs).** domain-modeling writes ADRs to `docs/adr/` and terms to `GLOSSARY.md`. groundwork-prd-maker does not write them itself. When an ADR appears, propose it in the change for the Decision log section, and give its path in the note of the matching decision. The glossary is shown automatically in the PRD and the overview.
7. **Finish.** When the frontier is empty, make a final pass over the change:
   - Reread its text and the prose of its proposed sections, so the change reads as one coherent whole and agrees with the Spec it changes.
   - Close the interview as "The close" says: no open questions left, stage Awaiting approval.

## After to-tickets: the PRD reference

The `to-tickets` skill turns the PRD into tickets; use it as it is. Every ticket it creates then gets a **PRD reference**: the ids of the map items it came from, so Build can link the ticket to Plan and Plan can count the tickets per item. In the same turn as `to-tickets`:

1. Run `show` for the map's ids.
2. For each new ticket, pick the items it builds or must respect: features, decisions, notes, `excluded` items. A ticket that matches no item is a gap in the PRD: propose the item in the ticket's change first (and its `?` node on the map, when the human has not settled it), then name it. An item the change proposes is named too: `{{groundwork}} record show <id>` finds it.
3. Add the line, written exactly so:

   ```
   **PRD:** f-build-trace, d-trace
   ```

   Ids exactly as `show` prints them, separated by commas. In a GitHub issue it is the first line of the body (`gh issue edit <n> --body-file <file>`). In a local ticket file (`.scratch/<area>/issues/`) it is a line of its own under the title, before the first `##` section.

Done when every ticket `to-tickets` created carries a PRD line and every id on it appears in `show`. Build's Checks view lists the tickets that miss either.

## Human edits are authoritative

The prompt hook and `show` both report what the human changed in the browser. Act on these changes:

- **Map changes:**
  - Renamed or moved: keep the human's wording and structure.
  - Removed: do not put it back.
  - Added (`todo`): ask about it in the next round.
  - Status changed: treat it as the human's statement. `inferred` set to `decision` means confirmed.
- **The human's paragraphs** (shown as "the human's own PRD paragraphs"): never edit or repeat them. Adapt your prose so it neither contradicts nor duplicates them. If one conflicts with a later answer, ask about it in the next round instead of overriding it.
- **The human took over your text** (your `prose` was removed and reappears among their paragraphs): do not recreate it. Write only what is still missing from the section, or nothing.
- **The human's edits of the change's file** are theirs as well: read the file again before each write, and keep what they wrote. A question they removed is settled or dropped; a node they rewrote or moved on the map keeps their wording and place; an item they rewrote keeps their wording.
