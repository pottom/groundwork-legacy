# core

The shared core of Groundwork. It holds what every module uses.

| File | Role |
|---|---|
| `groundwork.mjs` | the command: `node core/groundwork.mjs [--root DIR] [--port N] [--open]` |
| `server.mjs` | the local server: start page, `/api/modules`, each module's view under `/<id>/` and endpoints under `/api/<id>/` |
| `modules.mjs` | the list of modules the server loads |
| `http.mjs` | small helpers for the modules' endpoints (`send`, `readJson`) |
| `vendor/` | the browser-side dependencies (Mind Elixir, marked, the Inter and Source Serif 4 fonts), served at `/vendor/...`; versions and licenses in [`vendor/README.md`](vendor/README.md) |
| `offline.test.mjs` | checks that no page loads anything from another host |

The server listens on `127.0.0.1` only and answers a request with a foreign `Host` header with 403. It uses only Node's built-in modules, and every page loads its libraries and fonts from the server, so Groundwork works without a network.

A module plugs in with a manifest; see [`../modules/README.md`](../modules/README.md).

Still to come: write access granted per module, and the shell (header, navigation, theme). The decisions behind the core are in [`docs/product/core/TECH.md`](../docs/product/core/TECH.md) (in Hungarian).
