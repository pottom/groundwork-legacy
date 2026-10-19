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
| `development-status.html` | the dashboard page; works on its own too (open it, pick the project folder; live only in Chromium browsers) |
| `development-status.mjs` | the launcher: a small read-only server for the project folder (Node.js 20+, built-in modules only) |

## Run

```bash
node modules/build/development-status.mjs --root .
```

| Option | Effect |
|---|---|
| `--root DIR` | the project to show; without it, the launcher shows its own folder |
| `--port N` | the first port to try (default 8641) |
| `--no-open` | do not open the browser |

It never writes. It serves only the page, the project's Markdown files and, in a git repository, the branch history.

The header comments of both files describe the formats in detail. The UI is in Hungarian for now; an English UI comes with the shared shell (roadmap step 2).
