# modules

Each folder here is one Groundwork module.

| Module | What it does | State |
|---|---|---|
| [`plan/`](plan/) | Turns a grilling interview with Claude Code into a live mind map and product documents under `docs/product/` | working prototype (Claude skill: groundwork-prd-maker) |
| [`build/`](build/) | Shows a project's Markdown tickets, specs, ADRs and git branches as a live dashboard | working prototype |

## What a module is

From the plan ([`docs/product/core/TECH.md`](../docs/product/core/TECH.md), Modulszerződés), a module is one folder with:

1. a **descriptor**: id, name, version;
2. **server endpoints** under its own `/api/<module>/` path;
3. a **view** shown in the shared shell;
4. optionally **skills and hooks** for Claude Code, which `groundwork init` installs into a project;
5. the **folders it may write to**, which the core enforces.

In code, a module exports its manifest from `module.mjs`, and `core/modules.mjs` lists it:

```js
export default {
  id: 'plan', name: 'Plan', version: VERSION,           // the package's (core/version.mjs): one version for all
  view: { dir: HERE, files: ['index.html', ...] },     // served under /plan/
  writes: ['docs/product', '.groundwork/plan'],          // the only folders it may write to
  moves: { '.prd-maker': '.groundwork/plan' },           // optional: old state the core moves over once
  watch: (path) => (path === 'docs/product/mindmap.json' ? 'plan.map' : null),  // optional: live-update topic of a changed file
  api: ({ root, files, events }) => (req, res, subpath, url) => true,  // /api/plan/<subpath>; true when it answered
}
```

Live updates: the core watches the project and tells the pages what changed through `GET /api/events` (Server-Sent Events, [`core/events.mjs`](../core/events.mjs)). A module names the topic of the files it cares about with `watch(path)` (path relative to the root, with `/`), and can push a topic itself with `events.publish(topic)` or `events.every(ms, fn)`. Its page listens with `new EventSource('/api/events')`, asks its endpoints again on a `change` event whose `topics` it cares about, and reads everything again on each `hello` (every reconnect). No page polls the server.

A module has no general file system access: it reads and writes the project through `files`, the writer the core hands it ([`core/files.mjs`](../core/files.mjs)). `files.write`, `append` and `remove` work only under the folders in `writes`, and those must lie under `docs/product/` or `.groundwork/`; a path that is absolute, climbs out with `..` or leads outside through a symlink or junction fails before anything is written. A module's local state goes in `.groundwork/<id>/`, which is gitignored.

The view shows inside the core's shell, which adds the header and the navigation; the navigation lists every module with a `view`, by its `name`. To share the look, a view links `/shell/theme.css` and uses its `--gw-*` variables (colours, fonts, sizes; light or dark follows the OS). The list of variables is at the top of [`core/shell/theme.css`](../core/shell/theme.css).

The UI text goes through the core's translation, [`core/shell/i18n.mjs`](../core/shell/i18n.mjs) (served at `/shell/i18n.mjs`, usage at its top): the view keeps its strings in one object per language (English required, Hungarian too), calls `createI18n(strings)`, uses `t(key)` and `data-i18n` attributes, and re-renders in `onChange`. The language is chosen in the shell; the view follows it. This is the UI language only; a module's generated documents have their own.

Plan and Build both follow this contract. Build lists no `writes`, so it cannot write anything.
