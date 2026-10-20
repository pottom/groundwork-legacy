# modules

Each folder here is one Groundwork module.

| Module | What it does | State |
|---|---|---|
| [`ideas/`](ideas/) | Numbered ideas with author and source, records of the core's record store as Markdown files under `docs/product/ideas/`, on a kanban the human edits and decides on (drawer, drag and drop, reject with a reason, snooze, mark a duplicate); `groundwork ideas add|similar|list|move` (move: New and Considering only, enforced by the store) | in progress (Claude skill: groundwork-ideas) |
| [`changes/`](changes/) | The changes (C-n): what is taking shape, as records of the core's record store under `docs/product/changes/` (the module declares the Change type, `type.mjs`); a list grouped by stage, where the two interview stages are computed (open questions → Grilling, none → Awaiting approval; `stages.mjs`) and the later ones still come from the `status` field; each row shows the counts of open questions and proposed items and the ideas and milestone as record chips. The first page built with Lit | in progress |
| [`plan/`](plan/) | Turns a grilling interview with Claude Code into a live mind map and product documents under `docs/product/` | working prototype (Claude skill: groundwork-prd-maker) |
| [`build/`](build/) | Shows a project's Markdown tickets, specs, ADRs and git branches as a live dashboard | working prototype |
| [`sketch/`](sketch/) | A drawing board (Excalidraw) of named sketches, each a standard `.excalidraw` file under `docs/product/sketches/` (a bar lists, opens, makes and renames them); Claude reads and draws on them with `groundwork sketch show \| apply` (Mermaid flowcharts too), live, merged element by element with the browser's edits; threads of comments pinned to shapes (`groundwork sketch threads \| comment \| close`); links from a sketch to ideas, map nodes, tickets and other sketches, which those modules show (`GET /api/sketch/links`) | in progress (Claude skill: groundwork-sketch) |
| [`agents/`](agents/) | The Claude Code sessions and their subagents, live: state (running, done, failed), start and duration, ticket and branch (Build shows who works on a ticket: `GET /api/agents/tickets`), from the redacted event log its hook writes to `.groundwork/agents/events.jsonl` | in progress (Claude hook: groundwork-agents-hook.mjs) |

## What a module is

From the plan ([`docs/product/spec/core/TECH.md`](../docs/product/spec/core/TECH.md), Modulszerződés), a module is one folder with:

1. a **descriptor**: id, name, version;
2. **server endpoints** under its own `/api/<module>/` path;
3. a **view** shown in the shared shell;
4. optionally **skills and hooks** for Claude Code, which `groundwork init` installs into a project;
5. the **folders it may write to**, which the core enforces;
6. optionally the **record types** it brings, which the core's record store keeps (`core/records/`).

