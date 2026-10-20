# Ideas module

Numbered ideas, each with its author and source, on a kanban: New · Considering · Accepted · Rejected · Snoozed · Duplicate. The first step of the flow: an idea that is worth it is accepted, which opens a change (C-n) from it, and, when it is an engineering one, may become a ticket. Spec: [`docs/product/spec/ideas/PRD.md`](../../docs/product/spec/ideas/PRD.md), [`TECH.md`](../../docs/product/spec/ideas/TECH.md).

Ideas are records of the core's record store (`core/records/`): the manifest declares the record type `I` (`records`, `IDEA_TYPE` in `store.mjs`) and the store reads, numbers and writes the files; Ideas itself writes nothing. Each idea is one Markdown file under `docs/product/ideas/`, in git: `I-012-quick-tab-switching.md`, its `id: I-12` and fields in a front matter of flat `key: value` lines (`title`, `author` claude|human, `source`, `kind` product|engineering, `impact` and `effort` low|medium|high with a one-line `rationale`, `links` to similar ideas, map nodes or tickets (comma-separated), `status`, `reason` when rejected, `until` (a date) when snoozed, `duplicate` (I-n) when a duplicate, `created`), its description below, and at the end a `## Történet` list: one line per move or link change (`2026-10-20 · human · status: considering → accepted`), which the store appends. People say `I-12`. Numbers are never reused, also after a file is deleted. Other files in the folder are not ideas (Plan's documents live in the Spec, under `docs/product/spec/`). `groundwork record show I-12` prints an idea with its history and what refers to it.

From the command line (what Claude uses):

```
groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>] [--kind product|engineering]
                      [--impact low|medium|high] [--effort low|medium|high] [--rationale <one line>] [--links I-3,I-7]
groundwork ideas similar "<text>"     the likely duplicates, closest first, with a score 0..1
groundwork ideas list
groundwork ideas move I-12 new|considering
```

An idea by `--author claude` must say its source and carry an estimate (impact, effort, rationale); `--links` must name existing ideas. `groundwork init` installs the `groundwork-ideas` skill (`skills/groundwork-ideas/`), which tells Claude to file side observations this way: `similar` first, then link instead of duplicating.

**Accepting** opens a change (C-6: d-accept-in-core, d-route-choice): a move to Accepted (drag and drop or the move menu; the drawer does not offer it) asks the route, Grilling or Straight to a ticket, defaulted by the idea's kind (product → Grilling, engineering → Straight to a ticket; `routeFor` in `fields.mjs`), and `POST /api/ideas/accept` calls the core's `store.accept` as the human, which writes the idea and the new change together, all or nothing (`core/records/accept.mjs`). The Grilling route's change starts in Grilling with the idea's title, its text as the Probléma and the idea in its `ideas`; Straight to a ticket's change is a minimal one, in Implementing at once (the acceptance is its approval) with no proposed items (d-direct-ticket), and the board then copies the prompt for Claude that writes its ticket; a refusal shows in the dialog. A plain save that moves an idea to Accepted is refused (code `accept`). The card then shows a one-line summary of each change that names the idea (d-idea-summary), a link to the change's page: `→ C-12 · Implementing, 4 items in the Spec · 2/5 tickets done` (`summary.mjs`, `view/changes.mjs`). Nothing is kept by hand. The server computes each change on every read of the list (`changes: [{ id, title, status, stage, merged, items, inSpec }]`): its stage is the one the Changes page shows (the core's `core/records/stage.mjs`: open questions → Grilling, none → Awaiting approval, the later stages from the status), and `items`/`inSpec` are how many items it proposes and how many of them are in the Spec (the core's `store.inSpec`, the check behind `store.merged`). The ticket counts come from Build's public `GET /api/build/changes` (the tickets' `**Change:** C-12` lines, a dropped one not counted), read by the page beside the idea's tickets, so the list never waits for GitHub; without Build, or before any ticket names the change, the line has no ticket part. The Spec part shows once an item is there (`2 of 4 items in the Spec` until all are). The card follows it live: a change or Spec file is the core's topic `records`, Build's tickets `build.files` and `build.issues`. The look waits for the UI plan (I-12).

Claude adds and refines, the human decides (d-ideas-human-decides, d-ideas-ai-limits): the record store lets the command (Claude) move an idea only between New and Considering, and refuses the other columns with a message saying they are set in the browser. On the board a card opens in a drawer where every field can be edited, moves by drag and drop or by its move menu (keyboard: arrow keys, Enter, Escape), and a move to Rejected asks for a reason, which the card then shows; a move to Snoozed or Duplicate opens the drawer for the date or the idea it repeats. Each save is made on the version of the file the page saw; if it changed meanwhile the save is refused (409) and the page shows the newer version. A switch above the board (remembered by the browser) shows the open ideas (New and Considering) instead as an impact–effort matrix: quick wins (high impact, low effort) highlighted, big bets, fill-ins, time sinks, and an Unestimated strip for ideas without both values. A Medium estimate counts as the less favourable half (low impact, high effort), so only a sure quick win shows as one. Moving a card to another quadrant (drag and drop or its move menu) sets the half that differs to High or Low. The board follows the files live (topic `ideas.items`), and a new idea is tinted for a moment when it arrives.

