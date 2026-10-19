# Ideas module

Numbered ideas, each with its author and source, on a kanban: New · Considering · To develop · Rejected. The first step of the flow (Ideas → Plan → Build): an idea that is worth it moves on to Plan's map or to a ticket. Spec: [`docs/product/ideas/PRD.md`](../../docs/product/ideas/PRD.md), [`TECH.md`](../../docs/product/ideas/TECH.md).

Each idea is one Markdown file under `docs/product/ideas/items/`, in git: `I-012-quick-tab-switching.md`, its fields in a front matter of flat `key: value` lines (`title`, `author` claude|human, `source`, `kind` product|engineering, `status`, `created`), its description below. People say `I-12`. The next number is the highest one in the folder plus one; an idea is never deleted (a rejected one stays in the Rejected column), so a number is never used twice. That folder is the only one the module may write to.

From the command line (what Claude uses):

```
groundwork ideas add "<title>" [--body <text>] [--author claude|human] [--source <text>] [--kind product|engineering]
groundwork ideas list
```

The board is read-only for now; it follows the files live (topic `ideas.items`), and a new idea is tinted for a moment when it arrives.

| File | What it is |
|---|---|
| `module.mjs` | the manifest and `GET /api/ideas/list` |
| `store.mjs` | the idea files: list, add, the front matter |
| `fields.mjs` | the values of the fields and the number formats, shared by the server and the page |
| `ideas.mjs` | `groundwork ideas add|list` |
| `index.html` | the page: a thin skeleton; `view/main.mjs` is its entry |
| `view/board.mjs` | the kanban, as lit-html templates on the shell's `.gw-*` components |
| `view/strings.mjs`, `ui-strings.mjs` | the UI text, English and Hungarian |
| `view/ideas.css` | the board's layout |

## Public endpoints

None yet.
