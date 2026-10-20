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
- Style fields: `strokeColor`, `backgroundColor` (e.g. `"#e6ebfa"`), `fillStyle` (`solid`, `hachure`), `strokeWidth`, `strokeStyle` (`solid`, `dashed`, `dotted`), `roughness`, `opacity`, `link`.
- Font fields: `fontFamily` (`1` hand-drawn, `2` normal, `3` code) and `fontSize`. They go on a text, and on a shape or an arrow they set its label.
- Look: draw in the look of Groundwork's mind map (Colours, below), never with Excalidraw's bright pastels. To make what you add as clean as the interface around it, give it `"roughness":0`, `"strokeWidth":1`, `"fontFamily":2` and `"fontSize":20` on labels. A note is 16, a heading 22 to 24, and the one title 28 to 32: never smaller than 16, so it reads at the zoom that shows the whole drawing.
- Keep a label short: a name, then one or two short lines (who does it, with what). Put the rest in a small muted text next to the shape.
- Lay shapes out on a grid, one size for the shapes of one kind and the same gap between them, so arrows run straight. Centre a heading over its column as the label of a shape without outline or fill (`"strokeColor":"transparent"`): a label is always centred. To route an arrow around other shapes, give it `points`: with more than two points it turns at sharp corners.
- Mermaid: `flowchart`/`graph` with TD, LR, BT or RL; nodes `a[box]`, `a(round)`, `a{decision}`, `a((circle))`; edges `-->`, `---`, `-.->`, `==>`, labels `-->|text|` or `-- text -->`, chains and `&`. It is laid out in layers. Other Mermaid diagrams are refused; draw them with shapes and arrows.

### Colours

Draw in the look of Groundwork's mind map: rounded boxes, one hue per group, and quiet fills.

Write the light theme's colours. In the dark theme, Excalidraw inverts the canvas: these colours then turn into the map's dark look, with light outlines on dark, tinted fills. A bright pastel fill turns into a muddy dark one, so never use one.

| Hue | `strokeColor` | `backgroundColor` |
|---|---|---|
| blue | `#1d4ed8` | `#dbeafe` |
| emerald | `#047857` | `#d1fae5` |
| violet | `#6d28d9` | `#ede9fe` |
| amber | `#b45309` | `#fef3c7` |
| pink | `#be185d` | `#fce7f3` |
| cyan | `#0e7490` | `#cffafe` |
| plain | `#6b6860` | `#f4f3ef` |

- These are the map's branch colours (`modules/plan/map-theme.mjs`), dark enough for the inversion.
- Pill: a rectangle 72 to 80 px high, for a two-line label. Excalidraw rounds its corners. Use `"fillStyle":"solid"`.
- Colour by group, as the map colours a branch: one hue for the shapes of one group (a stage, a part, a team), and plain for the rest. Use at most four hues in a drawing.
- An arrow takes the hue of the group it leaves, with `"strokeWidth":1.5`.
- Show a state, such as not built yet or optional, with `"strokeStyle":"dashed"` and a small note, never with another hue.
- Give the drawing's one root or title a filled pill: `"backgroundColor":"#3730a3"`, `"strokeColor":"#3730a3"`, and make its label white with `{"op":"update","id":"<id>-label","strokeColor":"#ffffff"}`.
- Free text is `#1d1c1a`. A note or a legend is `#6b6860`, 16 px. A group's heading is in the group's hue.

### Quality

What you draw sits next to the human's work, in their tool, so it has to look finished: as polished as the rest of Groundwork. A drawing that only carries the information is not done.

- Before drawing, plan the layout on a grid: the groups, their hues, and where every arrow runs. Arrows must not cross shapes or each other, and labels must not overflow their shapes.
- After every `apply` that changes the layout, look at the whole drawing in the browser pane, in the dark theme. Zoom out until all of it shows, then judge it as a designer would. Check that it is aligned, evenly spaced, and calm in colour, with nothing cramped, crossed or cut off.
- Fix what you see and look again. Show the drawing to the human only when you would show it as your own work.

Done when `apply` printed the sketch with your change, and you looked at it in the browser pane and it meets the bar above.

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
