# Sketch module

A drawing board in the shell: [Excalidraw](https://excalidraw.com), so the developer and Claude can explain things with boxes and arrows. A sketch is a standard `.excalidraw` file under `docs/product/sketches/`, kept in git, which excalidraw.com (or any Excalidraw) opens as it is. This first version has one sketch, `main` (`docs/product/sketches/main.excalidraw`). The plan, in Hungarian: [`docs/product/sketch/PRD.md`](../../docs/product/sketch/PRD.md), [`TECH.md`](../../docs/product/sketch/TECH.md).

Sketch is a tool, not a step of the workflow: its tab comes after Plan and Build, behind a separator (`tool: true` in the manifest).

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest and the endpoints (below) |
| `sketch-store.mjs` | the sketches on disk: reads a scene, saves one merged with the file (`merge.mjs`) as the standard file without the viewer's state (zoom, scroll, selection), refuses an embedded image over 2 MB |
| `merge.mjs` | two versions of a sketch merged element by element: the higher `version` wins, on a tie the lower `versionNonce`; a deletion is kept as `isDeleted: true`. Used by the server and the page alike |
| `sketch.mjs` | `groundwork sketch show \| apply` (below) |
| `ops.mjs` | the ops of `apply` turned into Excalidraw elements: shapes with bound labels, texts, arrows bound to shapes, move, update, delete, Mermaid |
| `mermaid.mjs` | a Mermaid flowchart read and laid out in layers, in Node (below) |
| `digest.mjs` | the text `show` prints |
| `skills/groundwork-sketch/` | the skill that teaches Claude the commands; `groundwork init` installs it |
| `index.html` | the page: loads React and Excalidraw from `/vendor/` (classic scripts), then `view/main.mjs` |
| `sketch.css` | Excalidraw fills the frame |
| `ui-strings.mjs` | the page's own text in English and Hungarian (Excalidraw's labels come from its locales) |
| `view/asset-path.js` | sets `window.EXCALIDRAW_ASSET_PATH` to `/vendor/excalidraw/` before Excalidraw loads, so its fonts and locales come from us, not unpkg |
| `view/main.mjs` | the entry: reads the sketch, mounts the board, saves it (the deleted elements too), reads it again on `sketch.files`, follows the shell's light or dark and language, shows a failed read or save as a toast |
| `view/follow.mjs` | the sketch read again from disk, merged into the board; nothing when the file brings nothing new |
| `view/board.mjs` | Excalidraw mounted with React (`React.createElement`, no JSX); its own file and theme actions and embeds are off; offers Hungarian, which Excalidraw 0.17.6 hides as only 70% translated |
| `view/theme.mjs` | `followTheme(apply)`: light or dark as the shell shows it (today the OS), now and on every switch; the one place to change when the shell gets its own switch |
| `view/saver.mjs` | saves only when the drawing changed (an element's version, an image), once the changes rest for 0.7 s; a failed save is tried again with the next change |

## Endpoints

| Endpoint | Answer |
|---|---|
| `GET /api/sketch/scene?name=<name>` | the scene (the `.excalidraw` file), or an empty scene when it is not drawn yet |
| `PUT /api/sketch/scene?name=<name>` | the page's save, the scene as Excalidraw's `serializeAsJSON(…, 'local')` gives it; `content-type: application/json` required (415), 400 when it is not a scene or the name is not a plain name, 413 when an image is too large; nothing is written then |

`<name>` is letters, digits, `-` and `_`, and defaults to `main`. Sketch may write only under `docs/product/sketches/`. It has no public endpoints. A change of a file there is the live topic `sketch.files`.

## Claude on the board

| Command | What it does |
|---|---|
| `groundwork sketch show <name>` | one line per element with its id: `rectangle api "API" at 0,0 size 120x60`, `arrow reads "reads": api "API" -> db "Database"`, `text note "Draft" at 0,200`; a label shows on its shape |
| `groundwork sketch apply <name> '<ops>'` | a JSON array of ops (or on stdin): `add` (rectangle, ellipse, diamond, text, arrow, line), `move`, `update`, `delete`, `mermaid`; the fields are in the header of `ops.mjs` and in the skill. One wrong op: nothing is written, exit 1 |

**Two editors at once.** The page and `apply` both write through `sketch-store.mjs`, which merges with the file as it is at that moment, element by element (`merge.mjs`). Excalidraw 0.17.6 does not export its `reconcileElements`, so the rule is ours, the same as its: every edit raises an element's `version`. The page sends its deleted elements too (Excalidraw's `serializeAsJSON` drops them), and the file keeps them as `isDeleted: true`, so a deletion is not undone by the other side. On `sketch.files` the page reads the file again and merges it into the board (`view/follow.mjs`): Claude's drawing appears, and the element the developer is dragging keeps its newer version.

**Mermaid in Node.** Excalidraw's `parseMermaidToExcalidraw` renders the chart with Mermaid, which needs a browser DOM, so `apply` could draw only while a page is open. Instead `mermaid.mjs` reads the common flowchart syntax (nodes, edges, labels, chains, `&`; `classDef`, `style`, `subgraph` and the like are skipped) and lays it out in layers itself; `ops.mjs` makes the shapes and bound arrows. Other Mermaid diagram types are refused. Excalidraw's own Mermaid dialog in the page is untouched.

**The picture.** The server renders no image (d-board-image): when Claude needs to see the sketch, the skill sends it to the browser pane, `/?module=sketch`.

## Loading

Excalidraw is large (about 1.2 MB of script, plus fonts, locales and a lazily loaded chunk), so only this page loads it: the shell makes a module's frame only when its tab is first opened, and no other page or shell file names `/vendor/excalidraw/` or `/vendor/react/` (`view.test.mjs` checks this). Why the 0.17 UMD build: [`core/vendor/README.md`](../../core/vendor/README.md).
