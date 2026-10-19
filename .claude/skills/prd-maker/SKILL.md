---
name: prd-maker
description: Turns a grilling interview into product documentation: a PRD, a technical design, and for systems and services also overview, service, process, operations and rollout documents. While you talk, it draws a live mind map and writes the documents under docs/product/, all visible and editable in the browser pane. Works for new and for half-finished projects. Load it alongside grilling, grill-me or grill-with-docs, and whenever the user wants a PRD, a spec of a system or service, or mentions the mind map.
---

The deliverables are Markdown documents under **`docs/product/`**. The mind map is how the human follows along: at any moment it shows where the interview stands and what has been covered. Everything is a view of one file, `docs/product/mindmap.json`.

## Structure

```
root                          the system or product
├── document                  belongs to the whole: e.g. the overview (SYSTEM.md)
├── component                 a part of the system, with a type (software, service, infra, shared)
│   └── document              e.g. PRD.md and TECH.md for software, SERVICE.md for a service
│       └── section           a chapter of that document
│           └── items         decisions, facts, groups…
```

- **A plain software product** needs no components: two documents under the root, `prd` and `tech`.
- **A system or service, or a mix**, gets an overview document (`system`) and one component per part, each with the documents its type needs.
- **Files.** Each document is written to `docs/product/<component>/<FILE>.md`, or to `docs/product/<FILE>.md` when it belongs to the whole. The files are regenerated on every change. Never edit them by hand, and never overwrite a file prd-maker did not generate.
- **Other skills' places.** These folders belong to other skills: `GLOSSARY.md`, `GLOSSARY-MAP.md`, `docs/adr/`, `docs/agents/`, `.scratch/` and `.out-of-scope/`. prd-maker never writes into them. It reads them and links to them.

### Document kinds and their starting sections

The sections are only starting points. What a project needs, and what "scope" means for it, differs from project to project. Propose sections fitted to this project, and let the human confirm or change them.

| kind | file | starting sections |
|---|---|---|
| `system` | SYSTEM.md | Cél és érintettek · Összetevők és határaik · Közös ütemterv · Kockázatok és függőségek · Költségek |
| `prd` | PRD.md | Probléma és cél · Felhasználók és használati esetek · Hatókör és fő funkciók · Funkcionális követelmények · Nem funkcionális követelmények |
| `tech` | TECH.md | Platform és futtatási környezet · Technológiai stack · Architektúra és komponensek · Adatok és tárolás · Integrációk és interfészek · Biztonság · Build, kiadás, telepítés · Tesztelés és minőség · Döntésnapló |
| `service` | SERVICE.md | Kinek és mit · Szolgáltatási szint (SLA) · Csatornák · Feltételek és árazás · Mérőszámok |
| `process` | PROCESS.md | Szerepek · Fő folyamatok · Eszkaláció · Átadások |
| `infra` | INFRA.md | Környezetek · Hálózat · Kapacitás · Biztonság · Mentés |
| `ops` | OPERATIONS.md | Monitorozás · Incidenskezelés · Mentés és helyreállítás · Karbantartás · Támogatási modell |
| `rollout` | ROLLOUT.md | Ütemezés · Migráció · Oktatás · Kommunikáció · Visszaállítási terv |

Any other kind is allowed too; its file name comes from the document's name, or from `file`.

Notes on two of the sections:

- **Technológiai stack** (in `tech`): group it by layer. For each technology, record what it is, why it was chosen (`note`, ADR `link`), and the alternatives ruled out (`excluded`).
- **Döntésnapló** (in `tech`): one `decision` per ADR in `docs/adr/`, with its state in `note` (érvényes, részben felülírt, érvénytelen, nyitott) and the file in `link`.

## The map is meeting notes, not a transcript

Questions, the choices you offered, and your recommendations never go on the map. It keeps only what matters:

- **Short labels**, a few words, in the language of the conversation. A rationale goes in `note`.
- **Only what matters**: decisions, constraints, scope boundaries, facts that later answers depend on. Accepted defaults and small talk stay off the map.
- **Placed by meaning**: each item goes into the document and section it belongs to, wherever the conversation happened to be. What the user gets belongs in the PRD; what it is built with belongs in TECH; how it is run belongs in OPERATIONS.
- **Redraw freely**: rename, merge, move or remove nodes so the map always reads as the current state, not as history.
- **Readable ids**:
  - `c-<slug>` for components
  - `doc-<slug>` for documents
  - `t-<slug>` for sections
  - `g-<slug>` for groups
  - `d-<slug>` for decisions
  - `n-<slug>` for notes

## Tools

All access goes through `node mindmap/mm.mjs`. Never write the map or the documents by hand: `apply` merges with edits the human is making at the same moment.

