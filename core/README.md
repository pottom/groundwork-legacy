# core

The shared core of Groundwork. It holds what every module uses.

| File | Role |
|---|---|
| `groundwork.mjs` | the command: `node core/groundwork.mjs [--root DIR] [--port N] [--open]` |
| `server.mjs` | `startServer({ root, modules, port })`, async: resolves to `{ port, url, close() }` once listening (`port: 0` picks a free one) and rejects a module whose id is reserved (`api`, `shell`, `vendor`). The local server: the shell at `/`, `/api/modules`, each module's view under `/<id>/` and endpoints under `/api/<id>/` |
| `shell/` | the shell and the shared look: `shell.mjs` renders the start page on the server (header with the project's name, navigation built from the manifests, the chosen module's view in a frame; `/?module=<id>` picks one); `theme.css` holds the shared style variables (`--gw-*`, documented at its top), light or dark following the OS; `shell.css` lays out the shell page; `i18n.mjs` is the UI translation (English by default, Hungarian too; the language picker in the header switches the shell and the module's frame, and the choice survives a reload), with the shell's own strings in `strings.mjs`. Of these, only `theme.css`, `shell.css`, `i18n.mjs` and `strings.mjs` are served at `/shell/`; `shell.mjs` runs in the server and is never sent to the browser |
| `modules.mjs` | the list of modules the server loads: Plan (`/plan/`) and Build (`/build/`) |
| `files.mjs` | the writer each module gets: reads inside the project, writes only under the folders its manifest names (`docs/product/` and `.groundwork/` at most) |
| `http.mjs` | small helpers for the modules' endpoints (`send`, `readJson`) |
| `vendor/` | the browser-side dependencies (Mind Elixir, marked, the Inter and Source Serif 4 fonts), served at `/vendor/...`; versions and licenses in [`vendor/README.md`](vendor/README.md) |
| `offline.test.mjs` | checks that no page loads anything from another host |

The server listens on `127.0.0.1` only and answers a request with a foreign `Host` header with 403. It uses only Node's built-in modules, and every page loads its libraries and fonts from the server, so Groundwork works without a network.

A module plugs in with a manifest; see [`../modules/README.md`](../modules/README.md).

The module ids `api`, `shell` and `vendor` are reserved for the core's own paths; `startServer` rejects a module that uses one. The decisions behind the core are in [`docs/product/core/TECH.md`](../docs/product/core/TECH.md) (in Hungarian).
