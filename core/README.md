# core

The shared core of Groundwork. It holds what every module uses.

| File | Role |
|---|---|
| `groundwork.mjs` | the command and the package's bin: `npx groundwork [--root DIR] [--port N] [--no-open]` (or `node core/groundwork.mjs ...` in this repo). It stops with a clear message under Node.js 20, then loads `start.mjs`; it is kept free of newer syntax so an old Node gets that far |
| `start.mjs` | starts the server for the project (the current folder by default), prints the addresses and opens the start page in the browser (`--no-open` skips it) |
| `version.mjs` | `VERSION`: Groundwork's one version, read from `package.json`; the modules' manifests carry it and the shell shows it in the header |
| `cli-process.mjs` | runs the command for the tests (`startCommand`) and stops its whole process tree |
| `server.mjs` | `startServer({ root, modules, port })`, async: resolves to `{ port, url, close() }` once listening (`port: 0` picks a free one) and rejects a module whose id is reserved (`api`, `shell`, `vendor`). The local server: the shell at `/`, `/api/modules`, each module's view under `/<id>/` and endpoints under `/api/<id>/` |
| `shell/` | the shell and the shared look: `shell.mjs` renders the start page on the server (header with the project's name, navigation built from the manifests, the chosen module's view in a frame; `/?module=<id>` picks one, and the rest of the query goes on to its frame, so `/?module=plan&node=d-trace` shows `/plan/?node=d-trace`: a module's deep link); `theme.css` holds the shared style variables (`--gw-*`, documented at its top), light or dark following the OS; `shell.css` lays out the shell page; `i18n.mjs` is the UI translation (English by default, Hungarian too; the language picker in the header switches the shell and the module's frame, and the choice survives a reload), with the shell's own strings in `strings.mjs`. Of these, only `theme.css`, `shell.css`, `i18n.mjs` and `strings.mjs` are served at `/shell/`; `shell.mjs` runs in the server and is never sent to the browser |
| `events.mjs` | the live updates: `GET /api/events` is a Server-Sent Events stream. The core watches the project folder (`fs.watch`, recursive); each module's manifest `watch(path)` names the topic of a changed file (`plan.map`, `build.files`, `build.git`, ...), and a module can push one itself (`events.publish(topic)`, or `events.every(ms, fn)` to check something on an interval while a page listens: Build asks GitHub afresh every minute and pushes `build.issues`). A `change` event carries `{ topics }` only, never content: the page asks its endpoints again. Topics within 150 ms go out as one event. On connect the stream sends `retry: 2000` and a `hello` event; EventSource reconnects by itself, and the pages read everything again on each `hello`, so a change missed while disconnected is not lost. Plan and Build follow it instead of polling; Build opened as a file (`file://`) has no server and still re-reads its folder every 3 s |
| `sse-client.mjs` | a small SSE client for the tests (`listen(port)`) |
| `modules.mjs` | the list of modules the server loads: Plan (`/plan/`) and Build (`/build/`) |
| `files.mjs` | the writer each module gets: reads inside the project, writes only under the folders its manifest names (`docs/product/` and `.groundwork/` at most) |
| `http.mjs` | small helpers for the modules' endpoints (`send`, `readJson`) |
| `vendor/` | the browser-side dependencies (Mind Elixir, marked, the Inter and Source Serif 4 fonts), served at `/vendor/...`; versions and licenses in [`vendor/README.md`](vendor/README.md) |
| `offline.test.mjs` | checks that no page loads anything from another host |
| `cli.test.mjs`, `package.test.mjs` | the command as a process (a project folder, the Node version check, the bin's LF line ends), and the npm package: its file list, and the packed tarball installed outside the repo and started with `npx groundwork` |

The npm package (`package.json` `files`) holds `core/` and `modules/` without the tests and test helpers; `docs/`, `.claude/` and everything else stay out. `.gitattributes` keeps LF line ends on every OS, so a package packed on Windows still runs on macOS and Linux.

The server listens on `127.0.0.1` only and answers a request with a foreign `Host` header with 403 (the event stream too). It uses only Node's built-in modules, and every page loads its libraries and fonts from the server, so Groundwork works without a network.

A module plugs in with a manifest; see [`../modules/README.md`](../modules/README.md).

The module ids `api`, `shell` and `vendor` are reserved for the core's own paths; `startServer` rejects a module that uses one. The decisions behind the core are in [`docs/product/core/TECH.md`](../docs/product/core/TECH.md) (in Hungarian).
