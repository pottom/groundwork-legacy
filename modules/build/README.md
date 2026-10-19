# Build module (prototype)

A live development dashboard for a project whose tickets, specs and decisions live in Markdown files. It reads the conventions of Matt Pocock's skills:

| Path | What it is |
|---|---|
| `.scratch/<area>/issues/<number>-<slug>.md` | one ticket per file |
| `.scratch/<area>/spec.md` | the area's spec |
| `docs/adr/*.md` | decision records |
| `GLOSSARY.md`, `GLOSSARY-MAP.md` | the domain glossary |
| `README.md` | the project's name (first heading) |

On the core server it also reads the project's **GitHub issues** as tickets, when the `origin` remote is on GitHub: the state (closed, or the open issue's state label such as `ready-for-agent`, else `open`), the labels, the milestone (shown as the ticket's area) and "Blocked by" (GitHub's own dependency links, or a "Blocked by" line or `## Blocked by` section in the body). The server asks GitHub through the `gh` CLI when it is installed, else the REST API with `GITHUB_TOKEN` (or `GH_TOKEN`), else the REST API without a token (public repositories only); no token ever reaches the page. Answers are kept for a minute. Local tickets and issues can be mixed, and name each other (`#12`, `core 3`).

It shows the following views:

- tickets and areas;
- dependencies ("Blocked by");
- activity;
- inconsistencies;
- documents;
- the git branch graph.

The page re-reads the files every few seconds.

| File | Role |
|---|---|
| `index.html` | the dashboard page; works on its own too (open it from this folder, pick the project folder; live only in Chromium browsers, and without the git view) |
| `ticket-reader.js` | the ticket reader: `GroundworkTickets.readTickets(source)` turns a ticket source (the Markdown files, the GitHub issues, or both) into the model every view draws; the format is at its top |
| `ui-strings.js` | the UI strings (`BUILD_STRINGS`), English and Hungarian |
| `i18n.js` | a copy of `core/shell/i18n.mjs` without `export`; do not edit it here |
| `module.mjs` | the manifest and the read-only endpoints under `/api/build/` |
| `project-reader.mjs` | reads the project: the Markdown files inside the root, and the git history |
| `github-source.mjs` | fetches the GitHub issues on the server (with their dependency links), in the shape the ticket reader takes |

## Run

```bash
node core/groundwork.mjs --root .       # then open http://localhost:4477/build/
```

| Endpoint | Answer |
|---|---|
| `GET /api/build/hello` | the handshake the page checks |
| `GET /api/build/list` | every Markdown file (path, size, time) and each folder's count of other files |
| `GET /api/build/file?path=P` | the text of a listed file |
| `GET /api/build/git?limit=N&known=F` | branches, tags and commits, when the root is the top of a git repository |
| `GET /api/build/issues?known=F` | the GitHub issues of the `origin` repository, or `{ available: false, reason }` |

It never writes. It serves only the page, the project's Markdown files inside the root, in a git repository the branch history, and the GitHub issues of its origin; git and GitHub are only asked to read.

The header comments of the files describe the formats in detail. The UI is in English, with a Hungarian translation (the strings are `BUILD_STRINGS` in `ui-strings.js`). Inside the shell it follows the shell's language; opened alone it has its own language picker. The translation mechanism is `i18n.js`, a copy of `core/shell/i18n.mjs`: opened by double click (`file://`) there is no `/shell/` and the browser refuses ES module imports, but classic `<script src>` files beside the page still load. So `index.html`, `i18n.js`, `ui-strings.js` and `ticket-reader.js` stay together in this folder, and none of them may become a module. `ui-strings.test.mjs` keeps the copy equal to the original.
