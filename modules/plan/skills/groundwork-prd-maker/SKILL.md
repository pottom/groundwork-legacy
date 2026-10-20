---
name: groundwork-prd-maker
description: Turns a grilling interview into product documentation: a PRD, a technical design, and for systems and services also overview, service, process, operations and rollout documents. While you talk, it draws a live mind map and writes the Spec documents under docs/product/spec/, all visible and editable in the browser pane. Works for new and for half-finished projects. Load it alongside grilling, grill-me or grill-with-docs, whenever the user wants a PRD, a spec of a system or service, or mentions the mind map, and after to-tickets has made tickets from the PRD.
---

The deliverables are the Spec: Markdown documents under **`docs/product/spec/`**. The Markdown is the source. The mind map is how the human follows along: at any moment it shows where the interview stands and what has been covered. The map is a view of the Spec files, so a file edited by hand shows on the map at once.

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

## Session flow

1. **Start.** If `docs/product/spec/` is missing, run `init`. Start the core server: with `preview_start` when `.claude/launch.json` has a `groundwork` configuration, otherwise run `{{groundwork}} --no-open` in the background (it prints its address; `--port N` picks another port when 4477 is taken). Open `/plan/`.

   Set the document language to the language of the conversation: `{"op":"set","id":"root","lang":"…"}`. `show` prints it on the root line. A map without one is Hungarian (`hu`). Every fixed text of the documents (subtitle, state marks, closing sections) and the starting sections from `kinds` are then in that language, so the map's own labels and prose must be in it too. The languages there are: `hu`, `en` (the usage line of `{{groundwork}} plan` lists them). If the conversation is in a language with no strings, use `en` and say so. If the conversation switches language for good, change it and translate the map's labels and prose.
2. **Existing project?** If there is already code or documentation, read it before asking anything. Dispatch a sub-agent for a thorough analysis:
   - the product: README, specs, glossary, docs;
   - every ADR in `docs/adr/`, with its state;
   - feature specs in `.scratch/*/spec.md`;
   - non-goals in `.out-of-scope/`;
   - the technology stack and the architecture;
   - the features, with their implementation state;
   - the inconsistencies between docs and code.

   Draw the result as `inferred` items with `impl` and evidence `link`s. Draw the inconsistencies as `todo` items. The first grilling round then confirms the inferred items, document by document; only after that move on to what is missing.
3. **What are we building?** The first real question decides the structure: a software product, a system, a service, or a mix, and which parts it consists of. From the answer, propose the components, their documents and the documents' sections. Ask the human to confirm or change them, in chat or on the map.
4. **Steer by the documents.** The grilling frontier must cover every section of every document. Prefer questions that fill untouched or thin sections, since the progress bars show the human exactly what is missing.
5. **Each round.** Ask the round in chat; the map does not change yet. When the answers arrive, in the same turn and before the next round:
   1. Update the map items.
   2. Rewrite the `prose` of every section the answers touched. Write it as the section reads **now**: complete, polished text, not a log of the conversation. The prose gives the context, the reasoning and the scenarios. The list under it holds the atomic decisions, so do not repeat them one by one. Use Markdown, in the language of the conversation, typically one to three short paragraphs.
   3. Set `progress: "done"` on a section once your design tree has nothing left open in it.
6. **ADRs and glossary (grill-with-docs).** domain-modeling writes ADRs to `docs/adr/` and terms to `GLOSSARY.md`. groundwork-prd-maker does not write them itself. When an ADR appears, add it to the Decision log section and set `link` on the matching decision. The glossary is shown automatically in the PRD and the overview.
7. **Finish.** When the frontier is empty, make a final pass:
   - Reread every section's prose so each document reads as one coherent whole, and the documents agree with each other.
   - Mark every section `done`.
   - Tell the human the documents are ready under `docs/product/spec/`, and offer to publish them as shareable documents.

## After to-tickets: the PRD reference

The `to-tickets` skill turns the PRD into tickets; use it as it is. Every ticket it creates then gets a **PRD reference**: the ids of the map items it came from, so Build can link the ticket to Plan and Plan can count the tickets per item. In the same turn as `to-tickets`:

1. Run `show` for the map's ids.
2. For each new ticket, pick the items it builds or must respect: features, decisions, notes, `excluded` items. A ticket that matches no item is a gap in the PRD: add the item to the map first (as `todo` when the human has not settled it), then name it.
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
