# changes

The Changes module: the changes (C-n), what is taking shape between an idea and the Spec (C-3, [`docs/product/changes/C-003-a-valtozas-lapja-eloben.md`](../../docs/product/changes/C-003-a-valtozas-lapja-eloben.md)). A tab with the list of changes, grouped by stage, and each change's own page, read-only, which follows its file live and marks what changed since the last commit.

| File | Role |
|---|---|
| `module.mjs` | the manifest: the tab, the view, the Change type in `records`, the live topics `changes.items` and `changes.commit`, `GET /api/changes/list` and `GET /api/changes/show?id=C-3` |
| `type.mjs` | the Change record type (`CHANGE_TYPE`): its fields, lifecycle and rules. The module declares it, the core's record store keeps the files under `docs/product/changes/`. The body's Markdown (`changeBody`, `readChange`) stays in the core, `core/records/changes.mjs`, because the core reads it too |
| `stages.mjs` | the stage of a change and the row the list shows for it, shared with nothing in the browser (the server sends the rows ready) |
| `page.mjs` | the change page as the server gives it: every part of the file (read through the core's patient `readChange`), its Markdown rendered, and the marks against a base version |
| `since.mjs` | the base of the marks: the change file at HEAD (`git show HEAD:./<file>`), or none without git or for an uncommitted file; which changed paths mean a commit |
| `compare.mjs` | what changed between two versions of a change, per part, question (by its text) and proposed item (by its id); shared by the server (the marks) and the page (the flash), so it imports nothing |
| `ui-strings.mjs` | the page's strings, English and Hungarian |
| `index.html`, `view/` | the page: Lit components (`view/changes-list.mjs`, `<gw-changes-list>`; `view/change-page.mjs`, `<gw-change-page>`) with the core's `<gw-record-chip>` for the ideas and the milestone; Lit's import map in `index.html`. `view/main.mjs` shows the list, or with `?change=C-3` that change's page |

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

A change opens from the list at the shell's deep link `/?module=changes&change=C-3`, so the address names it and a reload opens it again. Nothing on it writes: Claude writes the file during the interview, the page shows it. It follows its file live: when the file changes, the page reads it again and what the last write added or changed (a part, a question, a proposed item) is tinted for a few seconds. A read that fails keeps the last good page, with a note.

What changed since the last commit is marked durably: new, modified, and removed (struck through, still shown until the next commit). The base is the file at HEAD in git, so nothing is remembered: the marks survive a reload and another machine, and go away on commit (a commit is the live topic `changes.commit`). The commit is heard from `.git/HEAD` and `.git/refs/heads/` under the project folder; in a project that is a subfolder of its repository, or a worktree (where `.git` is a file), the marks follow a commit at the next read instead (a reload, a reconnect, or the next write). Without git, or for a file not committed yet, there are no marks and no error.

## Public endpoints

None: no other module reads the Changes module yet. The page reads its own `GET /api/changes/list` and `GET /api/changes/show` and, for live updates, the topics `changes.items` (a change file), `changes.commit` (a commit) and `records` (the core's: an idea's or a milestone's title it shows).

## Without the module

The core has no Change type then: the change files are not records, a change id (C-3) is a plain id wherever it is linked, and the core's features that read changes find none. `groundwork record check` does not check their proposed items, and the ids a pending change proposes or a merged change lists do not resolve (so Plan's `GET /api/plan/ids` leaves them out and Build counts a ticket naming one as unknown). Everything else works (`modules/alone.test.mjs`).
