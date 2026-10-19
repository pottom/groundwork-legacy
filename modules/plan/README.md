# Plan modul (Claude skill: groundwork-prd-maker)

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
- **Dokumentumnyelv:** a térkép a gyökerén tárolja a dokumentumok nyelvét (`lang`: `hu`, `en`); a skill az interjú elején a beszélgetés nyelvére állítja. Nyelv nélkül magyar. A dokumentumok állandó szövegei (fejléc, állapotok, gyűjtő fejezetek, kezdő fejezetek) ezen a nyelven készülnek; ez független a felület nyelvétől. Új nyelvhez elég egy új szövegkészlet a `doc-strings.mjs`-ben.
- **Megvalósítási réteg:** egy elem lehet kész, részben kész vagy hiányzik. A dokumentum fejléce összesíti.
- **Közvetlen link egy elemre:** a `/?module=plan&node=<azonosító>` (vagy a shell nélkül `/plan/?node=<azonosító>`) a térkép csomópontjára áll: kijelöli, felvillantja, és a dokumentumban is kiemeli; ha a nézet egy másik dokumentumra szűkít, átvált arra. Ismeretlen azonosítóra a Plan kiírja, hogy nincs ilyen elem. A Build innen linkeli a jegyek `**PRD:**` sorában felsorolt elemeket (`deep-link.mjs`).
- **Jegyek a térképen:** minden elemen látszik, hány jegy nevezi meg a `**PRD:**` sorában, és abból hány kész (pl. `1/3`; zöld, ha mind kész). A számokat a Build adja (`/api/build/prd`, ugyanazzal a jegyolvasóval, amellyel a Build oldala olvas), és új jegy vagy állapotváltás után újraindítás nélkül frissülnek. A számra kattintva a Build csak az elem jegyeit mutatja (`/?module=build&prd=<azonosító>`, `buildLink(id)`).
- **Kézzel írt fájlt nem ír felül.**
- **Nem ütközik a mattpocock skillekkel:**
  - a `GLOSSARY*.md`, a `docs/adr/`, a `docs/agents/`, a `.scratch/` és a `.out-of-scope/` az ő helyük;
  - a Plan modul ezeket csak olvassa és linkeli.
- **A te szerkesztéseid elsőbbséget élveznek.** Ha egy bekezdést átírsz, az a tiéd lesz, és Claude nem írja felül.

## Kezelés

A felület alapból angol, és magyarul is elérhető: a nyelvet a mag fejlécében lehet váltani (a szövegek a `ui-strings.mjs`-ben). Ez nem érinti a dokumentumok nyelvét. Az alábbi táblázat az angol feliratokat mutatja.

| Hol | Mit |
|---|---|
| fejléc | fókusz (*What the map shows*): *Whole map* / egy összetevő / egy dokumentum · nézet: *Map* / *Both* / *Document* · **View / Editing** kapcsoló (nézet módban semmi nem módosítható) |
| dokumentum panel | dokumentumválasztó összetevők szerint, haladással · a panel széle: becsukás (*Close the document*) |
| térkép háttér | húzás: mozgatás · Shift + húzás: kijelölés |
| csomópont | Tab: új ág · dupla kattintás: átnevezés · húzás másik csomópontra: áthelyezés |
| alsó sáv (szerkesztés módban) | a kijelölt csomópont típusa (*topic, decision, fact, excluded, later, ask about it, from code*) és megvalósítása (*done, partial, missing*) |
| nagy térkép | induláskor a fejezetek össze vannak csukva; a „+” nyitja, a dokumentumból kattintva magától kinyílik |
| dokumentum | sorra kattintva a térképen is kijelölődik · *Edit* vagy dupla kattintás: bekezdés átírása · *+ Your own paragraph* |

A térkép világos vagy sötét színei az operációs rendszert követik, újratöltés nélkül is.

## Részek