In code, a module exports its manifest from `module.mjs`, and `core/modules.mjs` lists it (the order of that list is the order of the shell's tabs: the flow first, Ideas, Changes, Plan, Build):

```js
export default {
  id: 'plan', name: 'Plan', version: VERSION,           // the package's (core/version.mjs): one version for all
  tagline: { en: 'Mind map & product docs', hu: '…' },  // optional: the line under its name in the shell's tab
  icon: '<circle cx="12" cy="12" r="3"/>',          // optional: SVG markup on a 24×24 grid, drawn with currentColor strokes (trusted: inserted as is)
  tool: false,                                           // optional: true for a tool (Sketch), whose tab comes after the workflow's, behind a separator
  view: { dir: HERE, files: ['index.html', ...] },     // served under /plan/
  writes: ['docs/product', '.groundwork/plan'],          // the only folders it may write to
  records: [{                                            // optional (Ideas, Changes): case-record types the core's record store keeps
    prefix: 'I', name: 'idea', folder: 'docs/product/ideas',   // ids I-<n>, files I-<nnn>-<slug>.md in that folder (under docs/product/)
    fields: ['title', 'links', 'status', ...], lists: ['links'], links: ['links'],  // front-matter order, comma lists, references
    lifecycle: { field: 'status', states: [...], initial: 'new', claude: ['new', 'considering'] },  // Claude moves only between `claude`
    rules: (fields, { before, id, by, today, exists }) => fields,   // checks and tidies every write; throws to refuse it
    template: (id) => body, outline: (body) => object,  // optional: a new record's body; what show() reads from the body
  }],                                                    // changes (C) are the Changes module's type; the core's own, milestones (M), is in
                                                         // core/records/changes.mjs, with the Markdown of a change, which the core reads too;
                                                         // a link to a type no module declares shows as a plain id
  public: ['GET /api/plan/ids', 'POST /api/plan/todo'],  // the endpoints other modules may use (see below)
  attention: '/api/agents/attention',                    // optional (Agents): what needs the user, counted on the tab and toasted
                                                         // by the shell: { items: [{ key, reason, text: { en, hu } }], recheck }
  moves: { '.prd-maker': '.groundwork/plan' },           // optional: old state the core moves over once
  watch: (path) => (path.startsWith('docs/product/spec/') ? 'plan.map' : null),  // optional: live-update topic of a changed file
  cli: path.join(HERE, 'plan.mjs'),                      // optional: run by `groundwork plan <args>`
  claude: {                                              // optional: what `groundwork init` installs
    skills: [path.join(HERE, 'skills', 'groundwork-prd-maker')],  // skill folders, copied to .claude/skills/<name>/
    hooks: [{ event: 'UserPromptSubmit', run: 'plan hook' }],  // added to .claude/settings.json as `<RUNNER> plan hook`
    // or a script, for a hook that runs often (Agents): { event, matcher?, script: path.join(HERE, 'hook.mjs') },
    // copied to .claude/hooks/groundwork-<id>-hook.mjs and run as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/..."`
  },
  api: ({ root, files, events, records }) => (req, res, subpath, url) => true,  // /api/plan/<subpath>; true when it answered;
                                                         // records: the core's record store (core/records/store.mjs)
}
```

`RUNNER` (`core/version.mjs`) is `npx -y --prefer-offline @pottom/groundwork@<version>`: our package (the unscoped npm `groundwork` is someone else's) at the version init came from, taken from the npx cache without a registry lookup once it is there, so a hook that runs on every prompt needs no network. A skill's Markdown files write it as `{{groundwork}}` (`{{groundwork}} plan apply`); init fills it in. Run again after an upgrade, init replaces a hook of an older version, or of another form, instead of adding a second one. A hook that runs on every tool call cannot wait for npx (~0.7 s): it is a `script`, one file that needs only Node, which init copies into the project and runs with `node` (~60 ms; the Agents hook).

Endpoints answer with `send` from [`core/http.mjs`](../core/http.mjs): never cached, `nosniff`, with a `content-length`; to a HEAD request Node sends the headers only. The view files are served by the core with an `ETag` (a `304` while unchanged) and compressed.

### Reading another module

Modules read each other's data only through small, declared public endpoints, never through the other's files or its full data:

- A module lists in `public` the endpoints another module may read, and its README lists them under "Public endpoints". Each answers exactly what the reader needs and nothing more: today Plan's `GET /api/plan/ids` (the map's ids, not the map), Build's `GET /api/build/prd` (the ticket counts per map item, not the tickets) and `GET /api/build/ideas` (the number and state of the tickets naming each idea), Sketch's `GET /api/sketch/links` (which sketches link to which idea, map node, ticket or sketch, not the drawings) and Agents' `GET /api/agents/tickets` (the running agents per ticket, not the event log). A public endpoint is a `GET`, except a small write the owner takes on another module's behalf: Plan's `POST /api/plan/todo` (an idea from Ideas as a map node; the map is still written by Plan alone). Such a write takes only `content-type: application/json` (`415` otherwise), so no other web site can send it.
- A module calls no other endpoint of another module, and does not open the files another module owns (Build never reads the Spec files; Plan never reads tickets). A module that needs more asks for a new small endpoint in the other module's `public`, not for its full data.
- Every module works when the other is missing. The core then answers the missing module's endpoints with `404`, and the reader takes any answer that is not `ok`, or no answer, as "nothing to show": no counts, no map, no links into the missing module, and no error on the page.

`modules/alone.test.mjs` checks this: it starts the server with only Plan and with only Build, and scans each module's code for calls to the other's endpoints. The core itself has no user-facing feature of its own; it serves the modules and the shell around them.

Live updates: the core watches the project and tells the pages what changed through `GET /api/events` (Server-Sent Events, [`core/events.mjs`](../core/events.mjs)). A module names the topic of the files it cares about with `watch(path)` (path relative to the root, with `/`), and can push a topic itself with `events.publish(topic)` or `events.every(ms, fn)`. To keep something it read from the project (a listing) until a file changes, it compares `events.stamp()`: `null` while the folder is not watched (read afresh), otherwise the same string exactly as long as nothing below the root changed. No page polls the server.

The shell owns the connection: one stream per browser tab, which it relays to the module's frame. A view never opens an `EventSource` of its own; it calls `subscribe` from [`core/shell/live.mjs`](../core/shell/live.mjs) (served at `/shell/live.mjs`), which uses the shell's relay inside the shell and opens the page's own stream when the page is opened on its own:

```js
import { subscribe } from '/shell/live.mjs'
const stop = subscribe({
  onHello: () => readEverything(),      // (re)connected: read everything again; also right after subscribing when the shell is live
  onChange: (topics) => { ... },        // ['plan.map', ...]: ask your endpoints again if a topic is yours
  onState: (state) => { ... },          // optional, 'connecting' | 'on' | 'off'
})
```

Either way the stream is closed on `pagehide`, so leaving a page logs no connection error. The shell's header is the only place that shows whether the page is live: a view shows only what the shell cannot know, its own transient activity (saving, saved, could not save, re-reading), as a `.gw-toast` that goes away by itself. `onState` is for a page running without the shell.

A module has no general file system access: it reads and writes the project through `files`, the writer the core hands it ([`core/files.mjs`](../core/files.mjs)). `files.write`, `append` and `remove` work only under the folders in `writes`, and those must lie under `docs/product/` or `.groundwork/`; a path that is absolute, climbs out with `..` or leads outside through a symlink or junction fails before anything is written. A module's local state goes in `.groundwork/<id>/`, which is gitignored. The record store a module gets (`records`) reads every record and the Spec, but writes only the record types the manifest declares in `records`, and the Spec only when `writes` covers `docs/product/spec/` (Plan's); anything else is refused (code `forbidden`). The core's own writes keep to the same two folders, with one exception no module can reach: `groundwork record renumber`, started only by a human, also rewrites references in the local tickets under `.scratch/` (#50; it amends `d-sec-write`, proposed in C-2).

One exception: a `script` hook (see `claude.hooks` above) is not the module's server code but a separate process that Claude Code starts, so it has no `files`. `groundwork init` installs it under `.claude/hooks/` (as `groundwork-<id>-hook.mjs`), and it writes with Node's `fs`, only under its module's `.groundwork/<id>/`. Today that is the Agents hook ([`agents/hook.mjs`](agents/hook.mjs)): it appends to `.groundwork/agents/events.jsonl` and keeps the redacted final reports in `.groundwork/agents/reports/`. The Agents server itself only reads them, through `files`.

The view shows inside the core's shell, which adds the header and the navigation; the navigation has a tab for every module with a `view`: its `icon`, its `name` and its `tagline` (in the UI language; English is required when there is one). The `icon` is the inside of a `<svg viewBox="0 0 24 24">` (paths, circles, …, stroked in `currentColor`); it is trusted markup from the module's own code, which the shell inserts as it is, unescaped, so it must never come from the project or a user. A view may build with Lit (LitElement, d-lit): it imports `/vendor/lit-element/lit-element.js`, with Lit's import map in its `<head>` ([`core/vendor/README.md`](../core/vendor/README.md)); components more than one module needs live in the core's shell, like `<gw-record-chip>` (`/shell/record-chip.mjs`: a record's id and title, opening it in the module that declares its type, at `/?module=<module>&<type name>=<id>`, so a module that shows records answers that link: Ideas `?idea=I-5`). The existing views stay lit-html templates for now. To share the look, a view links `/shell/theme.css` and builds with its design system: the `--gw-*` tokens (colours with AA-safe `-text` and `-soft` status variants, the accent `--gw-gradient`, type, radii, spacing; light or dark follows the OS until the user picks Light or Dark in the shell's header) and the `.gw-*` components (badge, tag, dot, segmented control, buttons, field, card, section header, toolbar, tabs, progress, empty state, callout, toast). The top of [`core/shell/theme.css`](../core/shell/theme.css) documents every token and component and the rules of the look; it is the contract. A view keeps no local copy of a component the theme has, and marks whatever is current or primary with the gradient.

Every page of a view loads the theme switch first in its `<head>`, before the stylesheets: `<script src="/shell/theme.js"></script>`. It is a plain script (not a module), so the page paints in the chosen theme from the start; it sets `<html data-theme="light|dark">` when the user chose one (none for System, which follows the OS) and switches the page live when the choice changes in the shell, without a reload. A module's own dark colours use the same selectors as `theme.css`: `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and `:root[data-theme="dark"] { … }`. Code that draws with colours of its own (a canvas, a library such as Mind Elixir or Excalidraw) follows `window.groundworkTheme`: `.theme` is `'light'` or `'dark'` as shown now, and `.onChange((theme, choice) => …)` is called after every change (also when the OS switches while the choice is System); it returns a function that stops it. Plan's map does so through `followTheme(groundworkTheme, apply)` in `modules/plan/map-theme.mjs`.

The UI text goes through the core's translation, [`core/shell/i18n.mjs`](../core/shell/i18n.mjs) (served at `/shell/i18n.mjs`, usage at its top): the view keeps its strings in one object per language (English required, Hungarian too), calls `createI18n(strings)`, uses `t(key)` and `data-i18n` attributes, and re-renders in `onChange`. The language is chosen in the shell; the view follows it. This is the UI language only; a module's generated documents have their own.

Plan and Build both follow this contract. Build lists no `writes`, so it cannot write anything.
