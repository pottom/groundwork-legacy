---
name: groundwork-sketch
description: Reads and draws on the project's Excalidraw sketches (docs/product/sketches/<name>.excalidraw), the shared drawing board in Groundwork's Sketch tab. Use when the user mentions the sketch, the board, a drawing or diagram they made, asks you to draw, sketch or diagram something (boxes and arrows, a flow, an architecture, a Mermaid flowchart), or refers to shapes "on the board", or to comments and threads on the sketch.
---

A sketch is a drawing the human and you share. The human draws in the browser (Groundwork's Sketch tab); you read it and draw on it with the commands below. What you draw appears in the open sketch at once, and what the human draws at the same time stays: the two are merged element by element. Never edit the `.excalidraw` file by hand.

Every command below is `{{groundwork}} sketch <command>`, run in the project folder. `<name>` is the sketch's name, `main` unless the user names another; `{{groundwork}} sketch list` prints the names there are. Applying to a new name makes that sketch.

## Reading a sketch

`{{groundwork}} sketch show <name>` prints one line per element, with the id you use to change it:

```
Sketch main: 2 shapes, 1 arrow, 1 text
rectangle api "API" at 0,0 size 120x60
ellipse db "Database" at 400,0 size 160x80
arrow reads "reads": api "API" -> db "Database"
text note "Draft" at 0,200
```

A shape's label shows on the shape. Coordinates are canvas pixels, x to the right, y down.

The text says what is there, not how it looks. When the picture matters (a freehand drawing, an image, a layout question, checking your own drawing), look at it in the **browser pane**: open the running Groundwork page with `?module=sketch&sketch=<name>` (by default `http://localhost:4477/?module=sketch&sketch=main`) and take a screenshot. The server renders no image itself.

## Drawing

Run `{{groundwork}} sketch apply <name> '<ops>'`, the ops a JSON array (or pipe it on stdin). It prints the sketch as `show` does, after the change. One wrong op stops the whole call and nothing is written; fix it and run it again.

| Op | Fields |
|---|---|
| add a shape | `{"op":"add","type":"rectangle"\|"ellipse"\|"diamond","id":"api","x":0,"y":0,"label":"API"}`; `width`, `height` optional (sized to the label) |
| add a text | `{"op":"add","type":"text","id":"note","x":0,"y":200,"text":"Draft"}`; `fontSize` optional (20) |
| add an arrow | `{"op":"add","type":"arrow","from":"api","to":"db","label":"reads"}`: bound to both shapes, it follows them; `"type":"line"` has no head; or free: `"points":[[0,0],[200,0]]` |
| move | `{"op":"move","id":"db","x":400,"y":200}` or `"dx"`, `"dy"`: a shape takes its label and arrows along |
| update | `{"op":"update","id":"api","label":"Gateway"}`; also `text` (of a text), `width`, `height`, and the style fields |
| delete | `{"op":"delete","id":"api"}`: its label goes too, its arrows stay, unbound |
| Mermaid | `{"op":"mermaid","source":"flowchart LR\n  a[Idea] --> b{Good?}\n  b -->|yes| c[Build]","x":0,"y":400}` |

- `id` is optional on add; give short meaningful ones (`api`, `db`) so you and the human can refer to them. Mermaid nodes keep their Mermaid ids; an arrow between them is `<from>-<to>`.
- Without `x` and `y` a new shape or chart goes below the drawing. Leave about 80 px between shapes; read the sketch first so you do not draw over the human's work.
- Style fields: `strokeColor`, `backgroundColor` (e.g. `"#ffec99"`), `fillStyle` (`solid`, `hachure`), `strokeWidth`, `strokeStyle` (`solid`, `dashed`, `dotted`), `roughness`, `opacity`, `link`.
- Mermaid: `flowchart`/`graph` with TD, LR, BT or RL; nodes `a[box]`, `a(round)`, `a{decision}`, `a((circle))`; edges `-->`, `---`, `-.->`, `==>`, labels `-->|text|` or `-- text -->`, chains and `&`. It is laid out in layers. Other Mermaid diagrams are refused; draw them with shapes and arrows.

Done when `apply` printed the sketch with your change, and, if the layout matters, you looked at it in the browser pane.

## Threads on shapes

The human can pin a short conversation to a shape (a pin on it in the browser). Read them with `{{groundwork}} sketch threads <name>`:

```
Threads on main: 1 open, 1 closed
api "API" (open)
  Ann, 2026-10-19 10:00: Should this be a queue?
db "Database" (closed, orphaned: the shape was deleted)
  Claude, 2026-10-18 16:20: Which database?
```

- Answer, or start a thread on a shape: `{{groundwork}} sketch comment <name> <id> "<text>"` (or the text on stdin). It is signed `Claude` and shows on the open sketch at once.
- `{{groundwork}} sketch close <name> <id>` when a thread is resolved; `reopen` opens it again. Close a thread only when its question is answered or the human says so.
- An orphaned thread's shape was deleted; it can still be answered.

When the user mentions comments or questions on the sketch, read the threads first and answer the open ones there, where the human asked.

## Your limits

Change only what the user asked for. Moving, restyling or deleting the human's own shapes needs their word; adding next to them does not. Mention the ids you drew so the human can point at them.
