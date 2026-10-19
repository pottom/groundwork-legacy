# Build module (prototype)

A live development dashboard for a project whose tickets, specs and decisions live in Markdown files. It reads the conventions of Matt Pocock's skills:

| Path | What it is |
|---|---|
| `.scratch/<area>/issues/<number>-<slug>.md` | one ticket per file |
| `.scratch/<area>/spec.md` | the area's spec |
| `docs/adr/*.md` | decision records |
| `GLOSSARY.md`, `GLOSSARY-MAP.md` | the domain glossary |
| `README.md` | the project's name (first heading) |

On the core server it also reads the project's **GitHub issues** as tickets, when the `origin` remote is on GitHub: the state (closed, or the open issue's state label such as `ready-for-agent`, else `needs-triage`: an issue nobody has labelled yet waits for a human to triage it), the labels, the milestone (shown as the ticket's area) and "Blocked by" (GitHub's own dependency links, or a "Blocked by" line or `## Blocked by` section in the body). The server asks GitHub through the `gh` CLI when it is installed, else the REST API with `GITHUB_TOKEN` (or `GH_TOKEN`), else the REST API without a token (public repositories only); no token ever reaches the page. Answers are kept for a minute. Local tickets and issues can be mixed, and name each other (`#12`, `core 3`).