A card may carry quiet marks, neutral badges that only tell: "Date passed" on a snoozed idea whose `until` has passed (it stays Snoozed until the human brings it back, d-snooze-manual), and "Old" on an idea in Considering for more than 90 days, counted from the last history line that moved it there, else from `created` (d-stale-quiet). The server computes them on each read (`marks.mjs`, the `marks` of each idea in the list and a save's answer); no file changes, nothing moves, and the tab's attention count includes none of them (Ideas names no `attention` endpoint).

An idea in Accepted whose latest change is implementing (Straight to a ticket, or a grilled change once approved), or an **engineering** one accepted before changes, with none, becomes a ticket (d-ideas-ticket-line): its card offers "Make a ticket", which copies a ready prompt for Claude (`ticket.mjs`); Claude, following the skill, creates the GitHub issue with an `**Idea:** I-12` line among its first lines, and a `**Change:** C-7` line when the idea has a change. Build reads that line and shows the idea as a link on the ticket (`/?module=ideas&idea=I-12`, which opens the idea in the drawer), and the card shows the ticket's number and state, read from Build's public `GET /api/build/ideas` (again when Build's tickets change). Without Build the card shows no tickets, and the button still copies the prompt.

| File | What it is |
|---|---|
| `module.mjs` | the manifest, `GET /api/ideas/list`, `PUT /api/ideas/item/<id>` and `POST /api/ideas/accept?id=<id>` |
| `store.mjs` | the record type I the manifest declares (fields, lifecycle, rules), and the ideas on the core's record store: list (with the changes that name each idea, their stage and Spec items computed), add, update (checked values, versioned), accept |
| `fields.mjs` | the values of the fields and the number formats, shared by the server and the page |
| `ideas.mjs` | `groundwork ideas add|similar|list|move` |
| `matrix.mjs` | the impact–effort matrix: which quadrant an idea sits in, the estimate a move sets; shared by the page and the tests |
| `summary.mjs` | an accepted card's line per change: its stage, its items in the Spec, its tickets done; shared by the page and the tests |
| `marks.mjs` | an idea's quiet marks at a given time (snooze date passed, old in Considering), computed on each read |
| `similar.mjs` | the likely duplicates of a text: word overlap with each idea's title and description, no dependencies |
| `skills/groundwork-ideas/` | the skill `groundwork init` installs for Claude |
| `index.html` | the page: a thin skeleton; `view/main.mjs` is its entry |
| `view/main.mjs` | the page's state and actions: reading, saving, moving, the Kanban / Matrix switch, the dialogs, toasts |
| `view/board.mjs` | the kanban, as lit-html templates on the shell's `.gw-*` components: drag and drop, the move menu |
| `view/matrix.mjs` | the matrix view: four quadrants and the Unestimated strip, drag and drop, the move menu |
| `view/drawer.mjs` | the drawer: one idea, every field editable |
| `view/reject.mjs` | the reason a move to Rejected asks for |
| `view/accept.mjs` | the route a move to Accepted asks for |
| `view/changes.mjs` | an accepted card's changes, each its summary line and a link to its page |
| `view/api.mjs` | the page's calls: list the ideas, save one, accept one, each idea's tickets and each change's ticket counts from Build |
| `view/tickets.mjs` | a card's tickets (number and state), or its "Make a ticket" button |
| `ticket.mjs` | which idea may become a ticket, and the prompt for Claude that makes it |
| `view/links.mjs` | which of an idea's links are map nodes, and Plan's deep link to them |
| `view/strings.mjs`, `ui-strings.mjs` | the UI text, English and Hungarian |
| `view/ideas.css` | the layout of the board, the menu and the dialogs |

Ideas no longer sends ideas to Plan's map (C-2): accepting opens a change instead (above). A card still links to the map nodes among its links (a link that is not an idea, a ticket or an address is a map node).

A card shows the sketches that link to its idea ("Sketch: <name>"), each opening that sketch in the shell; Ideas reads them from Sketch's public `GET /api/sketch/links` and follows them live (topic `sketch.links`). Without Sketch the cards show none, with no error.

## Public endpoints

None yet; other modules read ideas through the core's `GET /api/records`. Ideas itself uses Build's `GET /api/build/ideas` and `GET /api/build/changes`, and Sketch's `GET /api/sketch/links`.
