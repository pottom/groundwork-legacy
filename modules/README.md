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
  id: 'plan', name: 'Plan', version: '0.1.0',
  view: { dir: HERE, files: ['index.html', ...] },     // served under /plan/
  api: ({ root }) => (req, res, subpath, url) => true,  // /api/plan/<subpath>; true when it answered
}
```

Plan and Build both follow this contract.
