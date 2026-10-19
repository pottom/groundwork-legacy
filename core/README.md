# core

The shared core of Groundwork. It holds what every module uses.

| File | Role |
|---|---|
| `groundwork.mjs` | the command: `node core/groundwork.mjs [--root DIR] [--port N] [--open]` |
| `server.mjs` | the local server: start page, `/api/modules`, each module's view under `/<id>/` and endpoints under `/api/<id>/` |
| `modules.mjs` | the list of modules the server loads |
| `files.mjs` | the writer each module gets: reads inside the project, writes only under the folders its manifest names (`docs/product/` and `.groundwork/` at most) |
| `http.mjs` | small helpers for the modules' endpoints (`send`, `readJson`) |

The server listens on `127.0.0.1` only and answers a request with a foreign `Host` header with 403. It uses only Node's built-in modules.

A module plugs in with a manifest; see [`../modules/README.md`](../modules/README.md).

Still to come: the shell (header, navigation, theme). The decisions behind the core are in [`docs/product/core/TECH.md`](../docs/product/core/TECH.md) (in Hungarian).
