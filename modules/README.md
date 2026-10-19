# modules

Each folder here is one Groundwork module.

| Module | What it does | State |
|---|---|---|
| [`plan/`](plan/) | Turns a grilling interview with Claude Code into a live mind map and product documents under `docs/product/` | working prototype (prd-maker) |
| [`build/`](build/) | Shows a project's Markdown tickets, specs, ADRs and git branches as a live dashboard | working prototype |

## What a module is

From the plan ([`docs/product/mag/TECH.md`](../docs/product/mag/TECH.md), Modulszerződés), a module is one folder with:

1. a **descriptor**: id, name, version;
2. **server endpoints** under its own `/api/<module>/` path;
3. a **view** shown in the shared shell;
4. optionally **skills and hooks** for Claude Code, which `groundwork init` installs into a project;
5. the **folders it may write to**, which the core enforces.

The two prototypes predate this contract and still run on their own; adopting it is roadmap step 1. In the first version all modules live inside the package. Modules published as separate npm packages may come later.
