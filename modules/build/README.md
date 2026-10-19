# Build module (prototype)

A live development dashboard for a project whose tickets, specs and decisions live in Markdown files. It reads the conventions of Matt Pocock's skills:

| Path | What it is |
|---|---|
| `.scratch/<area>/issues/<number>-<slug>.md` | one ticket per file |
| `.scratch/<area>/spec.md` | the area's spec |
| `docs/adr/*.md` | decision records |
| `GLOSSARY.md`, `GLOSSARY-MAP.md` | the domain glossary |
| `README.md` | the project's name (first heading) |

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
| `index.html` | the dashboard page; works on its own too (open it, pick the project folder; live only in Chromium browsers, and without the git view) |
| `module.mjs` | the manifest and the read-only endpoints under `/api/build/` |
| `project-reader.mjs` | reads the project: the Markdown files inside the root, and the git history |

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

It never writes. It serves only the page, the project's Markdown files inside the root and, in a git repository, the branch history; git is only asked to read.

The header comments of the files describe the formats in detail. The UI is in Hungarian for now; an English UI comes with the shared shell (roadmap step 2).
