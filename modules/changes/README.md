# changes

The Changes module: the changes (C-n), what is taking shape between an idea and the Spec (C-3, [`docs/product/changes/C-003-a-valtozas-lapja-eloben.md`](../../docs/product/changes/C-003-a-valtozas-lapja-eloben.md)). A tab with the list of changes, grouped by stage, and each change's own page, which follows its file live, marks what changed since the last commit, and is where the human approves the change, merging it into the Spec.

| File | Role |
|---|---|
| `module.mjs` | the manifest: the tab, the view, the Change type in `records`, `writes` the Spec's folder (so the store lets it merge), the live topics `changes.items` and `changes.commit`, `GET /api/changes/list`, `GET /api/changes/show?id=C-3`, `POST /api/changes/approve?id=C-3` and `POST /api/changes/target?id=C-3` |
| `type.mjs` | the Change record type (`CHANGE_TYPE`): its fields, lifecycle and rules. The module declares it, the core's record store keeps the files under `docs/product/changes/`. The body's Markdown (`changeBody`, `readChange`) stays in the core, `core/records/changes.mjs`, because the core reads it too |
| `stages.mjs` | the stage of a change and the row the list shows for it (with `merged`, the core's answer), shared with nothing in the browser (the server sends the rows ready) |
| `page.mjs` | the change page as the server gives it: every part of the file (read through the core's patient `readChange`), its Markdown rendered, and the marks against a base version |
| `since.mjs` | the base of the marks: the change file at HEAD (`git show HEAD:./<file>`), or none without git or for an uncommitted file; which changed paths mean a commit |
| `compare.mjs` | what changed between two versions of a change, per part, question (by its text), proposed item (by its id) and node of the thought map (by its text); shared by the server (the marks) and the page (the flash), so it imports nothing |
| `thoughts.mjs` | the thought map on the page: the map's nodes flat, each known by its text (`flatThoughts`), the tree `<gw-mind-map>` draws (`mapTree`, removed nodes under their old parent), and the open questions with their options (`openQuestions`); shared by the server and the page, so it imports nothing |
| `ui-strings.mjs` | the page's strings, English and Hungarian |
| `index.html`, `view/` | the page: Lit components (`view/changes-list.mjs`, `<gw-changes-list>`; `view/change-page.mjs`, `<gw-change-page>`; `view/target-picker.mjs`, `<gw-target-picker>`, the searchable target list of Elsewhere…) with the core's `<gw-record-chip>` for the ideas and the milestone and `<gw-mind-map>` for the thought map; Lit's import map in `index.html`. `view/main.mjs` shows the list, or with `?change=C-3` that change's page |

## The stage

The two interview stages are computed from the change's open questions (d-changes-stage-interview, d-map-questions): a change with an open question is **Grilling**, one without is **Awaiting approval**, whatever its `status` says. The later stages, **Implementing**, **Done** and **Dropped**, still come from the `status` field until the merge (C-5) and the tickets (C-8) can compute them; so a change being implemented stays Implementing even with a question left open.

An open question is a `?` node of the change's thought map, at any depth. An older change may still have a `## Kérdések` list: its top-level list items (`- `, `* `, `1. `) count too, a checked one (`- [x] …`) is answered. Nothing new writes that list.

## The thought map

A change's thinking lives in its `## Gondolatok` section (`## Thoughts` is read too), a nested Markdown list (C-4, d-map-in-md). Indentation gives the branches, two spaces a level; the root is not stored, it is the change's title. The sign at the start of a line gives the node's kind, whatever the document's language:

| Sign | Kind |
|---|---|
| `?` | question: an open question of the change |
| `~` | option: a possible answer, a child of its question |
| `~!` | the option Claude recommends |
| `=` | decision |
| `!` | constraint |
| `x` | out of scope |
| (none) | a plain thought |

A node may end in `→ \`<id>\``: the proposed item it became, which the change's `## Javasolt elemek` must list. Its note is the lines indented under it, before its children; a note line starting with `- ` would read as a child.

```markdown
## Gondolatok

- ? Where does the map live?
  It must stay one file per change.
  - ~! In the change's Markdown
  - ~ In a file of its own
- = The root is the change's title → `d-map-root`
  - x A root stored apart
```

The reader is the core's (`core/records/changes.mjs`: `readChange` gives `thoughts`, `changeBody` writes them back canonically). `groundwork record check` reports an unknown sign (a first word like `?!` that is no sign), a `→` to an id the change does not propose, and a line not in the canonical form.

## The change page

A change opens from the list at the shell's deep link `/?module=changes&change=C-3`, so the address names it and a reload opens it again. Claude writes the file during the interview, the page shows it; the one write from the page is the approval (below). It follows its file live: when the file changes, the page reads it again and what the last write added or changed (a part, a node of the map, a proposed item) is tinted for a few seconds.

At the top is the workspace (d-map-workspace): the change's thought map on the left, read-only (the core's `<gw-mind-map>`, its root the change's title), and the open questions on the right, computed from the map: the latest on top (the ones new since the last commit first, then from the end of the file), each with its options and Claude's recommendation starred. A click on a question scrolls the map to its node. An older change's `## Kérdések` list shows in the panel too. A change awaiting approval, or one without a map, shows the workspace as one line (thought map · n nodes) that opens on a click. Below stay the description and the proposed items. The panel is a list of questions, each with a list of options, so answering from the page (C-7) can turn the options into buttons in place. A read that fails keeps the last good page, with a note.

What changed since the last commit is marked durably, on the map too (per node): new, modified, and removed (struck through, still shown until the next commit). The base is the file at HEAD in git, so nothing is remembered: the marks survive a reload and another machine, and go away on commit (a commit is the live topic `changes.commit`). The commit is heard from `.git/HEAD` and `.git/refs/heads/` under the project folder; in a project that is a subfolder of its repository, or a worktree (where `.git` is a file), the marks follow a commit at the next read instead (a reload, a reconnect, or the next write). Without git, or for a file not committed yet, there are no marks and no error.

## Approval

The proposed items are the approval list (C-5, d-approve-on-page): a row per item with its op, id, target and text, and an Approve button below while the change awaits approval or is implementing (C-3, C-4: d-merge-implementing) and is not merged yet. The button sends `POST /api/changes/approve?id=C-3` (JSON, `{ base }`: the version of the change the page shows), and the core's record store merges the change into the Spec as the human (`store.merge`, `core/records/merge.mjs`): every item at its target, with the change in its origin (`· C-1, C-7`), all or nothing (d-merge-atomic); an awaiting change moves to implementing, and its history gets a `merged` line. A change still grilling (an open question) is refused. When the merge is refused, nothing is written, and the page shows what is wrong next to each row at fault (the answer's `problems`, `[{ id, op, target, code, message }]`, by item id), until the change's next version. Whether a change is merged is computed by the core from the Spec, never stored (d-merged-computed: every item there with this change in its origin; `store.merged`); the page and the list rows carry it as `merged`, and a merged change shows Merged into the Spec instead of the button. Each row has Accept and, for a new item or section, Elsewhere… (d-approve-list-actions, d-move-writes-change). Accept is only a look: Approve takes every row that was not moved, and no row needs ticking. Elsewhere… opens a searchable list of targets (`view/target-picker.mjs`, the page's `targets`: `store.targets()`, the Spec's documents and sections, then those the pending changes propose, each marked with the change that brings it; a section goes into a document only). The pick is written into the change's file at once, `POST /api/changes/target?id=C-3` (JSON, `{ item, target, base? }` → `{ id, item, from, target, version }`; `store.move` as the human, `core/records/move.mjs`), so Claude sees it and it survives a reload; the store rewrites that item's line in the canonical form and adds a `moved d-a: old → new` history line. The moved row shows the old target struck through until the next commit (the page's `moved`, from the file at HEAD), and moved into a pending change's section it waits for that change. A change or supersede (found by its id), a document (its part is in its id) and a part do not move; a new part is not made on the page: Claude proposes one in chat. Changes merge in order (d-merge-in-order): while an item's target (or the item it changes or supersedes) is not in the Spec and another pending change brings it, the item waits for that change; `GET /api/changes/show` carries these as `waits` (`[{ id, waitsFor: 'C-3', on, title }]`, `store.waits`), the page shows "Waits for C-3" (a link to that change) next to the row and a note instead of the Approve button, and the server refuses such a merge too (problem code `waiting`, with `waitsFor`). Once C-3 is merged, the waiting change can be approved. Claude cannot merge: the command line has no merge, and the store refuses any writer but the human.

## Public endpoints

None: no other module reads the Changes module yet. The page reads its own `GET /api/changes/list` and `GET /api/changes/show`, writes through its own `POST /api/changes/approve` and `POST /api/changes/target`, and, for live updates, the topics `changes.items` (a change file), `changes.commit` (a commit) and `records` (the core's: an idea's or a milestone's title it shows).

## Without the module

The core has no Change type then: the change files are not records, a change id (C-3) is a plain id wherever it is linked, and the core's features that read changes find none. `groundwork record check` does not check their proposed items, and the ids a pending change proposes or a merged change lists do not resolve (so Plan's `GET /api/plan/ids` leaves them out and Build counts a ticket naming one as unknown). Everything else works (`modules/alone.test.mjs`).
