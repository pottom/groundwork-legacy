# Groundwork

Groundwork takes a project from idea to delivery, in one portable package that works with any project.

- **Plan**: while you talk an idea through with Claude Code (a "grilling" interview), a live mind map is drawn. You can edit it as you go, and product documentation is written from it: a PRD, a technical design, and for systems and services also an overview, a service description, operations and rollout plans.
- **Build**: a development dashboard reads the project's Markdown tickets and git history. It shows tickets, dependencies, activity and branches. It works without Claude too, for anyone following the project.
- **Traceability**: every ticket points back to the PRD decision it came from, and every decision shows how many tickets it produced and how many are done.
- **Modules**: Plan and Build sit on a small shared core (one local server, one shell). More modules can be added later.

> **Status: early.** Both modules exist as working prototypes, served by the one core server.
> The full plan is in [`docs/product/`](docs/product/SYSTEM.md); it is written in Hungarian. The roadmap has four steps:
> 1. one shared server for both modules;
> 2. a shared look with an English UI;
> 3. linking Plan and Build;
> 4. publishing on npm (`npx groundwork`).

## Repository layout

```
groundwork/
├── core/               the shared local server that serves every module
├── modules/
│   ├── plan/           Plan module: mind map editor, document generator, Claude skill (groundwork-prd-maker)
│   └── build/          Build module: development dashboard over tickets and git (prototype)
├── docs/product/       Groundwork's own plan, written with the Plan module
└── .claude/            Claude Code setup for working on this repo: the installed skill, the hook, preview servers
```

Every folder has a README that says what is in it.

## Try it

Requirements: Node.js 20 or newer. Nothing else to install.

```bash
node core/groundwork.mjs --root .                           # the core server: http://localhost:4477, Plan at /plan/, Build at /build/
```

`--root` is the project to work on (default: the current folder). The core server listens on `127.0.0.1` only and refuses requests with a foreign `Host` header.

Run the tests with `npm test` (Node's built-in test runner).

## License

[MIT](LICENSE)
