# Ideas module

Numbered ideas, each with its author and source, on a kanban: New · Considering · To develop · Rejected. The first step of the flow (Ideas → Plan → Build): an idea that is worth it moves on to Plan's map or to a ticket. Spec: [`docs/product/ideas/PRD.md`](../../docs/product/ideas/PRD.md), [`TECH.md`](../../docs/product/ideas/TECH.md).

Each idea is one Markdown file under `docs/product/ideas/items/`, in git: `I-012-quick-tab-switching.md`, its fields in a front matter of flat `key: value` lines (`title`, `author` claude|human, `source`, `kind` product|engineering, `impact` and `effort` low|medium|high, `status`, `reason` when rejected, `links` as a JSON list, `created`), its description below. People say `I-12`. The next number is the highest one in the folder plus one; an idea is never deleted (a rejected one stays in the Rejected column), so a number is never used twice. That folder is the only one the module may write to.

From the command line (what Claude uses):

```
groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>] [--kind product|engineering]
groundwork ideas list
groundwork ideas move I-12 new|considering
```

Claude adds and refines, the human decides (d-ideas-human-decides, d-ideas-ai-limits): `move` takes an idea only between New and Considering, and refuses To develop and Rejected with a message saying they are set in the browser. On the board a card opens in a drawer where every field can be edited, moves by drag and drop or by its move menu (keyboard: arrow keys, Enter, Escape), and a move to Rejected asks for a reason, which the card then shows. Each save is made on the version of the file the page saw; if it changed meanwhile the save is refused (409) and the page shows the newer version. The board follows the files live (topic `ideas.items`), and a new idea is tinted for a moment when it arrives.

| File | What it is |
|---|---|
| `module.mjs` | the manifest, `GET /api/ideas/list` and `PUT /api/ideas/item/<id>` |
| `store.mjs` | the idea files: list, add, update (checked values, versioned), the front matter |
| `fields.mjs` | the values of the fields and the number formats, shared by the server and the page |
| `ideas.mjs` | `groundwork ideas add|list|move` |
| `index.html` | the page: a thin skeleton; `view/main.mjs` is its entry |
| `view/main.mjs` | the page's state and actions: reading, saving, moving, the dialogs, toasts |
| `view/board.mjs` | the kanban, as lit-html templates on the shell's `.gw-*` components: drag and drop, the move menu |
| `view/drawer.mjs` | the drawer: one idea, every field editable |
| `view/reject.mjs` | the reason a move to Rejected asks for |
| `view/api.mjs` | the page's calls: list the ideas, save one |
| `view/strings.mjs`, `ui-strings.mjs` | the UI text, English and Hungarian |
| `view/ideas.css` | the layout of the board, the menu and the dialogs |

## Public endpoints

None yet.