A ticket may name the PRD items (the ids of Plan's map nodes) it came from, on a line of its own near the top: `**PRD:** f-build-trace, d-trace`. Build shows these ids on the ticket and in its details; on the server each one is a link that opens Plan with that item focused and highlighted (`/?module=plan&node=<id>`). The ticket reader keeps them as `ticket.prd` and lists the tickets per id in `model.byPrd`. A line that is only a dash, `none` (`nincs`, `n/a`) or a remark in parentheses, such as `**PRD:** — (no decision yet)`, says the ticket deliberately has no PRD item: `ticket.prdNone`, no ids, and no "missing PRD" warning. Only words that look like map ids (with a hyphen, an underscore or a digit) count as ids; a remark in parentheses never does.

The Checks view lists an open ticket without a PRD line, and a ticket naming an id that is not on the map. The map's ids come from Plan (`GET /api/plan/ids`, only the ids, `?v=` answers "same" while the map is unchanged). Without a map no id counts as unknown, and a missing PRD line counts only once some ticket has one. Claude adds the line after `to-tickets` (see the groundwork-prd-maker skill).

A ticket may also name the sketches it goes with, on a line of its own: `**Sketch:** checkout-flow, main` (Sketch's names; a remark in parentheses is not one). Build shows them on the ticket and in its details, each a link that opens the sketch in the shell (`/?module=sketch&sketch=<name>`; a name the sketch had before a rename still finds it). The ticket reader keeps them as `ticket.sketches`. The other way, a sketch's link to a ticket opens Build with that ticket in the drawer: `/?module=build&ticket=<ref>`, the ref `#34`, an area and number (`core 3`) or the ticket's path (`findTicket(model, ref)`).

Plan shows, on each map item, how many tickets name it and how many of them are done; it gets the counts from `/api/build/prd`, which reads the tickets on the server with the same `ticket-reader.mjs` (`project-tickets.mjs`). Clicking the count opens Build with only that item's tickets, closed ones too (`/?module=build&prd=<id>`; the filter shows above the list and can be cleared).

## The page

The page uses the shell's design system (`/shell/theme.css`: the `--gw-*` tokens and the `.gw-*` components). Inside the shell it shows no bar of its own: the shell's header already shows the project, whether the page is live, the version and the language. Opened alone (`/build/`) it has a slim bar with those. What the page does by itself (it read something again, nothing changed) shows as a toast that goes away; a stopped server shows as a notice above the overview. Build needs the core server: it has no mode opened from a file.

The "Waiting on" view opens with one overview strip: open tickets, ready to write, waiting for a human, blocked, and the share of closed tickets under them. Each open ticket counts in exactly one bucket (the reader's `waitingOn`): a ticket waiting for an open ticket is blocked whatever its status, so the numbers match the sections below, which list every open ticket once. Status labels show by a translated name (`ready-for-agent` is "Ready for agent"), the label itself in the tooltip. Each view shows only the filters it applies; the filters in force show as removable pills, and none of them survives a reload.

It shows the following views:

- tickets and areas;
- dependencies ("Blocked by");
- activity;
- inconsistencies;
- documents;
- the git branch graph.

On the core server the page follows the core's live updates through `subscribe` from `/shell/live.mjs` (inside the shell the shell's one stream, opened alone its own `/api/events`): it reads again only what changed (`build.files` the Markdown files, `build.git` the history, `build.issues` the issues, `plan.map` the map ids, all in parallel) when a Markdown file, a git ref, Plan's map or the GitHub issues change (the server asks GitHub afresh once a minute while a page listens, so a change on GitHub shows within a minute), and on every reconnect.

| File | Role |
|---|---|
| `index.html` | the dashboard page, only its skeleton: the theme, `build.css` and `page/main.mjs` |
| `build.css` | the page's layout on the shell's design system |
| `page/main.mjs` | the page's start: what its controls do, the address (`#/<view>/<document>`), the keyboard, the language |
| `page/config.mjs` | the fixed values: the server, the timings, the views and their filters, the ticket reader |
| `page/text.mjs` | the words: the translation, `tx()` for a translated text with templates in it, status names, dates |
| `page/state.mjs` | what the page holds: the view and the filters (`state`), what it read (`app`), which tickets the filters let through |
| `page/server.mjs`, `page/folder.mjs` | reading the project from the core server's `/api/build/`: the listing as a tree, and the tracker and ADR folder in it |
| `page/refresh.mjs` | reading it again when it changed: the files, the issues, Plan's map ids and git, in parallel; the live updates |
| `page/render.mjs` | puts the views into the skeleton's parts; the drawer's focus, the toasts |
| `page/parts.mjs` | the small templates the views share: icons, badges, ticket links, section heads, empty states |
| `page/views/*.mjs` | the views as lit-html templates: `chrome` (bar, start screen, tabs, filters), `overview` (notices, numbers), `tickets` (Waiting on, Areas), `deps`, `activity`, `docs` (Checks, Documents), `git`, `drawer` |
| `page/markdown.mjs` | the Markdown renderer for the drawer: every piece of text escaped, its output the only HTML shown through `unsafeHTML` |
| `ticket-reader.mjs` | the ticket reader, shared by the page and the server: `readTickets(source)` turns a ticket source (the Markdown files, the GitHub issues, or both) into the model every view draws; the format is at its top |
| `ui-strings.mjs` | the UI strings (`BUILD_STRINGS`), English and Hungarian; no markup, code in backticks |
| `module.mjs` | the manifest and the read-only endpoints under `/api/build/` |
| `project-reader.mjs` | reads the project: the Markdown files inside the root, and the git history |
| `project-tickets.mjs` | the tickets read on the server with `ticket-reader.mjs`, and per PRD item how many name it and how many are done (for Plan) |
| `github-source.mjs` | fetches the GitHub issues on the server (with their dependency links), in the shape the ticket reader takes |

## Run

```bash
npx @pottom/groundwork                          # in the project folder; then Build at http://localhost:4477/build/
```

| Endpoint | Answer |
|---|---|
| `GET /api/build/hello` | the handshake the page checks |
| `GET /api/build/list` | every Markdown file (path, size, time) and each folder's count of other files |
| `GET /api/build/file?path=P` | the text of a listed file |
| `GET /api/build/git?limit=N&known=F` | branches, tags and commits, when the root is the top of a git repository |
| `GET /api/build/issues?known=F` | the GitHub issues of the `origin` repository, or `{ available: false, reason }` |
| `GET /api/build/prd` | `{ items: { <id>: { total, done, tickets } } }`: per PRD item, the tickets naming it (a dropped one, wontfix or legacy, does not count; done, resolved and closed are done) |

### Public endpoints

Other modules may read only these (the manifest's `public`, see [`modules/README.md`](../README.md#reading-another-module)):

| Endpoint | Who reads it |
|---|---|
| `GET /api/build/prd` | Plan, for the ticket counts on the map |

Build itself reads only Plan's `GET /api/plan/ids`. A ticket's sketches come from its own `**Sketch:**` line, so Build reads nothing of Sketch. Without Plan (or without a map) the Checks view counts no PRD id as unknown and the ids on a ticket show as plain tags instead of links into Plan.

It never writes. It serves only the page, the project's Markdown files inside the root, in a git repository the branch history, and the GitHub issues of its origin; git and GitHub are only asked to read.

The header comments of the files describe the formats in detail. The UI is in English, with a Hungarian translation (the strings are `BUILD_STRINGS` in `ui-strings.mjs`, translated by the shell's `/shell/i18n.mjs`). Inside the shell it follows the shell's language; opened alone it has its own language picker. The strings hold no markup: a piece of code is written in backticks and the page shows it as `<code>` (`tx()` in `page/text.mjs`).

The page's own code is small ES modules under `page/`, which render with lit-html templates (`/vendor/lit-html/`, in `core/vendor/`) on the shell's `.gw-*` components; no view builds HTML strings, except the Markdown renderer, whose escaped output the drawer shows through lit's `unsafeHTML`. `index.html` loads `page/main.mjs`; there is no build step.

## Conventions in detail

A ticket's fields are read near the top of the file, in any of these forms: `**Status:** ready-for-agent`, `Status: ready-for-agent`, `- **Status:** …` (the local format of the `/to-tickets` skill puts `**Blocked by:**` before `**Status:**`; the order does not matter). "Blocked by" may also be a `## Blocked by` heading with a list under it (the issue template's form), and it may name tickets by number (`01`, `#12`, `area 3`), by file name (`01-some-slug`) or by title; "None (can start immediately)" means none. Comments go under `## Comments`; a heading with a date (`### 2026-10-14 …`) is one comment. The tracker folder is `.scratch` by default (`DEFAULT_TRACKER_DIR` in `ticket-reader.mjs`); without it, the first folder whose subfolders hold `issues/`.

## History

Since the npm package Build has no version of its own: it ships with Groundwork and carries the package's version. Before that:

| Version | Date | What came |
|---|---|---|
| 1.0.0 | 2026-10-18 | the first numbered version: tickets, areas, dependencies, activity, inconsistencies, documents, and the git branch graph |
| 2.0.0 | 2026-10-19 | served by the Groundwork core server: the endpoints moved to `/api/build/` |
| 2.1.0 | 2026-10-19 | the shared look: colours and fonts from the shell's theme; light or dark follows the system |
| 2.2.0 | 2026-10-19 | English UI with a Hungarian translation, following the shell's language |
| 2.3.0 | 2026-10-19 | GitHub issues as tickets; reading the tickets moved into `ticket-reader.js` |
| 2.4.0 | 2026-10-19 | a ticket's `**PRD:**` line shows as links that open Plan on those map nodes |
| 2.5.0 | 2026-10-19 | checks: a ticket without a PRD line, or naming an id that is not on Plan's map |
| 2.6.0 | 2026-10-19 | live updates (Server-Sent Events) instead of polling; `?prd=<id>` shows only that PRD item's tickets |
| Groundwork 0.1.0 | 2026-10-19 | the package's version from here on |