- `init "<name>"`: create an empty map whose root is the system or product name.
- `show`: print the outline with ids, statuses, documents and section state, plus any human edits you have not seen yet.
- `apply`: change the map and the documents, then print the outline. Pass a JSON op array on stdin with a quoted heredoc in the Bash tool. This avoids Windows quoting problems:

  ```bash
  node mindmap/mm.mjs apply <<'EOF'
  [{"op":"add","id":"c-app","parent":"root","topic":"Mobilapp","component":"software"},
   {"op":"add","id":"doc-app-prd","parent":"c-app","topic":"Termék","doc":"prd"},
   {"op":"add","id":"t-app-users","parent":"doc-app-prd","topic":"Felhasználók","status":"topic"},
   {"op":"set","id":"t-app-users","prose":"…the section text, in Markdown…"}]
  EOF
  ```

  Ops:
  - `{"op":"add","id":"…","parent":"…","topic":"…","status":"…","note":"…","link":"…","impl":"…","component":"…","doc":"…","file":"…"}`
  - `{"op":"set","id":"…", …the same fields…, "prose":"…","progress":"done"}`
    - `prose` and `progress` are for sections only.
    - Set a field to `""` to clear it.
  - `{"op":"move","id":"…","parent":"…"}`
  - `{"op":"remove","id":"…"}`

  `link` paths are relative to the project root (for example `docs/adr/0012.md`). They are rewritten for each document.
- Statuses:
  - `topic`: a group inside a section.
  - `decision`: something settled.
  - `note`: a fact or constraint.
  - `excluded`: ruled out. Each document lists these in its own section: Nem célok in the PRD, Elvetett megoldások in TECH. Record the rejected alternatives of a technical decision this way.
  - `parked`: deferred.
  - `todo`: still to discuss. It goes to the open questions.
  - `inferred`: read from existing code or documents, waiting for the human to confirm. Once confirmed, change it to `decision` (or `note`); if it is wrong, fix or remove it.
- Implementation (`impl`, independent of the status): `done`, `partial` or `missing`. Use it whenever there is code to compare against.

  Sections with nothing in them are listed among the open questions automatically. Do not create sections for non-goals, open questions or later items; each document generates those.

## Session flow

1. **Start.** If `docs/product/mindmap.json` is missing, run `init`. Start the editor with `preview_start` (configuration `prd-maker`, from `.claude/launch.json`).
2. **Existing project?** If there is already code or documentation, read it before asking anything. Dispatch a sub-agent for a thorough analysis:
   - the product: README, specs, glossary, docs;
   - every ADR in `docs/adr/`, with its state;
   - feature specs in `.scratch/*/spec.md`;
   - non-goals in `.out-of-scope/`;
   - the technology stack and the architecture;
   - the features, with their implementation state;
   - the inconsistencies between docs and code.

   Draw the result as `inferred` items with `impl` and evidence `link`s. Draw the inconsistencies as `todo` items. The first grilling round then confirms the inferred items, document by document; only after that move on to what is missing.
3. **What are we building?** The first real question decides the structure: a software product, a system, a service, or a mix, and which parts it consists of. From the answer, propose the components, their documents and the documents' sections. Ask the human to confirm or change them, in chat or on the map.
4. **Steer by the documents.** The grilling frontier must cover every section of every document. Prefer questions that fill untouched or thin sections, since the progress bars show the human exactly what is missing.
5. **Each round.** Ask the round in chat; the map does not change yet. When the answers arrive, in the same turn and before the next round:
   1. Update the map items.
   2. Rewrite the `prose` of every section the answers touched. Write it as the section reads **now**: complete, polished text, not a log of the conversation. The prose gives the context, the reasoning and the scenarios. The list under it holds the atomic decisions, so do not repeat them one by one. Use Markdown, in the language of the conversation, typically one to three short paragraphs.
   3. Set `progress: "done"` on a section once your design tree has nothing left open in it.
6. **ADRs and glossary (grill-with-docs).** domain-modeling writes ADRs to `docs/adr/` and terms to `GLOSSARY.md`. prd-maker does not write them itself. When an ADR appears, add it to the Döntésnapló and set `link` on the matching decision. The glossary is shown automatically in the PRD and the overview.
7. **Finish.** When the frontier is empty, make a final pass:
   - Reread every section's prose so each document reads as one coherent whole, and the documents agree with each other.
   - Mark every section `done`.
   - Tell the human the documents are ready under `docs/product/`, and offer to publish them as shareable documents.

## Human edits are authoritative

The prompt hook and `show` both report what the human changed in the browser. Act on these changes:

- **Map changes:**
  - Renamed or moved: keep the human's wording and structure.
  - Removed: do not put it back.
  - Added (`todo`): ask about it in the next round.
  - Status changed: treat it as the human's statement. `inferred` set to `decision` means confirmed.
- **The human's paragraphs** (shown as "the human's own PRD paragraphs"): never edit or repeat them. Adapt your prose so it neither contradicts nor duplicates them. If one conflicts with a later answer, ask about it in the next round instead of overriding it.
- **The human took over your text** (your `prose` was removed and reappears among their paragraphs): do not recreate it. Write only what is still missing from the section, or nothing.
