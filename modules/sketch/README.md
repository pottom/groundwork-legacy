# Sketch module

A drawing board in the shell: [Excalidraw](https://excalidraw.com), so the developer and Claude can explain things with boxes and arrows. A sketch is a standard `.excalidraw` file under `docs/product/sketches/`, kept in git, which excalidraw.com (or any Excalidraw) opens as it is. A short conversation, a thread, can be pinned to a shape; the threads live beside the sketch in `<name>.threads.json`. There are as many named sketches as you like, each its own file (`docs/product/sketches/<name>.excalidraw`); the bar above the board lists them, opens one, makes a new one and renames the open one. The page opens the sketch a deep link names (`/?module=sketch&sketch=<name>`), else the one last opened in this browser, else the first, else `main`; the shell's address follows the sketch shown. The plan, in Hungarian: [`docs/product/sketch/PRD.md`](../../docs/product/sketch/PRD.md), [`TECH.md`](../../docs/product/sketch/TECH.md).

Sketch is a tool, not a step of the workflow: its tab comes after Plan and Build, behind a separator (`tool: true` in the manifest).

## Files

| File | What it is |
|---|---|
| `module.mjs` | the manifest and the endpoints (below) |
| `sketch-store.mjs` | the sketches on disk: lists, creates and renames them, reads a scene, saves one merged with the file (`merge.mjs`) as the standard file without the viewer's state (zoom, scroll, selection), refuses an embedded image over 2 MB |
| `merge.mjs` | two versions of a sketch merged element by element: the higher `version` wins, on a tie the lower `versionNonce`; a deletion is kept as `isDeleted: true`. Used by the server and the page alike |
| `threads.mjs` | the threads pinned to shapes, in `<name>.threads.json` beside the sketch: comment, close or reopen, list them with which are orphaned (their shape deleted); the text `threads` prints |
| `sketch.mjs` | `groundwork sketch list \| show \| apply \| threads \| comment \| close \| reopen` (below) |
| `ops.mjs` | the ops of `apply` turned into Excalidraw elements: shapes with bound labels, texts, arrows bound to shapes, move, update, delete, Mermaid |
| `mermaid.mjs` | a Mermaid flowchart read and laid out in layers, in Node (below) |
| `digest.mjs` | the text `show` prints |
| `skills/groundwork-sketch/` | the skill that teaches Claude the commands; `groundwork init` installs it |
| `index.html` | the page: loads React and Excalidraw from `/vendor/` (classic scripts), then `view/main.mjs` |
| `sketch.css` | Excalidraw fills the frame |
| `ui-strings.mjs` | the page's own text in English and Hungarian (Excalidraw's labels come from its locales) |
| `view/asset-path.js` | sets `window.EXCALIDRAW_ASSET_PATH` to `/vendor/excalidraw/` before Excalidraw loads, so its fonts and locales come from us, not unpkg |
| `view/main.mjs` | the entry: chooses the sketch and remembers it, reads it, mounts the board and the bar, saves it (the deleted elements too), reads it again on `sketch.files`, follows the shell's light or dark and language, shows a failed read or save as a toast |
| `view/follow.mjs` | the sketch read again from disk, merged into the board; nothing when the file brings nothing new |
| `view/board.mjs` | Excalidraw mounted with React (`React.createElement`, no JSX); its own file and theme actions and embeds are off; offers Hungarian, which Excalidraw 0.17.6 hides as only 70% translated |
| `view/theme.mjs` | `followTheme(apply)`: light or dark as the shell shows it (the switch in its header, `/shell/theme.js`, else the OS), now and on every switch |
| `view/sketches.mjs` | which sketch opens (`chooseSketch`), the rule for a name (`isSketchName`, shared with the store), and the bar of sketches (plain DOM) |
| `view/pins.mjs` | the threads without the DOM: where a shape's pin goes on screen (`pinPlaces`), the selected shape, a shape's label, and the threads API the page calls |
| `view/thread-panel.mjs` | the pins on the shapes, the Comments button and the panel: a thread's comments, a field to answer, resolve or reopen; the list of all threads, orphaned ones too (lit-html) |
| `links-store.mjs` | the sketches' links, `docs/product/sketches/links.json`: what each sketch links to, and the old names of renamed sketches |
| `view/targets.mjs` | a link's one form, `groundwork://idea/I-12` (`node/<map id>`, `ticket/#34`, `sketch/<name>`), and the shell's address that opens it; shared with the server |
| `view/links.mjs` | the links button at the right of the bar: lists the sketch's links (each opens in the shell), adds and removes one |
| `view/api.mjs` | the page's two calls to the Sketch API, `getJson` and `postJson` (as JSON); a refusal rejects with its `status` |
| `view/saver.mjs` | saves only when the drawing changed (an element's version, an image), once the changes rest for 0.7 s; a failed save is tried again with the next change |

## Endpoints

| Endpoint | Answer |
|---|---|
| `GET /api/sketch/scene?name=<name>` | the scene (the `.excalidraw` file), or an empty scene when it is not drawn yet |
| `GET /api/sketch/list` | `{ sketches: [{ name }] }`: every `.excalidraw` file with a plain name, in name order |
| `POST /api/sketch/create` | `{ name }`: a new empty sketch; 201, 409 when the name is taken, 400 when it is not a plain name |
| `POST /api/sketch/rename` | `{ from, to }`: moves the file; 409 when `to` is taken; a sketch not drawn yet becomes an empty `to`; a change of case only works on Windows and macOS too |
| `GET /api/sketch/links` | (public) `{ sketches: { name: [link] }, linked: { idea, node, ticket, sketch: { ref: [names] } }, renamed: { old: new } }` |
| `POST /api/sketch/link` | `{ name, target }`: the sketch links to `target` (`groundwork://…`); 400 when it is not one |
| `POST /api/sketch/unlink` | `{ name, target }`: the link goes again |
| `PUT /api/sketch/scene?name=<name>` | the page's save, the scene with its deleted elements, merged with the file element by element; `content-type: application/json` required (415), 400 when it is not a scene or the name is not a plain name, 413 when an image is too large; nothing is written then |
| `GET /api/sketch/threads?name=<name>` | `{ threads: [{ element, closed, orphaned, comments: [{ author, at, text }] }] }`, in the order they were started |
| `POST /api/sketch/comment?name=<name>` | `{ element, text, author? }`: a comment on the shape's thread, starting it (and reopening a closed one); without an author it is the developer's (git `user.name`, else the OS user); 404 when the shape is not in the sketch and has no thread, 400 when the text is empty or over 4000 characters |
| `POST /api/sketch/close?name=<name>` | `{ element, closed? }`: closes the thread, `closed: false` reopens it; 404 when there is none |

`<name>` is letters, digits, `-` and `_` (up to 64), and defaults to `main`. Every write (`PUT`, `POST`) must be `application/json` (415), so another site cannot post a form here. Sketch may write only under `docs/product/sketches/`. A change of a sketch file there is the live topic `sketch.files`, of `links.json` the topic `sketch.links`.

## Links

A sketch links to ideas, map nodes, tickets and other sketches (f-board-links): the Links button at the right of the bar lists them and adds one by its kind and reference. They are kept in `docs/product/sketches/links.json` (in git, topic `sketch.links`). The other side shows the sketch: an idea card and a map node carry "Sketch: <name>" (they read `GET /api/sketch/links`), and a ticket names its sketches on a `**Sketch:** <name>` line, which Build shows. Each opens the sketch in the shell.

A single shape links too, with Excalidraw's own element link (select it, Ctrl+K): `groundwork://idea/I-12`, `groundwork://node/<map id>`, `groundwork://ticket/%2334` (or `core%203`), `groundwork://sketch/<name>`. Clicking it opens that in the shell: Ideas with the idea in its drawer, Plan on the node, Build with the ticket in its drawer, or the sketch (f-board-shape-links). Any other link Excalidraw opens itself.

Links survive renaming a sketch: its own links move along, links to it from other sketches follow, and the old name is kept in `renamed`, so a ticket's `**Sketch:**` line or a shape's link with the old name still opens it (the page and `shellLink` resolve it). A new sketch made under an old name takes that name back.

## Public endpoints

| Endpoint | Who reads it |
|---|---|
| `GET /api/sketch/links` | Ideas (the sketches on a card) and Plan (the sketches on a map node) |

## Claude on the board

| Command | What it does |
|---|---|
| `groundwork sketch list` | the sketches' names, one per line |
| `groundwork sketch show <name>` | one line per element with its id: `rectangle api "API" at 0,0 size 120x60`, `arrow reads "reads": api "API" -> db "Database"`, `text note "Draft" at 0,200`; a label shows on its shape |
| `groundwork sketch apply <name> '<ops>'` | a JSON array of ops (or on stdin): `add` (rectangle, ellipse, diamond, text, arrow, line), `move`, `update`, `delete`, `mermaid`; the fields are in the header of `ops.mjs` and in the skill. One wrong op: nothing is written, exit 1 |
| `groundwork sketch threads <name>` | every thread: the shape (id and label), open or closed, orphaned when the shape was deleted, each comment with author and time |
| `groundwork sketch comment <name> <id> "<text>"` | a comment on the shape's thread, starting it; the text may come on stdin; the author is `Claude` unless `--author` names another |
| `groundwork sketch close \| reopen <name> <id>` | closes a resolved thread, or opens it again |

**Threads.** A thread is a short conversation pinned to one shape: comments with author and time, closed when resolved (d-board-thread-fields). They live beside the drawing in `docs/product/sketches/<name>.threads.json`, keyed by element id, so the `.excalidraw` file stays the standard one; a rename of the sketch takes the file along. A shape deleted later keeps its thread, orphaned, not lost: it has no pin, the panel's list shows it as "Shape deleted", and it can still be answered. In the page a pin with the number of comments marks each shape with a thread and follows it as the board scrolls and zooms; the Comments button opens the selected shape's thread, or the list. A comment saves the drawing first, so a shape drawn a moment ago can have one. The threads file is under `docs/product/sketches/` too, so a comment from Claude is a `sketch.files` event and shows on the open page at once.

**Two editors at once.** The page and `apply` both write through `sketch-store.mjs`, which merges with the file as it is at that moment, element by element (`merge.mjs`). Excalidraw 0.17.6 does not export its `reconcileElements`, so the rule is ours, the same as its: every edit raises an element's `version`. The page sends its deleted elements too (Excalidraw's `serializeAsJSON` drops them), and the file keeps them as `isDeleted: true`, so a deletion is not undone by the other side. On `sketch.files` the page reads the file again and merges it into the board (`view/follow.mjs`): Claude's drawing appears, and the element the developer is dragging keeps its newer version.

**Mermaid in Node.** Excalidraw's `parseMermaidToExcalidraw` renders the chart with Mermaid, which needs a browser DOM, so `apply` could draw only while a page is open. Instead `mermaid.mjs` reads the common flowchart syntax (nodes, edges, labels, chains, `&`; `classDef`, `style`, `subgraph` and the like are skipped) and lays it out in layers itself; `ops.mjs` makes the shapes and bound arrows. Other Mermaid diagram types are refused. Excalidraw's own Mermaid dialog in the page is untouched.

**The picture.** The server renders no image (d-board-image): when Claude needs to see the sketch, the skill sends it to the browser pane, `/?module=sketch&sketch=<name>`.

## Loading

Excalidraw is large (about 1.2 MB of script, plus fonts, locales and a lazily loaded chunk), so only this page loads it: the shell makes a module's frame only when its tab is first opened, and no other page or shell file names `/vendor/excalidraw/` or `/vendor/react/` (`view.test.mjs` checks this). Why the 0.17 UMD build: [`core/vendor/README.md`](../../core/vendor/README.md).
