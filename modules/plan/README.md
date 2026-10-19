# Plan modul (prototípus: prd-maker)

Egy grilling-interjúból termékdokumentációt készít, élőben. Szoftvertermékhez PRD-t és műszaki tervet ír. Rendszerhez vagy szolgáltatáshoz (vagy a kettő keverékéhez) áttekintést, szolgáltatásleírást, folyamatokat, üzemeltetési és bevezetési tervet is.

Beszélgetés közben a böngészőpanelen két dolog látszik egymás mellett:

- egy **gondolattérkép**, amelyen mindig látszik, hol tart az interjú és mit érintettünk már;
- a készülő dokumentumok, amelyek minden kör után bővülnek.

Mindkettő szerkeszthető.

Új projekthez és félig kész, már meglévő kódú projekthez is használható. Utóbbinál Claude először átnézi a kódot és a dokumentációt (ADR-ek, specifikációk, `.out-of-scope`), és „kódból” jelöléssel, megvalósítási állapottal előre feltölti a térképet.

Használható a `grilling`, `grill-me` és `grill-with-docs` skillekkel.

## Szerkezet

```
rendszer / termék (gyökér)
├── dokumentum            az egészhez tartozik, pl. Áttekintés → docs/product/SYSTEM.md
├── összetevő             típussal: szoftver, szolgáltatás, infrastruktúra, közös
│   └── dokumentum        pl. Mobilapp → docs/product/mobilapp/PRD.md és TECH.md
│       └── fejezet
│           └── elemek    döntés, tény, csoport…
```

| Dokumentumtípus | Fájl |
|---|---|
| `system` | `SYSTEM.md` |
| `prd` | `PRD.md` |
| `tech` | `TECH.md` |
| `service` | `SERVICE.md` |
| `process` | `PROCESS.md` |
| `infra` | `INFRA.md` |
| `ops` | `OPERATIONS.md` |
| `rollout` | `ROLLOUT.md` |

Más típus is használható; ilyenkor a fájlnév a dokumentum nevéből lesz. A fejezetek projektenként mások, a sablon csak kiindulópont.

## Működés

- **Egy igazságforrás:** a `docs/product/mindmap.json`. A térkép és a dokumentumok ennek nézetei, és minden változáskor újragenerálódnak belőle. A térképről törölt dokumentum fájlja is törlődik.
- **A térkép jegyzet, nem jegyzőkönyv.** A kérdések nem kerülnek fel, csak ami a válaszokból fontos.
- **Gyűjtő fejezetek dokumentumonként:** a kizárt elemekből például a PRD-ben „Nem célok”, a műszaki tervben „Elvetett megoldások” lesz. Az elhalasztott elemek, a „kérdezz rá” elemek és az érintetlen fejezetek szintén saját fejezetbe gyűlnek.
- **Megvalósítási réteg:** egy elem lehet kész, részben kész vagy hiányzik. A dokumentum fejléce összesíti.
- **Kézzel írt fájlt nem ír felül.**
- **Nem ütközik a mattpocock skillekkel:**
  - a `GLOSSARY*.md`, a `docs/adr/`, a `docs/agents/`, a `.scratch/` és a `.out-of-scope/` az ő helyük;
  - a prd-maker ezeket csak olvassa és linkeli.
- **A te szerkesztéseid elsőbbséget élveznek.** Ha egy bekezdést átírsz, az a tiéd lesz, és Claude nem írja felül.

## Kezelés

| Hol | Mit |
|---|---|
| fejléc | fókusz: teljes térkép / egy összetevő / egy dokumentum · nézet: Térkép / Mindkettő / Dokumentum · **Nézet / Szerkesztés** kapcsoló (nézet módban semmi nem módosítható) |
| dokumentum panel | dokumentumválasztó összetevők szerint, haladással · a panel széle: becsukás |
| térkép háttér | húzás: mozgatás · Shift + húzás: kijelölés |
| csomópont | Tab: új ág · dupla kattintás: átnevezés · húzás másik csomópontra: áthelyezés |
| alsó sáv (szerkesztés módban) | a kijelölt csomópont típusa (téma, döntés, tény, kizárva, később, kérdezz rá, kódból) és megvalósítása (kész, részben, hiányzik) |
| nagy térkép | induláskor a fejezetek össze vannak csukva; a „+” nyitja, a dokumentumból kattintva magától kinyílik |
| dokumentum | sorra kattintva a térképen is kijelölődik · „Szerkesztés” vagy dupla kattintás: bekezdés átírása · „+ Saját bekezdés” |

## Részek

| Fájl | Szerep |
|---|---|
| `plan.mjs` | szerver + CLI (`init`, `apply`, `show`, `serve`, `hook`) |
| `index.html` | a térkép és a dokumentum panel ([Mind Elixir](https://github.com/ssshooter/mind-elixir-core) 5.15.1, [marked](https://marked.js.org)) |
| `documents.mjs` | dokumentum-modell a térképből (összetevők, dokumentumok, fejezetek) + Markdown export (közös a szerverrel) |
| `node-types.mjs` | csomópont-típusok: címke, [Lucide](https://lucide.dev) ikon |
| `docs/product/mindmap.json` | a térkép és a szövegek, ez az egyetlen igazságforrás (a cél-projektben) |
| `docs/product/**/*.md` | a generált dokumentumok (a cél-projektben) |
| `.prd-maker/` | helyi állapot: a még fel nem dolgozott kézi szerkesztések, a generált fájlok listája |
| `skills/prd-maker/SKILL.md` | a munkamenet Claude-nak (a repó `.claude/skills/` alatti példánya ennek a másolata) |
| `.claude/settings.json` | `UserPromptSubmit` hook: továbbítja a kézi szerkesztéseket, és grill promptnál emlékeztet a skillre |
| `.claude/launch.json` | `prd-maker` preview szerver (port 4477) |

## Kézi használat

```bash
node modules/plan/plan.mjs init "Termék neve"
node modules/plan/plan.mjs serve
node modules/plan/plan.mjs show
```

Más mappában lévő projekthez: `MINDMAP_DIR=<mappa> node modules/plan/plan.mjs serve`.

## Szinkron

- **Claude → térkép és dokumentumok:** az `apply` közvetlenül a fájlba ír, az oldal másodpercenként frissül. Az új vagy megváltozott elemek felvillannak, és az összecsukott ágak kinyílnak, ha új elem került beléjük.
- **Ember → Claude:** minden szerkesztés után az oldal visszaküldi a térképet a betöltött verzió azonosítójával. Ha közben Claude is írt, a szerver csak a te változásaidat játssza rá a friss fájlra.
- **Ismert korlátok:**
  - Ütközéskor a testvér-csomópontok sorrendjének változása elveszhet.
  - A csomópontok szabadon nem helyezhetők el, a térkép automatikusan rendez.
