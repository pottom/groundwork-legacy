# Sketch module

A drawing board in the shell: [Excalidraw](https://excalidraw.com), so the developer and Claude can explain things with boxes and arrows. A sketch is a standard `.excalidraw` file under `docs/product/sketches/`, kept in git, which excalidraw.com (or any Excalidraw) opens as it is. This first version has one sketch, `main` (`docs/product/sketches/main.excalidraw`). The plan, in Hungarian: [`docs/product/sketch/PRD.md`](../../docs/product/sketch/PRD.md), [`TECH.md`](../../docs/product/sketch/TECH.md).

Sketch is a tool, not a step of the workflow: its tab comes after Plan and Build, behind a separator (`tool: true` in the manifest).

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest and the endpoints (below) |
| `sketch-store.mjs` | the sketches on disk: reads a scene, saves one as the standard file without the viewer's state (zoom, scroll, selection), refuses an embedded image over 2 MB |
| `index.html` | the page: loads React and Excalidraw from `/vendor/` (classic scripts), then `view/main.mjs` |
| `sketch.css` | Excalidraw fills the frame |
| `ui-strings.mjs` | the page's own text in English and Hungarian (Excalidraw's labels come from its locales) |
| `view/asset-path.js` | sets `window.EXCALIDRAW_ASSET_PATH` to `/vendor/excalidraw/` before Excalidraw loads, so its fonts and locales come from us, not unpkg |
| `view/main.mjs` | the entry: reads the sketch, mounts the board, follows the shell's light or dark and language, shows a failed read or save as a toast |
| `view/board.mjs` | Excalidraw mounted with React (`React.createElement`, no JSX); its own file and theme actions and embeds are off; offers Hungarian, which Excalidraw 0.17.6 hides as only 70% translated |
| `view/theme.mjs` | `followTheme(apply)`: light or dark as the shell shows it (the switch in its header, `/shell/theme.js`, else the OS), now and on every switch |
| `view/saver.mjs` | saves only when the drawing changed (an element's version, an image), once the changes rest for 0.7 s; a failed save is tried again with the next change |

## Endpoints

| Endpoint | Answer |
|---|---|
| `GET /api/sketch/scene?name=<name>` | the scene (the `.excalidraw` file), or an empty scene when it is not drawn yet |
| `PUT /api/sketch/scene?name=<name>` | the page's save, the scene as Excalidraw's `serializeAsJSON(…, 'local')` gives it; `content-type: application/json` required (415), 400 when it is not a scene or the name is not a plain name, 413 when an image is too large; nothing is written then |

`<name>` is letters, digits, `-` and `_`, and defaults to `main`. Sketch may write only under `docs/product/sketches/`. It has no public endpoints.

## Loading

Excalidraw is large (about 1.2 MB of script, plus fonts, locales and a lazily loaded chunk), so only this page loads it: the shell makes a module's frame only when its tab is first opened, and no other page or shell file names `/vendor/excalidraw/` or `/vendor/react/` (`view.test.mjs` checks this). Why the 0.17 UMD build: [`core/vendor/README.md`](../../core/vendor/README.md).
