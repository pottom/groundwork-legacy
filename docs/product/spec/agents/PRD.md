# Groundwork — Agents modul: Termék

_Termékkövetelmény-dokumentum (PRD)_

## Probléma és cél {#t-agents-problem .done}

Egy mérföldkő munkáján gyakran több agent dolgozik egyszerre, mindegyik a saját worktree-jében és branchén, egy-egy jegyen. Az állapotukat ma csak a chatből lehet követni: ki min dolgozik, meddig jutott, vár-e valamire, és mit jelentett a végén.

Az Agents modul ezt teszi láthatóvá egy helyen, élőben: az agenteket a jegyükkel, a branchükkel, a haladásukkal és a záró jelentésükkel. Az első változat csak megfigyel; indítani és leállítani továbbra is a Claude Code-ban lehet.

- Egy helyen látszik, melyik agent min dolgozik, hol tart és mit jelentett · `d-agents-goal` · döntés · C-1

## Felhasználók és használati esetek {#t-agents-users .done}

A felhasználó a fejlesztő, aki egy mérföldkő jegyeit agentekkel valósíttatja meg, gyakran párhuzamosan, és közben máson dolgozik vagy távolról figyel. Ránéz, melyik agent hol tart, melyik vár engedélyre vagy akadt el, melyik végzett, és mi van a jelentésében; a worktree-k listájából látja, mi van már összefésülve, és mit lehet eltakarítani.

- A fejlesztő, aki agenteket futtat és összefésüli a munkájukat · `d-agents-user` · döntés · C-1

## Hatókör és fő funkciók {#t-agents-scope .done}

A modul listázza a futó és a befejezett agenteket a jegyükkel, a branchükkel, az állapotukkal és az időtartamukkal. Egy agentet megnyitva látszik az idővonala, vagyis a fő lépései (milyen fájlokat érintett, futtatott-e teszteket, mit commitolt), és a végén a záró jelentése. Az agentek, a jegyek és a branchek össze vannak kötve, a Build jegyein pedig látszik, ha éppen dolgozik rajtuk valaki.

Külön nézet mutatja a worktree-ket és brancheket: mennyivel járnak előrébb vagy maradtak le az integrációs ághoz képest, össze vannak-e már fésülve, és eltakaríthatók-e. A figyelmet kérő agentek (engedélyre vár, elakadt, hibával állt le) kiemelve jelennek meg.

- Futó és befejezett agentek: jegy, branch, állapot, időtartam · `f-agents-list` · döntés · kész · C-1
  Munkamenetek és subagentjeik állapottal (fut, kész, hibával állt le), indulással, időtartammal, jeggyel és branchcsel.
  [modules/agents/view/list.mjs](../../../../modules/agents/view/list.mjs)
- Idővonal agentenként: fájlok, tesztek, commitok, fő lépések · `f-agents-timeline` · döntés · kész · C-1
  Egy agentet (vagy munkamenetet) megnyitva az eszközhívásai lépésekbe csoportosítva, időponttal látszanak: olvasott fájlok, módosított fájlok, parancsok, egyéb eszközök. A tesztfuttatás (sikeres, sikertelen vagy ismeretlen kimenetellel) és a commit (a hash-ével) külön, kiemelt lépés, a használt skill és az indított subagent is. A hook a tesztet egy ellenőrzött parancslistából ismeri fel (npm test, node --test, vitest, pytest ...), a kimenetelt a hívás hibájából vagy a kimenet pass/fail számaiból veszi, és csak a szót tárolja.
  [modules/agents/timeline.mjs](../../../../modules/agents/timeline.mjs)
- A záró jelentés megjelenítése · `f-agents-report` · döntés · kész · C-1
  A subagent leállása után a záró jelentése az idővonal alatt Markdownként jelenik meg; futás közben jelzi, hogy a leálláskor érkezik. A nyers HTML szövegként látszik, link csak http(s), mailto vagy relatív címre mutat, kép nem töltődik be.
  [modules/agents/view/detail.mjs](../../../../modules/agents/view/detail.mjs)