| Fájl | Szerep |
|---|---|
| `module.mjs` | a modul a mag szerver számára: manifest, nézet, végpontok `/api/plan/` alatt |
| `map-store.mjs` | a térkép olvasása, írása és összefésülése; a CLI, a hook és a szerver is ezt használja |
| `plan.mjs` | CLI (`init`, `apply`, `show`, `kinds`, `hook`), futtatva: `npx @pottom/groundwork plan <parancs>` (a manifest `cli` mezője) |
| `index.html` | az oldal vékony váza: a stíluslapok, a konténerek és a `view/main.mjs` betöltése; minden más a `view/` mappában van |
| `view/` | a térkép és a dokumentum panel kis ES modulokban, build lépés nélkül. A térképet a [Mind Elixir](https://github.com/ssshooter/mind-elixir-core) 5.15.1 rajzolja; az eszköztár, a jelmagyarázat, az állapotsáv, az értesítés és a dokumentum panel [lit-html](https://lit.dev) 3.2.1 sablonokkal készül, a [marked](https://marked.js.org) 12.0.2 Markdown-kimenete `unsafeHTML`-lel kerül bele. Mind a csomagban, a mag szolgálja ki a `/vendor/` alól, hálózat nélkül is működik. Minden fájlnak szerepelnie kell a manifest `view.files` listájában (a szerver csak ezeket szolgálja ki; a `view.test.mjs` ellenőrzi) |
| `view/main.mjs` | belépési pont: összeköti a részeket, nyelvváltáskor mindent újrafeliratoz |
| `view/state.mjs` | az oldal állapota egy objektumban (mód, nézet, fókusz, megnyitott dokumentum, szerkesztő…) és a térkép-lekérdezések |
| `view/strings.mjs` | a felület nyelve: a mag fordítója a `ui-strings.mjs` szövegeivel |
| `view/data.mjs` | a térkép betöltése, mentése és összefésülése, a szószedet, a jegyszámok; az élő frissítések (`subscribe`) |
| `view/map.mjs` | a térkép: ágvonalak (a pill széléig érnek minden nagyításon), téma, a csomópontok díszítése (ikon minden csomóponton, jelvény a pillen belül), húzás, illesztés, kijelölés |
| `view/focus.mjs` | mit mutat a térkép (egész, összetevő, dokumentum), a dokumentumválasztóval együtt; a közvetlen link |
| `view/chrome.mjs` | a térkép körüli felület kirajzolása az állapotból: eszköztár, jelmagyarázat, értesítés, a panel széle, állapotsáv, `.gw-toast`-ok, üres állapot |
| `view/toolbar.mjs`, `view/dock.mjs`, `view/legend.mjs` | az eszköztár (fókusz, nézet, mód) és a panel széle; az alsó állapotsáv; a jelmagyarázat (`.gw-popover`) |
| `view/document.mjs`, `view/editor.mjs` | a dokumentum panel (a változás felvillan, a kijelölt sor kiemelve); a bekezdésszerkesztő |
| `view/icons.mjs` | a felület ikonjai lit-html sablonként, a csomópont-ikonok CSS maszkként |
| `view/plan.css`, `view/map.css` | a felület és a térkép kinézete, csak a shell tokenjeivel (`/shell/theme.css`; a „kérdezz rá” színe a `--gw-pink`) |
| `documents.mjs` | dokumentum-modell a térképből (összetevők, dokumentumok, fejezetek) + Markdown export (közös a szerverrel) |
| `doc-strings.mjs` | a dokumentumok állandó szövegei nyelvenként (közös a szerverrel) |
| `ui-strings.mjs` | a felület szövegei nyelvenként (angol alapértelmezés, magyar fordítás), a mag fordítójához (`/shell/i18n.mjs`) |
| `node-types.mjs` | csomópont-típusok, dokumentum- és fejezetikon, összetevőtípus-ikonok (egy [Lucide](https://lucide.dev) ikoncsalád) és megvalósítási szintek kulcsai; a címkék a `ui-strings.mjs`-ben |
| `view-rules.mjs` | a képernyő böngésző nélkül tesztelhető szabályai: melyik nézet fér el (keskeny ablakban nincs „mindkettő”), a térkép illesztésének legkisebb olvasható nagyítása, a dokumentumfejléc összesítő jelvényei, frame-enként egy rajzolás |
| `map-theme.mjs` | a térkép világos és sötét témája a shell színeiből, és az operációs rendszer váltásának követése |
| `deep-link.mjs` | a közvetlen link (`?node=<azonosító>`): `planLink(id)` elkészíti, `linkTarget(search, map)` megkeresi a csomópontot; `buildLink(id)` a Buildbe visz, az elem jegyeire szűrve |
| `docs/product/mindmap.json` | a térkép és a szövegek, ez az egyetlen igazságforrás (a cél-projektben) |
| `docs/product/**/*.md` | a generált dokumentumok (a cél-projektben) |
| `.groundwork/plan/` | helyi állapot: a még fel nem dolgozott kézi szerkesztések, a generált fájlok listája (a cél-projektben; egy régi `.prd-maker/` mappát a mag ide költöztet) |
| `skills/groundwork-prd-maker/SKILL.md` | a munkamenet Claude-nak; az `npx @pottom/groundwork init` a projekt `.claude/skills/` mappájába másolja (a `{{groundwork}}` helyére a csomag verziójára rögzített `npx -y --prefer-offline @pottom/groundwork@<verzió>` kerül; a repó saját példánya ugyanez `node core/groundwork.mjs`-sel) |
| `.claude/settings.json` | `UserPromptSubmit` hook (`npx -y --prefer-offline @pottom/groundwork@<verzió> plan hook`, az `init` teszi be, a hálózatot csak az első futás éri el; a repóban `node modules/plan/plan.mjs hook`): továbbítja a kézi szerkesztéseket, és grill promptnál emlékeztet a skillre |
| `.claude/launch.json` | `groundwork` preview szerver: a mag szerver (port 4477), a Plan a `/plan/` alatt |

## Kézi használat

```bash
npx @pottom/groundwork init                      # skill, hook, .gitignore (jóváhagyás után)
npx @pottom/groundwork plan init "Termék neve"
npx @pottom/groundwork                           # a mag szerver, a Plan a /plan/ alatt
npx @pottom/groundwork plan show
```

Más mappában lévő projekthez: `npx @pottom/groundwork --root <mappa>`.

## Szinkron

- **Claude → térkép és dokumentumok:** az `apply` közvetlenül a fájlba ír, a mag élő frissítése (`/api/events`, Server-Sent Events, a shell egyetlen kapcsolatán át: `subscribe` a `/shell/live.mjs`-ből) szól az oldalnak, és az azonnal újratölti a térképet; lekérdezgetés (polling) nincs, és az első betöltés is a kapcsolat `hello` jelére történik. Hogy az oldal élő-e, azt csak a shell fejléce mutatja; a Plan a saját pillanatnyi teendőit (mentve, nem sikerült menteni, a térkép frissült) mutatja `.gw-toast`-ban. Az új vagy megváltozott elemek felvillannak, és az összecsukott ágak kinyílnak, ha új elem került beléjük.
- **Ember → Claude:** minden szerkesztés után az oldal visszaküldi a térképet a betöltött verzió azonosítójával. Ha közben Claude is írt, a szerver csak a te változásaidat játssza rá a friss fájlra.
- **Ismert korlátok:**
  - Ütközéskor a testvér-csomópontok sorrendjének változása elveszhet.
  - A csomópontok szabadon nem helyezhetők el, a térkép automatikusan rendez.
