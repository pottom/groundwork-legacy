# changes

The Changes module: the changes (C-n), what is taking shape between an idea and the Spec (C-3, [`docs/product/changes/C-003-a-valtozas-lapja-eloben.md`](../../docs/product/changes/C-003-a-valtozas-lapja-eloben.md)). Today a tab with the list of changes, grouped by stage; the change page comes next (#56).

| File | Role |
|---|---|
| `module.mjs` | the manifest: the tab, the view, the Change type in `records`, the live topic `changes.items`, and `GET /api/changes/list` |
| `type.mjs` | the Change record type (`CHANGE_TYPE`): its fields, lifecycle and rules. The module declares it, the core's record store keeps the files under `docs/product/changes/`. The body's Markdown (`changeBody`, `readChange`) stays in the core, `core/records/changes.mjs`, because the core reads it too |
| `stages.mjs` | the stage of a change and the row the list shows for it, shared with nothing in the browser (the server sends the rows ready) |
| `ui-strings.mjs` | the page's strings, English and Hungarian |
| `index.html`, `view/` | the page: Lit components (`view/changes-list.mjs`, `<gw-changes-list>`) with the core's `<gw-record-chip>` for the ideas and the milestone; Lit's import map in `index.html` |

## The stage

The two interview stages are computed from the change's questions (d-changes-stage-interview): a change with an open question is **Grilling**, one without is **Awaiting approval**, whatever its `status` says. The later stages, **Implementing**, **Done** and **Dropped**, still come from the `status` field until the merge (C-5) and the tickets (C-8) can compute them; so a change being implemented stays Implementing even with a question left open.

An open question is a top-level list item of the change's `## Kérdések` section (`- `, `* `, `1. `). A checked one, `- [x] …`, is answered; prose and indented lines are not questions. To close a question, check it or remove it.

## Public endpoints

None: no other module reads the Changes module yet. The page reads its own `GET /api/changes/list` and, for live updates, the topics `changes.items` (a change file) and `records` (the core's: an idea's or a milestone's title it shows).

## Without the module

The core has no Change type then: the change files are not records, a change id (C-3) is a plain id wherever it is linked, and the core's features that read changes find none. `groundwork record check` does not check their proposed items, and the ids a pending change proposes or a merged change lists do not resolve (so Plan's `GET /api/plan/ids` leaves them out and Build counts a ticket naming one as unknown). Everything else works (`modules/alone.test.mjs`).