- Agent ↔ jegy ↔ branch; a Build jegyein látszik a dolgozó agent · `f-agents-ticket-link` · döntés · kész · C-1
  Minden munkamenet és agent mutatja a branchét és a jegyét; a jegy a Buildben nyílik meg, a branch a worktree-k listájában a saját sorára visz. A Build jegyein (táblázat és fiók) „Dolgoznak rajta” jelvény jelenik meg agentenként, élőben (agents.events), amely az Agents modulban az agent idővonalát nyitja meg (/?module=agents&agent=<session>/<agent>, az oldal #agent= címe).
  [modules/agents/agent-tickets.mjs](../../../../modules/agents/agent-tickets.mjs)
- Worktree-k és branchek: előnyben, lemaradva, összefésülve, takarítható · `f-agents-worktrees` · döntés · kész · C-1
  Minden worktree és helyi branch: előnyben/lemaradva az integrációs ághoz képest, összefésülve, nem commitolt változások, zárolt (futó agent), és ha ismert, a benne dolgozó agent és a jegy. A worktree-ben lévő branch mindig látszik (a 100-as korlát csak a többire vonatkozik). Egy frissen leágaztatott branch, amelynek még nincs saját commitja, nem számít összefésültnek és nem takarítható. Az eltakarítható (összefésült, tiszta, nem zárolt) worktree-hez és branchhez a git worktree remove / git branch -d parancs másolható; a modul semmit nem futtat. Élő: a refek változása az agents.git téma.
  [modules/agents/view/worktrees.mjs](../../../../modules/agents/view/worktrees.mjs)
- Figyelmet kérő agent kiemelése: engedélyre vár, elakadt, hibázott · `f-agents-attention` · döntés · kész · C-1
  Kiemelve, az okkal: engedélyre vár (permission_prompt vagy elicitation Notification, az agent vagy a munkamenet következő eseményéig), elakadt (fut, de 10 perce nincs eseménye; a futó agentű munkamenet nem, azt az agent viseli), hibával állt le. 12 óránál régebbi nem számít. Az oldal a másodperces órájával ítél, így az elakadás új esemény nélkül is látszik. A héjban az Agents fülén szám, és minden új esetre egyszer toast jelenik meg (core/shell/attention.mjs).
  [modules/agents/attention.mjs](../../../../modules/agents/attention.mjs)
- Élő frissítés · `f-agents-live` · döntés · kész · C-1
  [modules/agents/view/main.mjs](../../../../modules/agents/view/main.mjs)

## Funkcionális követelmények {#t-agents-func .done}

A modul csak megfigyel: nem indít, nem állít le és nem üzen agenteknek; ez később jöhet, ha a megfigyelés bevált. Egy agentről az összefoglalót, az idővonalat és a záró jelentést mutatja, a teljes beszélgetés-átiratot nem.

- Csak megfigyel; indítás és leállítás a Claude Code-ban · `d-agents-observe` · döntés · C-1
- Agentek irányítása a böngészőből · `p-agents-control` · félretett · C-1
  Indítás, leállítás, üzenet; később, ha a megfigyelés bevált.
- Összefoglaló és idővonal, teljes átirat nélkül · `d-agents-summary` · döntés · C-1
- A teljes beszélgetés-átirat megjelenítése · `x-agents-transcript` · kizárt · C-1

## Nem funkcionális követelmények {#t-agents-nfr .done}

A hook minden eszközhívásnál lefut, ezért legfeljebb 100 ms-ot adhat hozzá; egy agent munkája ettől nem lassulhat érezhetően. A modul a közös dizájnrendszert használja, angolul és magyarul is működik, hálózat nélkül is.

- A hook nem lassítja érezhetően az agenteket: legfeljebb 100 ms eszközhívásonként · `d-agents-overhead` · döntés · C-1
- A közös keret kinézete, angol és magyar felület, offline · `d-agents-nfr` · döntés · C-1
